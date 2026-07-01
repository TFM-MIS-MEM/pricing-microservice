'use strict';

const Stripe = require('stripe');
const config = require('../config');
const AppError = require('../utils/AppError');

const stripe = new Stripe(config.stripe.secretKey);

/**
 * Creates a Stripe Checkout Session for a subscription.
 *
 * @param {object} params
 * @param {string} params.userId     - Platform user ID (stored as client_reference_id for webhook recovery)
 * @param {string} params.planId     - Stripe Price ID. Until Issue #13 (SPACE integration), the client
 *                                     provides the Stripe Price ID directly.
 * @param {string} params.successUrl - Redirect URL on successful payment
 * @param {string} params.cancelUrl  - Redirect URL on cancelled payment
 * @returns {Promise<string>} Stripe hosted checkout URL
 */
const createCheckoutSession = async ({ userId, planId, successUrl, cancelUrl }) => {
  if (!config.stripe.secretKey) {
    throw new AppError('Stripe is not configured', 500);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: planId, quantity: 1 }],
    client_reference_id: userId,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session.url;
};

/**
 * Validates a raw Stripe webhook payload against the request signature.
 *
 * @param {Buffer} rawBody
 * @param {string} signature - Value of the `stripe-signature` header
 * @returns {import('stripe').Stripe.Event}
 */
const constructWebhookEvent = (rawBody, signature) => {
  if (!config.stripe.webhookSecret) {
    throw new AppError('Stripe webhook secret is not configured', 500);
  }

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
  } catch {
    throw new AppError('Invalid Stripe webhook signature', 400);
  }
};

/**
 * Fetches a Stripe Subscription object by ID.
 * Used inside checkout.session.completed to get billing details.
 *
 * @param {string} subscriptionId
 * @returns {Promise<import('stripe').Stripe.Subscription>}
 */
const retrieveSubscription = (subscriptionId) =>
  stripe.subscriptions.retrieve(subscriptionId);

module.exports = { createCheckoutSession, constructWebhookEvent, retrieveSubscription };
