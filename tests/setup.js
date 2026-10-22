'use strict';

/**
 * Preparación de la suite — se ejecuta antes de cada fichero de test
 * (`setupFilesAfterEnv`).
 *
 * Hace dos cosas:
 *
 *  1. Fija el entorno antes de que `src/config` lea `.env`. `dotenv` no
 *     sobrescribe lo que ya está en `process.env`, de modo que lo definido aquí
 *     gana aunque exista el fichero. Es lo que impide que la suite alcance la
 *     cuenta real de Stripe: la clave es de relleno.
 *
 *     `src/services/stripe.service.js` construye el cliente **al cargar el
 *     módulo**, así que sin clave el `require` lanza «Neither apiKey nor
 *     config.authenticator provided» y las suites ni siquiera arrancan.
 *
 *     Ya no se define el secreto de firma de `auth`: desde #65 el servicio no
 *     verifica ningún token. Si alguna vez volviera a hacer falta aquí, el
 *     cambio de #65 estaría a medias.
 *
 *  2. Registra el matcher `toSatisfyApiSpec` contra `openapi/pricing.yaml`.
 *     A partir de ahí es la especificación —y no el código— la que decide si
 *     una respuesta es correcta: el contrato NO se reescribe en los tests.
 */

const path = require('path');
const jestOpenAPI = require('jest-openapi').default;

process.env.NODE_ENV = 'test';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder_para_la_bateria_de_pruebas';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder_para_la_bateria_de_pruebas';
process.env.INTERNAL_API_SECRET = 'internal_placeholder_para_la_bateria_de_pruebas';

// `src/config/plans.js` se niega a cargar sin los precios de los planes de pago:
// el servicio no arranca con el catálogo a medias. La suite fija valores de
// relleno reconocibles, y los tests afirman contra ellos —no contra 'pro'— para
// comprobar que la traducción plan→precio ocurre de verdad.
process.env.STRIPE_PRICE_PRO = 'price_placeholder_pro';
process.env.STRIPE_PRICE_BUSINESS = 'price_placeholder_business';

// `src/config/space.js` tampoco carga sin SPACE (#51). La suite no lo alcanza:
// las pruebas que llegan a `space.service` doblan `fetch` o el propio módulo.
process.env.SPACE_URL = 'http://space.invalid:3000';
process.env.SPACE_API_KEY = 'org_placeholder_para_la_bateria_de_pruebas';

// Ruta resuelta desde este fichero: nunca sale del repositorio, de modo que
// funciona igual en la máquina de quien desarrolla, en Docker y en la CI.
jestOpenAPI(path.resolve(__dirname, '..', 'openapi', 'pricing.yaml'));
