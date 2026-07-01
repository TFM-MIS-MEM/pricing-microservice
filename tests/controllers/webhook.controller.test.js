'use strict';

jest.mock('../../src/services/stripe.service');
jest.mock('../../src/services/webhook.service');

const request = require('supertest');
const app = require('../../src/app');
const stripeService = require('../../src/services/stripe.service');
const webhookService = require('../../src/services/webhook.service');

const FAKE_EVENT = { id: 'evt_test123', type: 'checkout.session.completed', data: { object: {} } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/v1/pricing/webhooks/stripe', () => {
  it('returns 200 when event is processed successfully', async () => {
    stripeService.constructWebhookEvent.mockReturnValue(FAKE_EVENT);
    webhookService.processEvent.mockResolvedValue({ skipped: false });

    const res = await request(app)
      .post('/api/v1/pricing/webhooks/stripe')
      .set('stripe-signature', 'valid_sig')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(FAKE_EVENT));

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.received).toBe(true);
    expect(stripeService.constructWebhookEvent).toHaveBeenCalled();
    expect(webhookService.processEvent).toHaveBeenCalledWith(FAKE_EVENT);
  });

  it('returns 200 when event is a duplicate (skipped)', async () => {
    stripeService.constructWebhookEvent.mockReturnValue(FAKE_EVENT);
    webhookService.processEvent.mockResolvedValue({ skipped: true });

    const res = await request(app)
      .post('/api/v1/pricing/webhooks/stripe')
      .set('stripe-signature', 'valid_sig')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(FAKE_EVENT));

    expect(res.statusCode).toBe(200);
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(app)
      .post('/api/v1/pricing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(FAKE_EVENT));

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/stripe-signature/i);
  });

  it('returns 400 when Stripe signature validation fails', async () => {
    const sigError = Object.assign(new Error('Invalid signature'), { statusCode: 400, isOperational: true });
    stripeService.constructWebhookEvent.mockImplementation(() => { throw sigError; });

    const res = await request(app)
      .post('/api/v1/pricing/webhooks/stripe')
      .set('stripe-signature', 'bad_sig')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(FAKE_EVENT));

    expect(res.statusCode).toBe(400);
  });

  it('forwards processing errors to the error handler', async () => {
    stripeService.constructWebhookEvent.mockReturnValue(FAKE_EVENT);
    webhookService.processEvent.mockRejectedValue(
      Object.assign(new Error('DB error'), { statusCode: 500, isOperational: true })
    );

    const res = await request(app)
      .post('/api/v1/pricing/webhooks/stripe')
      .set('stripe-signature', 'valid_sig')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(FAKE_EVENT));

    expect(res.statusCode).toBe(500);
  });
});
