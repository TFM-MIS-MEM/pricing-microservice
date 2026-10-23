'use strict';

/**
 * El receptor de Stripe nova el contrato de SPACE (#51).
 *
 * `processEvent` directamente, con Stripe y SPACE doblados: la suite de
 * contrato del webhook (tests/contract/stripe-webhook.test.js) no puede llegar
 * hasta aquí, porque `checkout.session.completed` necesita una suscripción real
 * que recuperar.
 */

jest.mock('../../src/services/stripe.service', () => ({ retrieveSubscription: jest.fn() }));
jest.mock('../../src/services/space.service', () => ({ setPlan: jest.fn() }));

const { retrieveSubscription } = require('../../src/services/stripe.service');
const { setPlan } = require('../../src/services/space.service');
const { processEvent } = require('../../src/services/webhook.service');
const IdempotencyKey = require('../../src/models/IdempotencyKey');
const SubscriptionRecord = require('../../src/models/SubscriptionRecord');
const db = require('../support/db');

const ACCOUNT = '66f0000000000000000000a1';

const subscription = (priceId) => ({
  status: 'active',
  current_period_end: 1_800_000_000,
  cancel_at_period_end: false,
  items: { data: [{ price: { id: priceId } }] },
});

const checkout = (id) => ({
  id,
  type: 'checkout.session.completed',
  data: {
    object: { client_reference_id: ACCOUNT, customer: 'cus_1', subscription: 'sub_1' },
  },
});

beforeAll(db.connect);
afterEach(async () => {
  jest.clearAllMocks();
  await db.clear();
});
afterAll(db.disconnect);

describe('checkout.session.completed', () => {
  it.each([
    ['price_placeholder_pro', 'pro'],
    ['price_placeholder_business', 'business'],
  ])('con el precio %s, nova la cuenta a %s', async (priceId, planId) => {
    retrieveSubscription.mockResolvedValue(subscription(priceId));

    await processEvent(checkout(`evt_${planId}`));

    expect(setPlan).toHaveBeenCalledWith(ACCOUNT, planId);
  });

  it('si SPACE falla, el evento no queda procesado y Stripe lo reintentará', async () => {
    retrieveSubscription.mockResolvedValue(subscription('price_placeholder_pro'));
    setPlan.mockRejectedValueOnce(new Error('SPACE answered 500'));

    await expect(processEvent(checkout('evt_falla'))).rejects.toThrow('SPACE');
    expect(await IdempotencyKey.exists({ key: 'evt_falla' })).toBeNull();

    // El reintento termina el trabajo.
    await processEvent(checkout('evt_falla'));
    expect(setPlan).toHaveBeenCalledTimes(2);
    expect(await IdempotencyKey.exists({ key: 'evt_falla' })).not.toBeNull();
  });

  it('un precio que no es de ningún plan no toca SPACE', async () => {
    retrieveSubscription.mockResolvedValue(subscription('price_de_otro_catalogo'));

    await processEvent(checkout('evt_otro'));

    expect(setPlan).not.toHaveBeenCalled();
  });
});

describe('customer.subscription.deleted', () => {
  it('devuelve la cuenta a FREE', async () => {
    await SubscriptionRecord.create({
      accountId: ACCOUNT,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      status: 'active',
      periodEnd: new Date(),
    });

    await processEvent({
      id: 'evt_baja',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1' } },
    });

    expect(setPlan).toHaveBeenCalledWith(ACCOUNT, 'free');
  });

  it('una suscripción que no conocemos no toca SPACE', async () => {
    await processEvent({
      id: 'evt_ajena',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_desconocida' } },
    });

    expect(setPlan).not.toHaveBeenCalled();
  });
});
