
const crypto = require('node:crypto');

const createApiKeyAuth = ({
  adminApiKey = process.env.ADMIN_API_KEY,
  logger = console,
} = {}) => {
  return (req, res, next) => {
    if (!adminApiKey) {
      logger.error(
        'ADMIN_API_KEY is not configured. Denying access to admin route.'
      );

      return res.status(503).json({
        error: 'Admin route is unavailable because its API key is not configured.',
      });
    }

    const receivedApiKey = req.headers['x-api-key'];

    if (!receivedApiKey) {
      return res.status(401).json({
        error: 'unauthorized: api key required in x-api-key header.',
      });
    }

    const expectedBuffer = Buffer.from(adminApiKey, 'utf8');
    const receivedBuffer = Buffer.from(receivedApiKey, 'utf8');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return res.status(403).json({
        error: 'forbidden: invalid api key.',
      });
    }

    return next();
  };
};

module.exports = { createApiKeyAuth };
