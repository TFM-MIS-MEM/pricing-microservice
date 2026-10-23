'use strict';

const SubscriptionRecord = require('../models/SubscriptionRecord');
const IdempotencyKey = require('../models/IdempotencyKey');
const { retrieveSubscription } = require('./stripe.service');
const { setPlan } = require('./space.service');
const { planIdFor } = require('../config/plans');
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
 * Crea o actualiza el SubscriptionRecord de la cuenta. `client_reference_id`
 * lleva el `accountId` que se fijó al crear la sesión de pago.
 *
 * Después nova el contrato de la cuenta en SPACE al plan comprado (#51), que
 * sale del precio de la suscripción. Si SPACE falla, se lanza: el evento no
 * queda marcado y Stripe lo reintenta; el upsert del registro es idempotente.
 */
const handleCheckoutCompleted = async (session) => {
  const accountId = session.client_reference_id;
  const stripeCustomerId = session.customer;
  const stripeSubscriptionId = session.subscription;

  if (!accountId || !stripeSubscriptionId) {
    logger.warn('checkout.session.completed missing client_reference_id or subscription', {
      session,
    });
    return;
  }

  const subscription = await retrieveSubscription(stripeSubscriptionId);

  await SubscriptionRecord.findOneAndUpdate(
    { stripeSubscriptionId },
    {
      accountId,
      stripeCustomerId,
      stripeSubscriptionId,
      status: subscription.status,
      periodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    { upsert: true, new: true, runValidators: true },
  );

  logger.info(`SubscriptionRecord upserted for account ${accountId}`);

  const priceId = subscription.items?.data?.[0]?.price?.id;
  const planId = planIdFor(priceId);
  if (!planId) {
    // Un precio que no es de ningún plan es un catálogo desalineado: reintentar
    // no lo arregla, así que no se lanza. Se registra para verlo.
    logger.error(`checkout.session.completed with unknown price ${priceId}: plan not set in SPACE`);
    return;
  }
  await setPlan(accountId, planId);
};

/**
 * customer.subscription.deleted
 * Marks the subscription as canceled in the local record, and takes the
 * account back to FREE in SPACE (#51).
 */
const handleSubscriptionDeleted = async (subscription) => {
  const record = await SubscriptionRecord.findOneAndUpdate(
    { stripeSubscriptionId: subscription.id },
    { status: 'canceled', cancelAtPeriodEnd: false },
    { runValidators: true },
  );

  logger.info(`Subscription ${subscription.id} marked as canceled`);

  if (!record) {
    logger.warn(`customer.subscription.deleted for unknown subscription ${subscription.id}`);
    return;
  }
  await setPlan(record.accountId, 'free');
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
    { runValidators: true },
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
