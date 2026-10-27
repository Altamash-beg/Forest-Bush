const express = require('express');
const request = require('supertest');
const { createApiKeyAuth } = require('../src/middleware/auth');

describe('createApiKeyAuth', () => {
  it('returns 503 when the admin API key is not configured', async () => {
    const app = express();
    const logger = { error: vi.fn(), warn: vi.fn() };

    app.get(
      '/admin',
      createApiKeyAuth({ adminApiKey: '', logger }),
      (req, res) => res.status(200).json({ success: true })
    );

    const response = await request(app).get('/admin');

    expect(response.status).toBe(503);
    expect(response.body.error).toContain('not configured');
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns 401 when the API key is missing', async () => {
    const app = express();

    app.get(
      '/admin',
      createApiKeyAuth({
        adminApiKey: 'test-admin-key',
        logger: { error: vi.fn(), warn: vi.fn() },
      }),
      (req, res) => res.status(200).json({ success: true })
    );

    const response = await request(app).get('/admin');

    expect(response.status).toBe(401);
  });

  it('returns 403 when the API key is incorrect', async () => {
    const app = express();

    app.get(
      '/admin',
      createApiKeyAuth({
        adminApiKey: 'test-admin-key',
        logger: { error: vi.fn(), warn: vi.fn() },
      }),
      (req, res) => res.status(200).json({ success: true })
    );

    const response = await request(app)
      .get('/admin')
      .set('x-api-key', 'wrong-key');

    expect(response.status).toBe(403);
  });

  it('allows a request with the correct API key', async () => {
    const app = express();

    app.get(
      '/admin',
      createApiKeyAuth({
        adminApiKey: 'test-admin-key',
        logger: { error: vi.fn(), warn: vi.fn() },
      }),
      (req, res) => res.status(200).json({ success: true })
    );

    const response = await request(app)
      .get('/admin')
      .set('x-api-key', 'test-admin-key');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
