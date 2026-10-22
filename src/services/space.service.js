'use strict';

/**
 * El contrato de cada cuenta en SPACE (#51).
 *
 * Una sola operación: dejar la cuenta en un plan. Se usa la novación
 * (`PUT /contracts/{accountId}`), que conserva los consumos y reinicia el
 * periodo de facturación de SPACE. Si la cuenta aún no tiene contrato
 * —fr-commercial lo crea en su primer uso, y una cuenta puede comprar antes de
 * usar nada— se crea con ese plan; si otra petición lo crea a la vez (`409`),
 * se nova.
 *
 * La versión de la tarifa que se envía da igual: con el servicio sincronizado
 * desde SPHERE, SPACE impone la versión fijada (`enforceSpherePolicy`).
 *
 * Los complementos no entran todavía: `subscriptionAddOns` va siempre vacío, y
 * una novación los retira. El alta y la baja de complementos y el cambio de
 * plan quedan fuera de este trabajo.
 *
 * Si SPACE no responde o responde un error, se LANZA: el receptor de Stripe
 * contesta con error, el evento no queda marcado como procesado y Stripe lo
 * reintenta. Un cobro sin contrato novado no se da por bueno en silencio.
 */

const config = require('../config/space');
const logger = require('../utils/logger');

const SERVICE = 'frsaas';
const CONTRACT_VERSION = 'fijada-por-space';
const TIMEOUT_MS = 5000;

const PLANS = { free: 'FREE', pro: 'PRO', business: 'BUSINESS' };

class SpaceError extends Error {}

const call = async (method, path, body) => {
  let res;
  try {
    res = await fetch(`${config.url}/api/v1${path}`, {
      method,
      headers: { 'x-api-key': config.apiKey, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new SpaceError(`SPACE unreachable: ${err.name}`);
  }
  return res;
};

const subscription = (plan) => ({
  contractedServices: { [SERVICE]: CONTRACT_VERSION },
  subscriptionPlans: { [SERVICE]: plan },
  subscriptionAddOns: {},
});

/**
 * Deja la cuenta en el plan (`free | pro | business`).
 *
 * @param {string} accountId
 * @param {string} planId
 */
const setPlan = async (accountId, planId) => {
  const plan = PLANS[planId];
  if (!plan) {
    throw new SpaceError(`Unknown plan "${planId}"`);
  }
  const path = `/contracts/${encodeURIComponent(accountId)}`;

  let res = await call('PUT', path, subscription(plan));
  if (res.status === 404) {
    res = await call('POST', '/contracts', {
      userContact: { userId: accountId, username: accountId },
      billingPeriod: { autoRenew: true, renewalDays: 30 },
      ...subscription(plan),
    });
    if (res.status === 409) {
      res = await call('PUT', path, subscription(plan));
    }
  }

  if (res.status !== 200 && res.status !== 201) {
    throw new SpaceError(`SPACE answered ${res.status} setting plan ${plan}: ${await res.text()}`);
  }
  logger.info(`SPACE contract of account ${accountId} set to ${plan}`);
};

module.exports = { setPlan, SpaceError };
