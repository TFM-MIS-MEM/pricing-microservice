const request = require('supertest');
const app = require('../src/app');

// La exención de la política de seguridad de contenido en `/docs` es lo que
// permite que Swagger UI llame a la pasarela: la CSP por defecto de helmet
// declara `default-src 'self'` sin `connect-src`, de modo que el navegador
// bloquea la petición antes de emitirla. El fallo no deja rastro en ningún
// registro del servidor, así que sin este test una regresión pasaría entera la
// batería y solo se vería abriendo el navegador a mano.
describe('Cabeceras de seguridad', () => {
  describe('GET /docs', () => {
    it('se sirve sin Content-Security-Policy, para que Swagger pueda llamar a la pasarela', async () => {
      const res = await request(app).get('/docs/');

      // Se comprueba antes que la página existe: un 404 también saldría sin la
      // cabecera —la ruta empieza por /docs igualmente— y la afirmación se
      // volvería vacía sin que nadie lo notara.
      expect(res.statusCode).toBe(200);
      expect(res.headers).not.toHaveProperty('content-security-policy');
    });
  });

  describe('GET /health', () => {
    // Este es el que importa de los dos: comprueba que la exención NO se
    // desborda. Relajar helmet globalmente arreglaría Swagger igual y dejaría
    // sin cabeceras al servicio entero.
    it('conserva la Content-Security-Policy completa', async () => {
      const res = await request(app).get('/health');

      expect(res.headers).toHaveProperty('content-security-policy');
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });
});
