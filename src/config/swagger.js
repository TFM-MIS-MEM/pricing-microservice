'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');
const logger = require('../utils/logger');

// Ruta resuelta desde este fichero, nunca relativa al directorio de trabajo:
// el proceso arranca desde `/app` en la imagen y desde la raíz del repositorio
// en local, y `openapi/` cuelga del repositorio en ambos casos. El `COPY . .`
// del Dockerfile la mete en la imagen; `.dockerignore` no la excluye.
const SPEC_PATH = path.resolve(__dirname, '..', '..', 'openapi', 'pricing.yaml');

/**
 * Carga la especificación desde `openapi/pricing.yaml`.
 *
 * La documentación se sirve desde el MISMO fichero contra el que valida la
 * suite de contrato, en lugar de generarse a partir de anotaciones de
 * bloque repartidas por `src/`. Aquellas anotaciones eran una tercera descripción de
 * la API —junto a la especificación y a los tests— y describían un contrato
 * distinto del de `pricing.yaml`: envoltorio `{status, data}`, `planId` como
 * Price ID de Stripe, JWT verificado en el servicio. Nada obligaba a que las
 * tres coincidieran, y no coincidían (#32).
 *
 * Con una sola fuente, si la documentación miente los tests fallan.
 *
 * @returns {object|null} La especificación, o `null` si no puede leerse.
 */
const loadSpec = () => {
  try {
    return yaml.load(fs.readFileSync(SPEC_PATH, 'utf8'));
  } catch (err) {
    logger.error(`OpenAPI specification could not be loaded from ${SPEC_PATH}: ${err.message}`);
    return null;
  }
};

const swaggerSpec = loadSpec();

/**
 * Publica la especificación en `/openapi.json` y la interfaz en `/docs`.
 *
 * Ambas rutas quedan fuera de `/v1`: no forman parte de la API versionada y por
 * eso no aparecen en el contrato.
 *
 * @param {import('express').Application} app
 */
const setupSwagger = (app) => {
  if (!swaggerSpec) return;

  app.get('/openapi.json', (_req, res) => res.status(200).json(swaggerSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

module.exports = { setupSwagger, swaggerSpec };
