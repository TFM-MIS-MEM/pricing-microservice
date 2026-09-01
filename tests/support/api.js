'use strict';

/**
 * Helpers de invocación HTTP para los tests de contrato.
 *
 * Regla de oro: sólo se leen y se afirman campos **declarados en
 * `openapi/pricing.yaml`**. Nunca la envoltura que devuelve hoy el código —
 * adaptarse a la implementación actual es exactamente lo que dejaba a la suite
 * anterior sin capacidad de detectar desviaciones (véase tests/legacy/README.md).
 */

const request = require('supertest');
const Stripe = require('stripe');
const app = require('../../src/app');

/** Identificador con forma de ObjectId: es lo que propaga Kong en X-Account-Id. */
const ACCOUNT_ID = '507f1f77bcf86cd799439011';

/**
 * Cabeceras de identidad tal y como las escribe la pasarela.
 *
 * El plugin `space-auth` valida rol y canal contra estos mismos enums antes de
 * escribirlas, en `SpaceAuthHandler:access`, y borra las tres
 * incondicionalmente antes de cualquier bifurcación, de modo que un valor fuera
 * del enum no puede proceder de Kong: sólo de alguien que ha alcanzado el
 * servicio por su cuenta.
 *
 * `null` en cualquier campo omite esa cabecera.
 */
const gatewayHeaders = ({
  accountId = ACCOUNT_ID,
  channel = 'frontend',
  role = 'CUSTOMER',
} = {}) => {
  const headers = {};
  if (accountId !== null) headers['X-Account-Id'] = accountId;
  if (channel !== null) headers['X-Auth-Channel'] = channel;
  if (role !== null) headers['X-Role'] = role;
  return headers;
};

/** POST /v1/pricing/checkout/create-session */
const createSession = (body, identity) => {
  const req = request(app).post('/v1/pricing/checkout/create-session');
  Object.entries(gatewayHeaders(identity)).forEach(([name, value]) => req.set(name, value));
  return req.send(body);
};

/** Cuerpo conforme al contrato: `planId` es el enum, no un Price ID de Stripe. */
const VALID_SESSION_BODY = {
  planId: 'pro',
  successUrl: 'https://app.example.com/dashboard?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: 'https://app.example.com/pricing',
};

// ---------------------------------------------------------------------------
// Webhook de Stripe
// ---------------------------------------------------------------------------
//
// La firma NO se simula: se genera con el propio SDK, que es la única forma de
// ejercitar de verdad el camino del cuerpo crudo. `generateTestHeaderString`
// firma en local, sin red, de modo que la suite sigue sin alcanzar la cuenta
// real. Si algún día alguien reserializa el cuerpo antes de verificar —el error
// que el contrato advierte explícitamente—, estos tests se ponen rojos.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

let eventSequence = 0;
const stripeEvent = (type = 'customer.created', data = {}) => {
  eventSequence += 1;
  return {
    id: `evt_contract_${process.pid}_${eventSequence}`,
    object: 'event',
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object: data },
  };
};

/**
 * POST /v1/pricing/webhooks/stripe con firma válida.
 *
 * @param {object} event Evento a entregar.
 * @param {object} [options]
 * @param {string|null} [options.signature] Firma a enviar. Por defecto, una
 *   válida para el cuerpo. `null` omite la cabecera.
 * @param {object} [options.identity] Cabeceras de identidad a añadir; por
 *   defecto ninguna, que es como llega la petición de Stripe.
 */
const stripeWebhook = (event, { signature, identity = null } = {}) => {
  const payload = JSON.stringify(event);

  const header =
    signature === undefined
      ? stripe.webhooks.generateTestHeaderString({
          payload,
          secret: process.env.STRIPE_WEBHOOK_SECRET,
        })
      : signature;

  const req = request(app)
    .post('/v1/pricing/webhooks/stripe')
    .set('Content-Type', 'application/json');

  if (header !== null) req.set('Stripe-Signature', header);
  if (identity) {
    Object.entries(gatewayHeaders(identity)).forEach(([name, value]) => req.set(name, value));
  }

  // `.send(payload)` con el cuerpo ya serializado: supertest lo transmite tal
  // cual y el byte a byte es el que se firmó.
  return req.send(payload);
};

module.exports = {
  app,
  request,
  ACCOUNT_ID,
  gatewayHeaders,
  createSession,
  VALID_SESSION_BODY,
  stripeEvent,
  stripeWebhook,
};
