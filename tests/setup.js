'use strict';

// Entorno de la batería de pruebas.
//
// `src/services/stripe.service.js` construye el cliente de Stripe **al cargar
// el módulo**, de modo que sin clave el `require` lanza «Neither apiKey nor
// config.authenticator provided» y cuatro suites ni siquiera llegan a
// ejecutarse. En la máquina de quien desarrolla no se nota, porque `.env`
// aporta la clave real; en integración continua no hay `.env` y la batería no
// arranca. Ese es el motivo de que el flujo de trabajo de este repositorio
// nunca haya estado en verde.
//
// Los valores se fijan **siempre**, no solo cuando faltan: así las pruebas no
// dependen del `.env` de cada cual y, sobre todo, ninguna puede alcanzar la
// cuenta real de Stripe. `dotenv` no sobrescribe lo que ya está definido, de
// modo que estos valores ganan aunque exista el fichero.
process.env.NODE_ENV = 'test';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder_para_la_bateria_de_pruebas';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder_para_la_bateria_de_pruebas';
process.env.JWT_SECRET = 'jwt_placeholder_para_la_bateria_de_pruebas';
process.env.INTERNAL_API_SECRET = 'internal_placeholder_para_la_bateria_de_pruebas';
