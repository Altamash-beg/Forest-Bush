
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');

const { createAdminFlagsRouter } = require('./routes/adminFlags');
const { createAnalyzeApiRouter } = require('./routes/analyzeApi');
const { createApiKeyAuth } = require('./middleware/auth');
const { DEFAULT_ENVIRONMENT, parseEnvironment } = require('./schemas/flagSchemas');

const getFlagVersion = async (
  redis,
  key,
  environment = DEFAULT_ENVIRONMENT,
  logger = console
) => {
  if (redis?.disabled) return '0';

  try {
    return (await redis.get(`flag-version:${environment}:${key}`)) || '0';
  } catch {
    logger.warn('Cache version read failed');
    return '0';
  }
};

const getEnvironmentVersion = async (redis, environment, logger = console) => {
  if (redis?.disabled) return '0';

  try {
    return (await redis.get(`env-version:${environment}`)) || '0';
  } catch {
    logger.warn('Environment version read failed');
    return '0';
  }
};

const buildSnapshot = (flags, environment) => {
  const projected = flags
    .map((flag) => ({
      key: flag.key,
      enabled: flag.enabled,
      rules: flag.rules ?? null,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(projected))
    .digest('hex');

  return {
    environment,
    version: checksum.substring(0, 12),
    generatedAt: new Date().toISOString(),
    checksum,
    flags: projected,
  };
};

const REASONS = {
  FLAG_NOT_FOUND: 'flag_not_found',
  DISABLED: 'disabled',
  ENABLED_NO_RULES: 'enabled_no_rules',
  CONTEXT_REQUIRED: 'context_required',
  ROLLOUT_MATCH: 'rollout_match',
  ROLLOUT_MISS: 'rollout_miss',
  ERROR: 'error',
};

const rolloutBucket = (key, userId) => {
  const hash = crypto
    .createHash('sha256')
    .update(`${key}:${userId}`)
    .digest('hex');

  return parseInt(hash.substring(0, 8), 16) % 100;
};

const evaluateFlag = ({ flag, key, userId, environment }) => {
  const trace = {
    environment: environment ?? null,
    flagFound: Boolean(flag),
    flagEnabled: Boolean(flag?.enabled),
    rule: 'none',
    rolloutPercentage: null,
    userId: userId ?? null,
    bucket: null,
  };

  if (!flag) {
    return { key, enabled: false, reason: REASONS.FLAG_NOT_FOUND, trace };
  }

  if (!flag.enabled) {
    return { key, enabled: false, reason: REASONS.DISABLED, trace };
  }

  const rolloutPercentage = flag.rules
    ? flag.rules.rolloutPercentage
    : undefined;

  if (
    !flag.rules ||
    Object.keys(flag.rules).length === 0 ||
    rolloutPercentage === undefined
  ) {
    return {
      key,
      enabled: true,
      reason: REASONS.ENABLED_NO_RULES,
      trace,
    };
  }

  trace.rule = 'rolloutPercentage';
  trace.rolloutPercentage = rolloutPercentage;

  if (!userId) {
    return {
      key,
      enabled: false,
      reason: REASONS.CONTEXT_REQUIRED,
      trace,
    };
  }

  const bucket = rolloutBucket(key, userId);
  trace.bucket = bucket;

  const enabled = bucket < rolloutPercentage;

  return {
    key,
    enabled,
    reason: enabled ? REASONS.ROLLOUT_MATCH : REASONS.ROLLOUT_MISS,
    trace,
  };
};

const createApp = ({ prisma, redis, adminApiKey, logger = console } = {}) => {
  if (!prisma) {
    throw new Error('createApp requires a prisma client');
  }

  const app = express();

  app.use(cors());
  app.use(helmet());

  // Avoid logging full URLs that may contain user IDs in query parameters.
  app.use(morgan(':method :status :response-time ms'));

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/healthz', async (req, res) => {
    let postgres = 'unknown';
    let redisStatus = 'unknown';

    // Check PostgreSQL independently.
    try {
      await prisma.$queryRaw`SELECT 1`;
      postgres = 'connected';
    } catch {
      logger.error('PostgreSQL health check failed');
      postgres = 'error';
    }

    // Redis being intentionally disabled is not a health failure.
    if (redis?.disabled) {
      redisStatus = 'disabled';
    } else {
      try {
        const pong = await redis.ping();
        redisStatus = pong;
      } catch {
        logger.error('Redis health check failed');
        redisStatus = 'error';
      }
    }

    const healthy =
      postgres === 'connected' &&
      (redisStatus === 'disabled' || redisStatus === 'PONG');

    return res.status(healthy ? 200 : 500).json({
      status: healthy ? 'ok' : 'error',
      ...(healthy ? {} : { error: 'Health check failed' }),
      postgres,
      redis: redisStatus,
    });
  });

  app.get('/flags/:key', async (req, res) => {
    const { key } = req.params;

    const userId =
      typeof req.query.userId === 'string'
        ? req.query.userId
        : undefined;

    const explain = req.query.explain === 'true';
    const environmentResult = parseEnvironment(req.query.environment);

    if (!environmentResult.success) {
      return res.status(400).json({
        message: environmentResult.error,
      });
    }

    const { environment } = environmentResult;

    try {
      const version = await getFlagVersion(
        redis,
        key,
        environment,
        logger
      );

      const cacheKey =
        `flag:${environment}:${key}:v${version}:${userId || 'anonymous'}`;

      if (!explain) {
        try {
          if (!redis?.disabled && redis.status === 'ready') {
            const cachedResult = await redis.get(cacheKey);

            if (cachedResult) {
              logger.log('Cache hit');
              return res.status(200).json(JSON.parse(cachedResult));
            }
          }
        } catch {
          logger.warn('Cache read failed');
        }

        logger.log('Cache miss');
      }

      const flag = await prisma.featureFlag.findUnique({
        where: {
          key_environment: {
            key,
            environment,
          },
        },
      });

      const { trace, ...result } = evaluateFlag({
        flag,
        key,
        userId,
        environment,
      });

      if (!explain) {
        try {
          if (!redis?.disabled && redis.status === 'ready') {
            await redis.set(
              cacheKey,
              JSON.stringify(result),
              'EX',
              60
            );
          }
        } catch {
          logger.warn('Cache write failed');
        }
      }

      return res
        .status(200)
        .json(explain ? { ...result, trace } : result);
    } catch {
      logger.error('Flag evaluation failed');

      // Preserve the existing response behavior.
      return res.status(200).json({
        key,
        enabled: false,
        reason: REASONS.ERROR,
      });
    }
  });

  app.get('/environments/:envKey/snapshot', async (req, res) => {
    const environmentResult = parseEnvironment(req.params.envKey);

    if (!environmentResult.success) {
      return res.status(400).json({
        message: environmentResult.error,
      });
    }

    const { environment } = environmentResult;

    try {
      const version = await getEnvironmentVersion(
        redis,
        environment,
        logger
      );

      const cacheKey = `snapshot:${environment}:v${version}`;

      try {
        if (!redis?.disabled && redis.status === 'ready') {
          const cached = await redis.get(cacheKey);

          if (cached) {
            return res.status(200).json(JSON.parse(cached));
          }
        }
      } catch {
        logger.warn('Snapshot cache read failed');
      }

      const flags = await prisma.featureFlag.findMany({
        where: { environment },
      });

      const snapshot = buildSnapshot(flags, environment);

      try {
        if (!redis?.disabled && redis.status === 'ready') {
          await redis.set(
            cacheKey,
            JSON.stringify(snapshot),
            'EX',
            60
          );
        }
      } catch {
        logger.warn('Snapshot cache write failed');
      }

      return res.status(200).json(snapshot);
    } catch {
      logger.error('Snapshot generation failed');

      return res.status(500).json({
        message: 'error building snapshot',
      });
    }
  });

  // Admin API key verification does not query PostgreSQL.
  const verifyKeyRouter = express.Router();

  if (!adminApiKey) {
    verifyKeyRouter.get('/', (req, res) => {
      return res.status(503).json({
        error:
          'API key verification is unavailable because ADMIN_API_KEY is not configured.',
      });
    });
  } else {
    verifyKeyRouter.get(
      '/',
      createApiKeyAuth({ adminApiKey, logger }),
      (req, res) => res.status(200).json({ valid: true })
    );
  }

  app.use('/admin/verify-key', verifyKeyRouter);

  app.use(
    '/admin/flags',
    createAdminFlagsRouter({ prisma, redis, adminApiKey, logger })
  );

  app.use(
    '/admin/analyze',
    createAnalyzeApiRouter({ adminApiKey, logger })
  );

  return app;
};

module.exports = {
  createApp,
  evaluateFlag,
  getFlagVersion,
  buildSnapshot,
  REASONS,
};
