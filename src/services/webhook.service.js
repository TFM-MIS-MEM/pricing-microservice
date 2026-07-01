'use strict';

const SubscriptionRecord = require('../models/SubscriptionRecord');
const IdempotencyKey = require('../models/IdempotencyKey');
const { retrieveSubscription } = require('./stripe.service');
const logger = require('../utils/logger');

/**
 * Returns true if the event has already been processed (duplicate webhook).
 * @param {string} eventId - Stripe event ID
 */
const isDuplicate = async (eventId) => {
  const existing = await IdempotencyKey.findOne({ key: eventId });
  return !!existing;
};

/**
 * Marks a Stripe event as processed to prevent future duplicates.
 * @param {string} eventId
 */
const markProcessed = async (eventId) => {
  await IdempotencyKey.create({ key: eventId });
};

// ---------------------
// Event Handlers
// ---------------------

/**
 * checkout.session.completed
 * Creates or updates the SubscriptionRecord for the user.
 */
const handleCheckoutCompleted = async (session) => {
  const userId = session.client_reference_id;
  const stripeCustomerId = session.customer;
  const stripeSubscriptionId = session.subscription;

  if (!userId || !stripeSubscriptionId) {
    logger.warn('checkout.session.completed missing client_reference_id or subscription', { session });
    return;
  }

  const subscription = await retrieveSubscription(stripeSubscriptionId);

  await SubscriptionRecord.findOneAndUpdate(
    { stripeSubscriptionId },
    {
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      status: subscription.status,
      periodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    { upsert: true, new: true, runValidators: true }
  );

  logger.info(`SubscriptionRecord upserted for user ${userId}`);
};

/**
 * customer.subscription.deleted
 * Marks the subscription as canceled in the local record.
 */
const handleSubscriptionDeleted = async (subscription) => {
  await SubscriptionRecord.findOneAndUpdate(
    { stripeSubscriptionId: subscription.id },
    { status: 'canceled', cancelAtPeriodEnd: false },
    { runValidators: true }
  );

  logger.info(`Subscription ${subscription.id} marked as canceled`);
};

/**
 * invoice.payment_failed
 * Marks the subscription as past_due in the local record.
 */
const handleInvoicePaymentFailed = async (invoice) => {
  const stripeSubscriptionId = invoice.subscription;
  if (!stripeSubscriptionId) return;

  await SubscriptionRecord.findOneAndUpdate(
    { stripeSubscriptionId },
    { status: 'past_due' },
    { runValidators: true }
  );

  logger.info(`Subscription ${stripeSubscriptionId} marked as past_due`);
};

// ---------------------
// Dispatcher
// ---------------------

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]);

/**
 * Processes a verified Stripe event with idempotency guarantees.
 *
 * @param {import('stripe').Stripe.Event} event
 * @returns {Promise<{ skipped: boolean }>}
 */
const processEvent = async (event) => {
  if (!HANDLED_EVENTS.has(event.type)) {
    return { skipped: true };
  }

  if (await isDuplicate(event.id)) {
    logger.info(`Duplicate webhook event ignored: ${event.id}`);
    return { skipped: true };
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object);
      break;
  }

  await markProcessed(event.id);
  return { skipped: false };
};

module.exports = { processEvent };
