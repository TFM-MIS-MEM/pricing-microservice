'use strict';

/**
 * `space.service.setPlan` (#51): dejar una cuenta en un plan de SPACE.
 *
 * `fetch` doblado: estas pruebas fijan qué se le pide a SPACE y qué se hace con
 * cada respuesta. Lo que SPACE responde de verdad se midió en el estudio de la
 * sesión 22 (`PUT /contracts/{id}` → 200 o 404; `POST /contracts` → 201 o 409).
 */

const { setPlan, SpaceError } = require('../../src/services/space.service');

const ACCOUNT = '66f0000000000000000000a1';

const reply = (status, body = {}) =>
  Promise.resolve({ status, text: () => Promise.resolve(JSON.stringify(body)) });

const sent = (call) => ({
  url: call[0],
  method: call[1].method,
  key: call[1].headers['x-api-key'],
  body: JSON.parse(call[1].body),
});

describe('space.service.setPlan', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('nova el contrato al plan, sin complementos', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockReturnValueOnce(reply(200));

    await setPlan(ACCOUNT, 'pro');

    const call = sent(fetch.mock.calls[0]);
    expect(call.url).toBe(`http://space.invalid:3000/api/v1/contracts/${ACCOUNT}`);
    expect(call.method).toBe('PUT');
    expect(call.key).toBe(process.env.SPACE_API_KEY);
    expect(call.body.subscriptionPlans).toEqual({ frsaas: 'PRO' });
    expect(call.body.subscriptionAddOns).toEqual({});
  });

  it('sin contrato todavía, lo crea con ese plan', async () => {
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockReturnValueOnce(reply(404, { error: 'Contract not found' }))
      .mockReturnValueOnce(reply(201));

    await setPlan(ACCOUNT, 'business');

    const create = sent(fetch.mock.calls[1]);
    expect(create.method).toBe('POST');
    expect(create.url).toBe('http://space.invalid:3000/api/v1/contracts');
    expect(create.body.userContact.userId).toBe(ACCOUNT);
    expect(create.body.subscriptionPlans).toEqual({ frsaas: 'BUSINESS' });
    expect(create.body.billingPeriod).toEqual({ autoRenew: true, renewalDays: 30 });
  });

  it('si otra petición lo crea a la vez (409), nova', async () => {
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockReturnValueOnce(reply(404))
      .mockReturnValueOnce(reply(409))
      .mockReturnValueOnce(reply(200));

    await setPlan(ACCOUNT, 'free');

    expect(fetch.mock.calls.map((c) => c[1].method)).toEqual(['PUT', 'POST', 'PUT']);
    expect(sent(fetch.mock.calls[2]).body.subscriptionPlans).toEqual({ frsaas: 'FREE' });
  });

  it('lanza si SPACE responde un error, para que Stripe reintente', async () => {
    jest.spyOn(global, 'fetch').mockReturnValueOnce(reply(500, { error: 'boom' }));

    await expect(setPlan(ACCOUNT, 'pro')).rejects.toThrow(SpaceError);
  });

  it('lanza si SPACE no responde', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(setPlan(ACCOUNT, 'pro')).rejects.toThrow(SpaceError);
  });

  it('rechaza un plan que no es de la tarifa', async () => {
    const fetch = jest.spyOn(global, 'fetch');

    await expect(setPlan(ACCOUNT, 'enterprise')).rejects.toThrow(SpaceError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
