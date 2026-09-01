'use strict';

/**
 * Contrato de `createCheckoutSession` — POST /v1/pricing/checkout/create-session.
 *
 * Es la única operación del servicio que consume la identidad propagada por la
 * pasarela, y por tanto la implementación de referencia que copiará
 * `fr-commercial` (#65). De ahí que la mitad de este fichero sean casos de
 * identidad y no de negocio.
 *
 * DOBLE DE STRIPE: se corta en la frontera propia, `src/services/stripe.service`,
 * y no en el SDK ni en la red. El sujeto de un test de contrato es la superficie
 * HTTP —código de estado, forma de la respuesta, tratamiento de la identidad—,
 * y esa superficie está entera de este lado de la frontera. Cortar más abajo
 * obligaría a reproducir la forma del SDK (jest.mock('stripe')) o a levantar un
 * doble HTTP (nock) sin cubrir ni un camino más de `src/`. Con claves de relleno
 * y sin red en la CI, la llamada real terminaría además en un 500 que el
 * contrato ni siquiera declara.
 *
 * El webhook NO usa doble: allí la firma es real (véase stripe-webhook.test.js).
 */

jest.mock('../../src/services/stripe.service');

const api = require('../support/api');
const stripeService = require('../../src/services/stripe.service');

const SESSION = {
  sessionId: 'cs_test_a1b2c3',
  url: 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3',
};

beforeEach(() => {
  jest.clearAllMocks();
  stripeService.createCheckoutSession.mockResolvedValue(SESSION);
});

describe('POST /v1/pricing/checkout/create-session — camino feliz', () => {
  it('201 — devuelve la sesión creada', async () => {
    const res = await api.createSession(api.VALID_SESSION_BODY);

    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
  });

  it('201 — el canal de API recibe exactamente el mismo contrato', async () => {
    // Regla 1 de CLAUDE.md: el canal no se manifiesta en el endpoint. Una
    // petición que llega con X-Auth-Channel: api no puede ser rechazada aquí.
    const res = await api.createSession(api.VALID_SESSION_BODY, { channel: 'api' });

    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
  });

  it('201 — la sesión se crea para la cuenta que declara X-Account-Id', async () => {
    // Razón de ser de #65: la propiedad del recurso sale de la cabecera de la
    // pasarela, no de un claim que el servicio decodifique por su cuenta.
    await api.createSession(api.VALID_SESSION_BODY);

    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: api.ACCOUNT_ID }),
    );
  });

  it('201 — a la pasarela de pago le llega el precio del plan, no el plan', async () => {
    // El lado de la PETICIÓN no lo cubre `toSatisfyApiSpec()`, que sólo valida
    // respuestas. Si la traducción plan→precio no ocurriera —o el doble la
    // tapara— la respuesta seguiría siendo conforme y nadie se enteraría: la
    // única aserción posible es sobre los argumentos con que se llamó al doble.
    await api.createSession(api.VALID_SESSION_BODY);

    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: process.env.STRIPE_PRICE_PRO }),
    );
    expect(stripeService.createCheckoutSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ planId: 'pro' }),
    );
  });
});

describe('POST /v1/pricing/checkout/create-session — cuerpo', () => {
  it('400 — falta un campo obligatorio', async () => {
    const { planId, successUrl } = api.VALID_SESSION_BODY;

    const res = await api.createSession({ planId, successUrl });

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
  });

  it('400 — planId fuera del enum del contrato', async () => {
    // El Price ID de Stripe es justo lo que aceptaba la implementación anterior.
    const res = await api.createSession({
      ...api.VALID_SESSION_BODY,
      planId: 'price_1OqABC2eZvKYlo2CxYnOj3mI',
    });

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
  });

  it('400 PLAN_NOT_PURCHASABLE — el plan gratuito no tiene precio que cobrar', async () => {
    const res = await api.createSession({ ...api.VALID_SESSION_BODY, planId: 'free' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PLAN_NOT_PURCHASABLE');
    expect(res).toSatisfyApiSpec();
  });
});

describe('POST /v1/pricing/checkout/create-session — identidad de la pasarela', () => {
  /**
   * Las tres cabeceras son obligatorias y sus valores están cerrados. No es
   * rigor decorativo: `space-auth` las borra incondicionalmente y sólo las
   * escribe tras validar rol y canal contra estos mismos enums, en
   * `SpaceAuthHandler:access`, de modo que una petición sin ellas —o con un
   * valor que no está en el enum— no puede venir de Kong. Viene de alguien que ha
   * alcanzado el servicio directamente, y ese es precisamente el caso que no se
   * debe servir. Se responde 401 y no 403: no hay credencial válida a la que
   * negarle un permiso, no hay credencial en absoluto.
   */

  it('401 — sin X-Account-Id', async () => {
    const res = await api.createSession(api.VALID_SESSION_BODY, { accountId: null });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — sin X-Auth-Channel', async () => {
    const res = await api.createSession(api.VALID_SESSION_BODY, { channel: null });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — X-Auth-Channel con un valor fuera del enum', async () => {
    const res = await api.createSession(api.VALID_SESSION_BODY, { channel: 'mobile' });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — sin X-Role', async () => {
    const res = await api.createSession(api.VALID_SESSION_BODY, { role: null });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — X-Role con un valor fuera del enum', async () => {
    // RESEARCHER pertenece a la solución de investigación, que no se implementa.
    const res = await api.createSession(api.VALID_SESSION_BODY, { role: 'RESEARCHER' });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — la petición no llega a Stripe cuando la identidad no es válida', async () => {
    await api.createSession(api.VALID_SESSION_BODY, { accountId: null });

    expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
  });
});
