'use strict';

const { constructWebhookEvent } = require('../services/stripe.service');
const AppError = require('../utils/AppError');
const { processEvent } = require('../services/webhook.service');
const logger = require('../utils/logger');

/**
 * POST /v1/pricing/webhooks/stripe
 *
 * Recibe los eventos crudos de la pasarela de pago, valida la firma y despacha
 * al manejador que corresponda.
 *
 * El 200 se declara en el contrato SIN `content`, de modo que la respuesta va
 * sin cuerpo. Comprobado: con un cuerpo —JSON o texto—, la validación contra la
 * especificación falla con «response must be null». Stripe da por buena
 * cualquier 2xx, así que el acuse sin cuerpo le sirve igual.
 *
 * Los errores salen por el manejador global para que su forma sea `ErrorReport`:
 * responder aquí en línea era lo que dejaba fuera el `code` obligatorio (#66).
 */
const handleWebhook = async (req, res, next) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return next(new AppError('Missing Stripe-Signature header', 400));
  }

  let event;
  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    return next(err);
  }

  try {
    const { skipped } = await processEvent(event);
    logger.info(`Webhook ${event.type} [${event.id}] — skipped: ${skipped}`);
    return res.status(200).end();
  } catch (err) {
    logger.error(`Webhook handler error for ${event.type}: ${err.message}`);
    return next(err);
  }
};

module.exports = { handleWebhook };
