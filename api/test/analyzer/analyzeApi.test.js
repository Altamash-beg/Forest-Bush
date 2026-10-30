const express = require('express');
const request = require('supertest');
const AdmZip = require('adm-zip');
const { createAnalyzeApiRouter } = require('../../src/routes/analyzeApi');

const createTestApp = (adminApiKey = 'test-secret') => {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(
    '/admin/analyze',
    createAnalyzeApiRouter({ adminApiKey })
  );

  return app;
};

const validSpec = {
  openapi: '3.0.3',
  info: { title: 'Example API', version: '1.0.0' },
  paths: {},
};
const createSourceZip = () => {
  const zip = new AdmZip();

  zip.addFile(
    'src/users.js',
    Buffer.from(`
      fetch('/users/123');
      axios.get('/users/456');
    `)
  );

  return zip.toBuffer();
};

describe('API analyzer endpoint', () => {
  it('returns 503 when the API key is not configured', async () => {
    const response = await request(createTestApp(null))
      .post('/admin/analyze')
      .send({});

    expect(response.status).toBe(503);
  });

  it('rejects a request without an API key', async () => {
    const response = await request(createTestApp())
      .post('/admin/analyze')
      .send({});

    expect(response.status).toBe(401);
  });

  it('rejects an incorrect API key', async () => {
    const response = await request(createTestApp())
      .post('/admin/analyze')
      .set('x-api-key', 'wrong-secret')
      .send({});

    expect(response.status).toBe(403);
  });

  it('rejects missing OpenAPI specifications', async () => {
    const response = await request(createTestApp())
      .post('/admin/analyze')
      .set('x-api-key', 'test-secret')
      .send({});

    expect(response.status).toBe(400);
  });

  it('compares valid OpenAPI specifications', async () => {
    const response = await request(createTestApp())
      .post('/admin/analyze')
      .set('x-api-key', 'test-secret')
      .send({
        oldSpec: validSpec,
        newSpec: {
          ...validSpec,
          info: { title: 'Example API', version: '1.1.0' },
        },
      });

expect(response.status).toBe(200);
expect(response.body.hasBreakingChanges).toBe(false);
expect(response.body.releaseDecision).toBe('SAFE');

// Verify the structured report for a safe release.
expect(response.body.report).toBeDefined();
expect(response.body.report.summary).toBeDefined();
expect(response.body.report.summary.errors).toBe(0);
expect(response.body.report.changes).toBeInstanceOf(Array);
expect(response.body.report.changes).toHaveLength(0);
  });

  it('detects breaking changes through the API endpoint', async () => {
    const oldSpec = {
      openapi: '3.0.3',
      info: { title: 'Users API', version: '1.0.0' },
      paths: {
        '/users/{user_id}': {
          get: {
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const newSpec = {
      ...oldSpec,
      info: { title: 'Users API', version: '1.1.0' },
      paths: {
        ...oldSpec.paths,
        '/users/{user_id}': {
          ...oldSpec.paths['/users/{user_id}'],
          get: {
            ...oldSpec.paths['/users/{user_id}'].get,
            responses: {
              '200': {
                ...oldSpec.paths['/users/{user_id}'].get.responses['200'],
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const response = await request(createTestApp())
      .post('/admin/analyze')
      .set('x-api-key', 'test-secret')
      .send({ oldSpec, newSpec });

    expect(response.status).toBe(200);
    expect(response.body.hasBreakingChanges).toBe(true);
    expect(response.body.output).toContain(
      'response-property-type-changed'
    );
    expect(response.body.releaseDecision).toBe('BLOCKED');

    

    // Verify the structured report identifies the breaking change.
    expect(response.body.report).toBeDefined();
    expect(response.body.report.summary.errors).toBeGreaterThan(0);
    expect(response.body.report.changes.length).toBeGreaterThan(0);
    expect(response.body.report.changes[0]).toMatchObject({
      ruleId: 'response-property-type-changed',
      severity: 'error',
      method: 'GET',
      path: '/users/{user_id}',
      oldValue: 'integer',
      newValue: 'string',
      statusCode: '200',
    });
  });
  it('scans an uploaded ZIP and identifies potentially affected files', async () => {
  const oldSpec = {
    openapi: '3.0.3',
    info: { title: 'Users API', version: '1.0.0' },
    paths: {
      '/users/{user_id}': {
        get: {
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const newSpec = {
    ...oldSpec,
    info: { title: 'Users API', version: '1.1.0' },
    paths: {
      ...oldSpec.paths,
      '/users/{user_id}': {
        ...oldSpec.paths['/users/{user_id}'],
        get: {
          ...oldSpec.paths['/users/{user_id}'].get,
          responses: {
            '200': {
              ...oldSpec.paths['/users/{user_id}'].get.responses['200'],
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const response = await request(createTestApp())
    .post('/admin/analyze')
    .set('x-api-key', 'test-secret')
    .field('oldSpec', JSON.stringify(oldSpec))
    .field('newSpec', JSON.stringify(newSpec))
    .attach('sourceZip', createSourceZip(), {
      filename: 'source.zip',
      contentType: 'application/zip',
    });

  expect(response.status).toBe(200);
  expect(response.body.releaseDecision).toBe('BLOCKED');

  expect(response.body.sourceAnalysis).toBeDefined();
  expect(response.body.sourceAnalysis.totalFilesScanned).toBe(1);
  expect(response.body.sourceAnalysis.totalApiCalls).toBe(2);
  expect(response.body.sourceAnalysis.affectedFiles).toHaveLength(2);

  expect(
    response.body.sourceAnalysis.affectedFiles[0].filePath
  ).toBe('src/users.js');
});
});
