
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApiKeyAuth } = require('../middleware/auth');
const { compareOpenApiSpecs } = require('../analyzer/openapiDiff');
const { parseOasdiffOutput } = require('../analyzer/reportParser');

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

  router.post('/', apiKeyAuth, (req, res) => {
    const { oldSpec, newSpec } = req.body || {};

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

    let tempDir;

    try {
      tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'api-change-analyzer-')
      );

      const oldSpecPath = path.join(tempDir, 'old.json');
      const newSpecPath = path.join(tempDir, 'new.json');

      fs.writeFileSync(oldSpecPath, JSON.stringify(oldSpec), 'utf8');
      fs.writeFileSync(newSpecPath, JSON.stringify(newSpec), 'utf8');

      const result = compareOpenApiSpecs(oldSpecPath, newSpecPath);

      const releaseDecision = result.hasBreakingChanges
        ? 'BLOCKED'
        : 'SAFE';

      return res.status(200).json({
        hasBreakingChanges: result.hasBreakingChanges,
        releaseDecision,
        output: result.output,
        report: parseOasdiffOutput(result.output),
      });
    } catch (error) {
      logger.error('API analysis failed:', error.message);

      return res.status(500).json({
        error: 'Failed to analyze the OpenAPI specifications.',
      });
    } finally {
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  return router;
};

module.exports = { createAnalyzeApiRouter };
