
const express = require('express');
const request = require('supertest');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAnalyzeApiRouter } = require('../../src/routes/analyzeApi');

const validSpec = {
  openapi: '3.0.3',
  info: { title: 'Example API', version: '1.0.0' },
  paths: {},
};

describe('API analyzer failure handling', () => {
  it('returns 500 when the configured oasdiff executable is missing', async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));

    const originalUserProfile = process.env.USERPROFILE;
    const originalHome = process.env.HOME;
    const originalOasdiffPath = process.env.OASDIFF_PATH;

    const tempHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'analyzer-missing-executable-')
    );

    try {
      process.env.USERPROFILE = tempHome;
      process.env.HOME = tempHome;
      delete process.env.OASDIFF_PATH;

      app.use(
        '/admin/analyze',
        createAnalyzeApiRouter({
          adminApiKey: 'test-secret',
          logger: { error: () => {} },
        })
      );

      const response = await request(app)
        .post('/admin/analyze')
        .set('x-api-key', 'test-secret')
        .send({ oldSpec: validSpec, newSpec: validSpec });

      expect(response.status).toBe(500);
      expect(response.body.releaseDecision).toBeUndefined();
      expect(response.body.error).toBe(
        'Failed to analyze the OpenAPI specifications.'
      );
    } finally {
      if (originalUserProfile === undefined) {
        delete process.env.USERPROFILE;
      } else {
        process.env.USERPROFILE = originalUserProfile;
      }

      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }

      if (originalOasdiffPath === undefined) {
        delete process.env.OASDIFF_PATH;
      } else {
        process.env.OASDIFF_PATH = originalOasdiffPath;
      }

      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });
});
