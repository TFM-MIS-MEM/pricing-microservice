'use strict';

const AppError = require('../utils/AppError');

/**
 * Identidad propagada por la pasarela.
 *
 * IMPLEMENTACIÓN DE REFERENCIA. Es el único ejemplo del proyecto de cómo un
 * servicio consume la identidad que resuelve Kong, y el que copiará
 * `fr-commercial`: lo que se decida aquí se replica en 27 operaciones.
 *
 * El servicio NO verifica ningún token. La versión anterior lo hacía por su
 * cuenta, con una copia del secreto de firma de `auth`, y eso (#65):
 *
 *   1. Leía claims que ya no existen —`decoded.id`, `decoded.email`—, de modo
 *      que la petición pasaba con la identidad a `undefined` en lugar de ser
 *      rechazada limpiamente. Un rechazo se ve; esto no.
 *   2. Excluía el canal de API: exigía `Authorization: Bearer`, así que una
 *      petición con `X-API-Key` atravesaba la pasarela y moría en el backend.
 *      El canal no debe manifestarse aquí (CLAUDE.md, regla 1).
 *   3. Duplicaba la validación de la pasarela y obligaba a compartir el secreto
 *      de firma entre `auth` y este servicio.
 *
 * LAS TRES CABECERAS SON OBLIGATORIAS Y SUS VALORES ESTÁN CERRADOS. No es rigor
 * decorativo, y no depende de la buena voluntad del cliente: la cadena lo
 * garantiza de punta a punta, y merece la pena dejar por escrito los cuatro
 * eslabones porque el contrato de `auth`, por sí solo, NO basta.
 *
 *   - `auth.yaml:489` declara `role` OPCIONAL en la respuesta de
 *     `validate-key`. Leído en solitario, un canal de API sin rol sería legal.
 *   - `auth.service.js:381` lo devuelve siempre; el campo del modelo es un enum
 *     con `default: 'CUSTOMER'` (`account.model.js:50-56`).
 *   - `handler.lua:143` cubre igualmente el caso: `body.role or "CUSTOMER"`.
 *   - `handler.lua:219-226` es la guarda única de la pasarela: si la identidad
 *     no está completa y bien formada, Kong sale con 401 y NO proxya. Además
 *     borra las tres cabeceras incondicionalmente antes de cualquier
 *     bifurcación (`handler.lua:184-188`), de modo que las del cliente nunca
 *     pasan.
 *
 * Conclusión: por el camino legítimo, estas comprobaciones son inalcanzables.
 * Sólo disparan ante quien alcanza el servicio directamente, saltándose la
 * pasarela, que es exactamente el caso que no se debe servir. Son defensa en
 * profundidad, no un acoplamiento frágil: si mañana alguien quita el valor por
 * defecto del plugin, el canal de API se rompe en Kong y no aquí.
 *
 * SE RESPONDE 401, NUNCA 403. Un 403 significa credencial válida sin permiso;
 * aquí no hay credencial a la que negarle nada: no hay identidad en absoluto.
 *
 * NO HAY CAMINO ALTERNATIVO. Ni respaldo al JWT, ni valores por defecto, ni
 * identidad tomada de ningún claim. Un valor por defecto sería inventar
 * identidad, y es justo el fallo que se corrige: la propiedad de los recursos se
 * decide con lo que dice la pasarela o no se decide.
 */

const VALID_CHANNELS = new Set(['frontend', 'api']);
const VALID_ROLES = new Set(['CUSTOMER', 'ADMIN']);

/** Mismo texto para todos los casos: no se le dice a quien sondea qué falta. */
const reject = (next) => next(new AppError('No valid identity was provided', 401, 'UNAUTHORIZED'));

/**
 * Comprueba la identidad propagada por Kong y la deja en `req.identity`.
 *
 * Todo se vincula a `accountId`, nunca a un identificador de usuario: hoy la
 * relación cuenta-usuario es 1:1, pero modelarlo así admite cuentas
 * multiusuario sin migración (CLAUDE.md, regla 3).
 */
const authenticate = (req, _res, next) => {
  const accountId = req.headers['x-account-id'];
  const channel = req.headers['x-auth-channel'];
  const role = req.headers['x-role'];

  if (typeof accountId !== 'string' || accountId.trim() === '') return reject(next);
  if (!VALID_CHANNELS.has(channel)) return reject(next);
  if (!VALID_ROLES.has(role)) return reject(next);

  req.identity = { accountId, channel, role };
  return next();
};

module.exports = { authenticate };
