'use strict';

/**
 * Superficie del servicio que NO forma parte de la API versionada: `/docs`,
 * `/openapi.json` y `/health`.
 *
 * No es una suite de contrato —estas rutas no están en `pricing.yaml`— pero
 * cubre dos promesas que sí hay que sostener y que se quedaron sin red al
 * retirar `tests/legacy/securityHeaders.test.js`:
 *
 *  1. El alcance de la exención de CSP, en los DOS sentidos. Sin el segundo
 *     caso, nada impide que la exención de `/docs` se desborde a todo el
 *     servicio.
 *  2. Que la documentación servida es el fichero de especificación, y no una
 *     segunda descripción generada desde el código (#32).
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const request = require('supertest');
const app = require('../src/app');

const SPEC_PATH = path.resolve(__dirname, '..', 'openapi', 'pricing.yaml');

describe('Documentación', () => {
  it('GET /openapi.json devuelve exactamente el contenido de openapi/pricing.yaml', async () => {
    const res = await request(app).get('/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(yaml.load(fs.readFileSync(SPEC_PATH, 'utf8')));
  });

  it('GET /docs sirve la interfaz', async () => {
    const res = await request(app).get('/docs/').redirects(1);

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });
});

describe('Alcance de la exención de CSP', () => {
  it('/docs sale SIN la cabecera de política de contenido', async () => {
    // Con ella, Swagger UI no puede hablar con la pasarela —otro origen— y cada
    // «Try it out» muere dentro del navegador con un «Failed to fetch» que
    // culpa a CORS sin que CORS tenga nada que ver.
    const res = await request(app).get('/docs/').redirects(1);

    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('/health sale CON la cabecera de política de contenido', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('Superficie sin identidad', () => {
  it('/health es alcanzable sin las cabeceras de la pasarela', async () => {
    // El middleware de identidad se monta por router, no globalmente: sólo
    // cuelga de las rutas que el contrato declara con `security`. Si algún día
    // se montara en `app.use`, la sonda de vida del contenedor empezaría a
    // responder 401 y el orquestador reiniciaría el servicio en bucle.
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
  });
});
