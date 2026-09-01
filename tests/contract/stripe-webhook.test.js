'use strict';

/**
 * Contrato de `handleStripeWebhook` — POST /v1/pricing/webhooks/stripe.
 *
 * Aquí NO hay doble de Stripe: la firma se genera con el propio SDK sobre el
 * cuerpo que se transmite. Es la única manera de ejercitar lo que el contrato
 * advierte —«la verificación debe realizarse sobre el cuerpo crudo, no sobre el
 * JSON reserializado»—: con la firma simulada, reserializar el cuerpo pasaría
 * inadvertido. `generateTestHeaderString` firma en local, sin red.
 *
 * El 200 de esta operación se declara SIN `content`. Comprobado empíricamente:
 * `toSatisfyApiSpec()` exige entonces que el cuerpo sea vacío y rechaza tanto un
 * JSON como texto plano con «response must be null».
 */

const api = require('../support/api');
const db = require('../support/db');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('POST /v1/pricing/webhooks/stripe', () => {
  it('200 — evento firmado que el servicio no maneja', async () => {
    const res = await api.stripeWebhook(api.stripeEvent('customer.created'));

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
  });

  it('200 — el mismo evento entregado dos veces (idempotencia)', async () => {
    // La pasarela de pago reenvía. El contrato apoya la idempotencia en la
    // colección de claves, de modo que la segunda entrega no puede fallar ni
    // volver a escribir estado.
    const event = api.stripeEvent('customer.subscription.deleted', {
      id: 'sub_contract_duplicada',
      status: 'canceled',
    });

    const first = await api.stripeWebhook(event);
    const second = await api.stripeWebhook(event);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second).toSatisfyApiSpec();
  });

  it('200 — la ruta es alcanzable sin las cabeceras de identidad', async () => {
    // Stripe no lleva credencial de la plataforma: se autentica con la firma del
    // propio evento. Kong deja esta ruta fuera de `space-auth` justamente por
    // eso (kong.yml, pricing-webhook-route), así que el middleware de identidad
    // NO debe montarse sobre ella. Si algún día se monta, este test lo dice.
    const res = await api.stripeWebhook(api.stripeEvent('customer.created'));

    expect(res.status).not.toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('400 — sin la cabecera Stripe-Signature', async () => {
    const res = await api.stripeWebhook(api.stripeEvent(), { signature: null });

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — firma que no corresponde al cuerpo', async () => {
    // Una firma presente pero que no verifica es una credencial inválida, no una
    // petición malformada: el contrato la declara 401.
    const res = await api.stripeWebhook(api.stripeEvent(), {
      signature: 't=1700000000,v1=0000000000000000000000000000000000000000000000000000000000000000',
    });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — firma válida para OTRO cuerpo (reserialización)', async () => {
    // Firma correcta, calculada sobre un cuerpo distinto del que viaja. Es el
    // caso que se cuela si alguien verifica sobre el JSON reserializado.
    const otherPayload = JSON.stringify(api.stripeEvent('customer.created'));
    const stripe = new (require('stripe'))(process.env.STRIPE_SECRET_KEY);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: otherPayload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    const res = await api.stripeWebhook(api.stripeEvent('customer.created'), { signature });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });
});
