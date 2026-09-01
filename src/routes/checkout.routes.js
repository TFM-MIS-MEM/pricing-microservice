'use strict';

const { Router } = require('express');
const Joi = require('joi');
const validate = require('../middlewares/validate');
const { PLAN_IDS } = require('../config/plans');
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
    // El contrato declara `planId` como enum, no como Price ID de Stripe: la
    // correspondencia con el precio es asunto del servicio (véase config/plans).
    planId: Joi.string()
      .valid(...PLAN_IDS)
      .required()
      .description('Plan del contrato: free | pro | business'),
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

router.post('/create-session', authenticate, validate(createSessionSchema), createSession);

module.exports = router;
