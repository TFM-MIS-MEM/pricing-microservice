'use strict';

const { Router } = require('express');
const express = require('express');
const { handleWebhook } = require('../controllers/webhook.controller');

const router = Router();

/**
 * @openapi
 * /v1/pricing/webhooks/stripe:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Stripe webhook receiver
 *     description: >
 *       Receives and processes verified Stripe webhook events.
 *       The endpoint validates the `stripe-signature` header against
 *       `STRIPE_WEBHOOK_SECRET` before processing.
 *       Handled events: `checkout.session.completed`,
 *       `customer.subscription.deleted`, `invoice.payment_failed`.
 *       All other event types are acknowledged (200 OK) and ignored.
 *       Processing is idempotent — duplicate event IDs are safely skipped.
 *     parameters:
 *       - in: header
 *         name: stripe-signature
 *         required: true
 *         schema:
 *           type: string
 *         description: Stripe webhook signature (whsec_...)
 *     requestBody:
 *       required: true
 *       description: Raw Stripe event payload (must NOT be JSON-parsed)
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event received and processed (or safely skipped)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 received:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing signature header or invalid Stripe signature
 *       500:
 *         description: Internal error during event processing
 */

// express.raw() must run BEFORE the global express.json() reaches this route.
// The raw Buffer is required by stripe.webhooks.constructEvent() for signature validation.
router.post('/stripe', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
