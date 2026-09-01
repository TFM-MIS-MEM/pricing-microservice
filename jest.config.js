/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],

  // La suite anterior fijaba el comportamiento de la implementación, no el
  // contrato. Se conserva como material para la memoria (véase
  // tests/legacy/README.md), pero no se ejecuta.
  testPathIgnorePatterns: ['/node_modules/', '/tests/legacy/'],

  // Un único MongoDB en memoria para toda la ejecución.
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',

  // Registra el matcher toSatisfyApiSpec contra openapi/pricing.yaml.
  // El nombre correcto es `setupFilesAfterEnv`: con cualquier otro, Jest se
  // limita a avisar de una opción desconocida, `jestOpenAPI()` no llega a
  // ejecutarse y toda la suite muere con «toSatisfyApiSpec is not a function».
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/legacy/'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],

  // Trinquete de cobertura: valores medidos con la suite de contrato en verde
  // (`pnpm test:coverage`, 1/09/2026). No es un objetivo, es un suelo: impide
  // que un cambio futuro en `src/` venga acompañado de una pérdida de cobertura
  // sin que la suite lo diga. Al subir, se sube también este bloque.
  //
  // Qué queda sin cubrir, y por qué se acepta:
  //
  //   - `src/services/stripe.service.js`: los tests de contrato doblan este
  //     módulo entero (véase la cabecera de checkout-create-session.test.js), de
  //     modo que su interior no se ejecuta salvo por el camino del webhook, que
  //     sí usa la firma real. Es el mismo patrón que la auditoría reprocha en
  //     `webhook.service.js` (§2.5) y queda anotado a propósito: cubrirlo exige
  //     un doble de la pasarela de pago a nivel HTTP, que es trabajo de fase 3.
  //   - `src/services/webhook.service.js`: los manejadores de eventos que la
  //     suite no entrega —`invoice.payment_failed` y el camino completo de
  //     `checkout.session.completed`, que necesita una suscripción real que
  //     recuperar—.
  //   - `src/config/index.js` y `src/utils/logger.js`: valores por defecto de
  //     variables de entorno y niveles de registro silenciados en pruebas.
  //   - `src/middlewares/errorHandler.js`: la rama del error no operacional.
  //   - `src/middlewares/validate.js`: las ramas de `query` y `params`, que
  //     ningún esquema del servicio usa todavía.
  //   - `src/config/plans.js`: la guarda de arranque sin precios configurados,
  //     que por construcción no puede ejercitarse desde una suite que necesita
  //     que el módulo cargue.
  coverageThreshold: {
    global: {
      statements: 76.89,
      branches: 56.25,
      functions: 66.66,
      lines: 78.31,
    },
  },

  verbose: true,
};
