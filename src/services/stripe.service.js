'use strict';

const Stripe = require('stripe');
const config = require('../config');
const AppError = require('../utils/AppError');

const stripe = new Stripe(config.stripe.secretKey);

/**
 * Crea una sesión de pago para una suscripción.
 *
 * Recibe el Price ID ya resuelto: la correspondencia plan→precio es del dominio
 * y vive en `config/plans`, no aquí.
 *
 * @param {object} params
 * @param {string} params.accountId  - Cuenta propietaria, tomada de X-Account-Id.
 *                                     Viaja como `client_reference_id` para poder
 *                                     recuperarla al recibir el evento.
 * @param {string} params.priceId    - Price ID de la pasarela de pago.
 * @param {string} params.successUrl - Redirección tras el pago
 * @param {string} params.cancelUrl  - Redirección si se cancela
 * @returns {Promise<{sessionId: string, url: string}>}
 */
const createCheckoutSession = async ({ accountId, priceId, successUrl, cancelUrl }) => {
  if (!config.stripe.secretKey) {
    throw new AppError('Stripe is not configured', 500);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: accountId,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return { sessionId: session.id, url: session.url };
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
    // 401 y no 400: la firma es la credencial con la que se autentica el evento
    // —esta ruta va sin `space-auth` justamente por eso—, así que una firma que
    // no verifica es una credencial inválida, no una petición malformada. Es lo
    // que declara el contrato, que reserva su 400 para el cuerpo o la cabecera
    // ausentes.
    throw new AppError('The event signature does not verify', 401, 'INVALID_SIGNATURE');
  }
};

/**
 * Fetches a Stripe Subscription object by ID.
 * Used inside checkout.session.completed to get billing details.
 *
 * @param {string} subscriptionId
 * @returns {Promise<import('stripe').Stripe.Subscription>}
 */
const retrieveSubscription = (subscriptionId) => stripe.subscriptions.retrieve(subscriptionId);

module.exports = { createCheckoutSession, constructWebhookEvent, retrieveSubscription };
