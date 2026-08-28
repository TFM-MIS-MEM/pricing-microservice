'use strict';

const { constructWebhookEvent } = require('../services/stripe.service');
const { processEvent } = require('../services/webhook.service');
const logger = require('../utils/logger');

/**
 * POST /v1/pricing/webhooks/stripe
 *
 * Receives raw Stripe webhook events. Validates the signature and dispatches
 * to the appropriate handler. Always returns 200 OK to prevent Stripe retries
 * on business-logic errors (idempotency, unknown event types, etc.).
 */
const handleWebhook = async (req, res, next) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).json({ status: 'fail', message: 'Missing stripe-signature header' });
  }

  let event;
  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    return next(err);
  }

  try {
    const { skipped } = await processEvent(event);
    logger.info(`Webhook ${event.type} [${event.id}] — skipped: ${skipped}`);
    return res.status(200).json({ status: 'success', received: true });
  } catch (err) {
    logger.error(`Webhook handler error for ${event.type}: ${err.message}`);
    return next(err);
  }
};

module.exports = { handleWebhook };
