'use strict';

const { createCheckoutSession } = require('../services/stripe.service');
const { priceIdFor } = require('../config/plans');
const AppError = require('../utils/AppError');

/**
 * POST /v1/pricing/checkout/create-session
 *
 * La cuenta propietaria sale de `req.identity`, que el middleware toma de la
 * cabecera que propaga la pasarela. El servicio no decodifica ninguna credencial
 * (#65).
 *
 * La traducción de plan a precio ocurre aquí, fuera de `stripe.service`: es una
 * regla del dominio —qué planes son comprables— y no un detalle de la pasarela
 * de pago.
 */
const createSession = async (req, res, next) => {
  try {
    const { planId, successUrl, cancelUrl } = req.body;
    const { accountId } = req.identity;

    const priceId = priceIdFor(planId);

    if (!priceId) {
      // El plan gratuito está en el enum y es un plan legítimo, pero no hay nada
      // que cobrar: no existe sesión de pago que crear.
      return next(
        new AppError(
          `Plan "${planId}" cannot be purchased: it has no price`,
          400,
          'PLAN_NOT_PURCHASABLE',
        ),
      );
    }

    const session = await createCheckoutSession({ accountId, priceId, successUrl, cancelUrl });

    // El contrato declara el recurso plano y con ambos campos obligatorios:
    // `{ sessionId, url }`. Sin envoltorio `{ status, data }`.
    return res.status(201).json({ sessionId: session.sessionId, url: session.url });
  } catch (err) {
    return next(err);
  }
};

module.exports = { createSession };
