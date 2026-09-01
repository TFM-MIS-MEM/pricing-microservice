const logger = require('../utils/logger');

/**
 * Vocabulario de códigos por defecto, para los errores que no traen uno propio.
 *
 * `ErrorReport` declara `code` como cadena libre, de modo que la especificación
 * NO puede fijar este vocabulario y ningún test de contrato lo protege: si aquí
 * se escribiera `UNAUTHORISED` en lugar de `UNAUTHORIZED`, la suite seguiría en
 * verde y el cliente se rompería. Por eso la lista se elige una vez, se escribe
 * aquí y se mantiene igual en todos los servicios.
 *
 * Los códigos específicos del dominio se pasan al construir el `AppError`, no se
 * derivan del estado:
 *
 *   - `PLAN_NOT_PURCHASABLE` (400) — el plan gratuito no tiene precio que cobrar.
 *   - `INVALID_SIGNATURE`    (401) — la firma del evento no verifica.
 *
 * Los de CLAUDE.md §6 que no aparecen aquí —`QUOTA_EXCEEDED`,
 * `GALLERY_FROZEN_MODEL_NOT_IN_PLAN`, `MODEL_NOT_IN_PLAN`— pertenecen a
 * `fr-commercial` y no se declaran en este servicio.
 */
const DEFAULT_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMIT_EXCEEDED',
};

/**
 * Manejador global de errores — patrón ERROR REPORT.
 *
 * Devuelve siempre `{ code, message }`, con `details` opcional, tal y como lo
 * declara `components.schemas.ErrorReport` en el contrato. El tipo de contenido
 * es `application/json`, que es el que la especificación declara para
 * `ErrorReport`: NO se emite `application/problem+json`.
 *
 * La traza de pila NO viaja en el cuerpo en ningún entorno. Va al registro, que
 * es donde puede leerla quien opera el servicio y nadie más. La versión anterior
 * la incluía bajo `if (!config.isProduction)`, de modo que se emitía en
 * desarrollo y en test con rutas absolutas del contenedor y versiones exactas de
 * las dependencias (#66).
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;

  logger.error(`${statusCode} — ${err.message}`);
  // La traza, sólo al registro y sólo cuando aporta: un error operacional es un
  // camino previsto del contrato, no un fallo que haya que depurar.
  if (!err.isOperational) {
    logger.error(err.stack);
  }

  const response = {
    code: err.code || DEFAULT_CODES[statusCode] || 'INTERNAL_ERROR',
    // Un error no operacional es un fallo del servicio: su mensaje puede
    // contener detalles de implementación y no se devuelve al cliente.
    message: err.isOperational ? err.message : 'Internal server error',
  };

  if (err.details) {
    response.details = err.details;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
