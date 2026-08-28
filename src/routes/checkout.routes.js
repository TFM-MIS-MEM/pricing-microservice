'use strict';

const { Router } = require('express');
const Joi = require('joi');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth.middleware');
const { createSession } = require('../controllers/checkout.controller');

const router = Router();

// Joi's .uri() follows strict RFC 3986 and rejects Stripe's unescaped template
// placeholders (e.g. {CHECKOUT_SESSION_ID} in successUrl), which Stripe itself
// requires literally so it can substitute the real session ID on redirect.
// The WHATWG URL parser accepts them, so we validate with that instead.
const isUrl = (value, helpers) => {
  try {
    new URL(value);
    return value;
  } catch {
    return helpers.error('string.uri');
  }
};

const createSessionSchema = {
  body: Joi.object({
    planId: Joi.string().required().description('Stripe Price ID of the plan to subscribe to'),
    successUrl: Joi.string()
      .custom(isUrl)
      .required()
      .description(
        'Redirect URL after successful payment. May include Stripe template placeholders, e.g. {CHECKOUT_SESSION_ID}.',
      ),
    cancelUrl: Joi.string()
      .custom(isUrl)
      .required()
      .description('Redirect URL when payment is cancelled'),
  }),
};

/**
 * @openapi
 * /v1/pricing/checkout/create-session:
 *   post:
 *     tags:
 *       - Checkout
 *     summary: Create a Stripe Checkout Session
 *     description: >
 *       Creates a hosted Stripe Checkout Session for a subscription plan.
 *       The caller must supply a valid JWT issued by auth-microservice.
 *       Returns a Stripe-hosted URL to redirect the user to complete payment.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - successUrl
 *               - cancelUrl
 *             properties:
 *               planId:
 *                 type: string
 *                 description: Stripe Price ID of the plan (e.g. price_xxx). SPACE integration will resolve plan slugs in Issue #13.
 *                 example: price_1OqABC2eZvKYlo2CxYnOj3mI
 *               successUrl:
 *                 type: string
 *                 format: uri
 *                 example: https://app.example.com/dashboard?session_id={CHECKOUT_SESSION_ID}
 *               cancelUrl:
 *                 type: string
 *                 format: uri
 *                 example: https://app.example.com/pricing
 *     responses:
 *       201:
 *         description: Checkout session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       format: uri
 *                       description: Stripe-hosted checkout URL to redirect the user to
 *                       example: https://checkout.stripe.com/pay/cs_test_xxx
 *       400:
 *         description: Validation error
 *       401:
 *         description: Missing or invalid JWT
 *       500:
 *         description: Stripe configuration error or internal error
 */
router.post('/create-session', authenticate, validate(createSessionSchema), createSession);

module.exports = router;
