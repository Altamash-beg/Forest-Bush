
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const multer = require('multer');

const { createApiKeyAuth } = require('../middleware/auth');
const { compareOpenApiSpecs } = require('../analyzer/openapiDiff');
const { parseOasdiffOutput } = require('../analyzer/reportParser');

const {
  readSourceFilesFromZip,
  detectApiCalls,
  findAffectedFiles,
} = require('../analyzer/sourceScanner');

const createAnalyzeApiRouter = ({
  adminApiKey,
  logger = console,
} = {}) => {
  const router = express.Router();

  // Fail closed if the analyzer has no configured API key.
  if (!adminApiKey) {
    router.post('/', (req, res) => {
      return res.status(503).json({
        error:
          'API analyzer is unavailable because its API key is not configured.',
      });
    });

    return router;
  }

  const apiKeyAuth = createApiKeyAuth({ adminApiKey, logger });

  // Configure ZIP upload.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
    fileFilter: (req, file, callback) => {
      if (!file.originalname.toLowerCase().endsWith('.zip')) {
        return callback(new Error('Only ZIP files are allowed.'));
      }

      callback(null, true);
    },
  });

  // Handle upload errors explicitly.
  const handleZipUpload = (req, res, next) => {
    upload.single('sourceZip')(req, res, (error) => {
      if (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'ZIP file must not exceed 10 MB.',
          });
        }

        return res.status(400).json({
          error: error.message || 'Invalid file upload.',
        });
      }

      next();
    });
  };

  router.post(
    '/',
    apiKeyAuth,
    handleZipUpload,
    (req, res) => {
      let { oldSpec, newSpec } = req.body || {};

      // Multipart form fields arrive as strings.
      try {
        if (typeof oldSpec === 'string') {
          oldSpec = JSON.parse(oldSpec);
        }

        if (typeof newSpec === 'string') {
          newSpec = JSON.parse(newSpec);
        }
      } catch {
        return res.status(400).json({
          error: 'OpenAPI specifications must contain valid JSON.',
        });
      }

      const isValidSpec = (spec) =>
        spec !== null &&
        typeof spec === 'object' &&
        !Array.isArray(spec) &&
        typeof spec.openapi === 'string' &&
        spec.info !== null &&
        typeof spec.info === 'object' &&
        typeof spec.info.title === 'string' &&
        typeof spec.info.version === 'string' &&
        spec.paths !== null &&
        typeof spec.paths === 'object' &&
        !Array.isArray(spec.paths);

      if (!isValidSpec(oldSpec) || !isValidSpec(newSpec)) {
        return res.status(400).json({
          error:
            'Both oldSpec and newSpec must be valid OpenAPI objects containing openapi, info.title, info.version, and paths.',
        });
      }

      // Analyze uploaded source code, if provided.
      let sourceAnalysis = null;

      if (req.file) {
        try {
          const sourceFiles = readSourceFilesFromZip(
            req.file.buffer
          );

          const apiCalls = detectApiCalls(sourceFiles);

          sourceAnalysis = {
            totalFilesScanned: sourceFiles.length,
            totalApiCalls: apiCalls.length,
            affectedFiles: [],
          };
        } catch (error) {
          logger.warn('Source ZIP analysis failed:', error.message);

          return res.status(400).json({
            error: 'Unable to read the uploaded ZIP file.',
          });
        }
      }

      let tempDir;

      try {
        tempDir = fs.mkdtempSync(
          path.join(os.tmpdir(), 'api-change-analyzer-')
        );

        const oldSpecPath = path.join(tempDir, 'old.json');
        const newSpecPath = path.join(tempDir, 'new.json');

        fs.writeFileSync(
          oldSpecPath,
          JSON.stringify(oldSpec),
          'utf8'
        );

        fs.writeFileSync(
          newSpecPath,
          JSON.stringify(newSpec),
          'utf8'
        );

        const result = compareOpenApiSpecs(
          oldSpecPath,
          newSpecPath
        );

        const report = parseOasdiffOutput(result.output);

        const releaseDecision = result.hasBreakingChanges
          ? 'BLOCKED'
          : 'SAFE';

        // Match detected API calls against breaking changes.
        if (sourceAnalysis) {
          const sourceFiles = readSourceFilesFromZip(
            req.file.buffer
          );

          const apiCalls = detectApiCalls(sourceFiles);

          sourceAnalysis.affectedFiles = findAffectedFiles(
            apiCalls,
            report.changes.filter(
              (change) => change.severity === 'error'
            )
          );
        }

        return res.status(200).json({
          hasBreakingChanges: result.hasBreakingChanges,
          releaseDecision,
          output: result.output,
          report,
          sourceAnalysis,
        });
      } catch (error) {
        logger.error('API analysis failed:', error.message);

        return res.status(500).json({
          error: 'Failed to analyze the OpenAPI specifications.',
        });
      } finally {
        if (tempDir) {
          fs.rmSync(tempDir, {
            recursive: true,
            force: true,
          });
        }
      }
    }
  );

  return router;
};

module.exports = { createAnalyzeApiRouter };
