'use strict';

jest.mock('../../src/services/stripe.service');
jest.mock('jsonwebtoken');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const stripeService = require('../../src/services/stripe.service');

const VALID_USER = { id: 'user_123', email: 'test@example.com', role: 'user' };
const VALID_BODY = {
  planId: 'price_test123',
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
};

beforeEach(() => {
  jest.clearAllMocks();
  jwt.verify.mockReturnValue({ ...VALID_USER, iss: 'auth-microservice' });
});

describe('POST /api/v1/pricing/checkout/create-session', () => {
  it('returns 201 with checkout URL on success', async () => {
    stripeService.createCheckoutSession.mockResolvedValue('https://checkout.stripe.com/pay/cs_test');

    const res = await request(app)
      .post('/api/v1/pricing/checkout/create-session')
      .set('Authorization', 'Bearer valid.token')
      .send(VALID_BODY);

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.url).toBe('https://checkout.stripe.com/pay/cs_test');
    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith({
      userId: VALID_USER.id,
      planId: VALID_BODY.planId,
      successUrl: VALID_BODY.successUrl,
      cancelUrl: VALID_BODY.cancelUrl,
    });
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .post('/api/v1/pricing/checkout/create-session')
      .send(VALID_BODY);

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe('fail');
  });

  it('returns 401 when JWT is invalid', async () => {
    jwt.verify.mockImplementation(() => { throw new Error('invalid signature'); });

    const res = await request(app)
      .post('/api/v1/pricing/checkout/create-session')
      .set('Authorization', 'Bearer bad.token')
      .send(VALID_BODY);

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when planId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/pricing/checkout/create-session')
      .set('Authorization', 'Bearer valid.token')
      .send({ successUrl: VALID_BODY.successUrl, cancelUrl: VALID_BODY.cancelUrl });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when successUrl is not a valid URI', async () => {
    const res = await request(app)
      .post('/api/v1/pricing/checkout/create-session')
      .set('Authorization', 'Bearer valid.token')
      .send({ ...VALID_BODY, successUrl: 'not-a-url' });

    expect(res.statusCode).toBe(400);
  });

  it('forwards Stripe errors to the error handler', async () => {
    stripeService.createCheckoutSession.mockRejectedValue(
      Object.assign(new Error('Stripe error'), { statusCode: 500, isOperational: true })
    );

    const res = await request(app)
      .post('/api/v1/pricing/checkout/create-session')
      .set('Authorization', 'Bearer valid.token')
      .send(VALID_BODY);

    expect(res.statusCode).toBe(500);
  });
});
