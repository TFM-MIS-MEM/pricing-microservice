'use strict';

const { createCheckoutSession } = require('../services/stripe.service');

/**
 * POST /v1/pricing/checkout/create-session
 *
 * Creates a Stripe Checkout Session for a subscription.
 * The userId is extracted from the verified JWT (set by auth.middleware).
 */
const createSession = async (req, res, next) => {
  try {
    const { planId, successUrl, cancelUrl } = req.body;
    const userId = req.user.id;

    const url = await createCheckoutSession({ userId, planId, successUrl, cancelUrl });

    return res.status(201).json({ status: 'success', data: { url } });
  } catch (err) {
    return next(err);
  }
};

module.exports = { createSession };
