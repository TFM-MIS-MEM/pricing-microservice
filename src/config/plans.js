'use strict';

/**
 * Correspondencia entre los planes del contrato y los precios de la pasarela de
 * pago.
 *
 * `openapi/pricing.yaml` declara `planId` como el enum `free | pro | business`.
 * La implementación anterior aceptaba en su lugar el Price ID de Stripe tal cual
 * lo enviara el cliente, de modo que el catálogo de precios lo fijaba quien
 * llamaba: bastaba con conocer el identificador de otro precio para suscribirse
 * a él. El plan es del dominio; el Price ID es un detalle de la pasarela de pago
 * y no debe cruzar la frontera de la API.
 *
 * La correspondencia vive AQUÍ y no en `stripe.service`: los tests de contrato
 * doblan ese módulo, así que un mapa escondido dentro quedaría tapado por el
 * doble y sin verificar.
 *
 * Sin valores por defecto, a propósito. Un identificador de precio inventado no
 * falla al arrancar: falla en la primera compra real, con el cliente delante. El
 * servicio prefiere no arrancar.
 */

const PLAN_IDS = ['free', 'pro', 'business'];

/** Planes de pago y variable de entorno que aporta su precio. */
const PRICE_ENV_VARS = {
  pro: 'STRIPE_PRICE_PRO',
  business: 'STRIPE_PRICE_BUSINESS',
};

const priceIds = {};

for (const [planId, envVar] of Object.entries(PRICE_ENV_VARS)) {
  const value = process.env[envVar];

  if (!value || value.trim() === '') {
    throw new Error(
      `${envVar} is required: the price for plan "${planId}" is not configured. ` +
        'Set it to the Stripe Price ID of that plan.',
    );
  }

  priceIds[planId] = value;
}

/**
 * Devuelve el Price ID del plan, o `null` si el plan no es comprable.
 *
 * El plan gratuito es el único caso: existe en el enum, es un plan legítimo de
 * la cuenta, pero no hay nada que cobrar por él y por tanto no hay sesión de
 * pago que crear.
 *
 * @param {string} planId
 * @returns {string|null}
 */
const priceIdFor = (planId) => priceIds[planId] || null;

/**
 * El plan de un Price ID, o `null` si no es de ningún plan de pago.
 *
 * Es la traducción inversa, la que necesita el receptor de Stripe para saber
 * qué plan se compró (#51): la suscripción trae el precio, no el plan.
 *
 * @param {string} priceId
 * @returns {string|null}
 */
const planIdFor = (priceId) =>
  Object.keys(priceIds).find((planId) => priceIds[planId] === priceId) || null;

module.exports = { PLAN_IDS, priceIdFor, planIdFor };
