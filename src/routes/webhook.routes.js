'use strict';

const { Router } = require('express');
const express = require('express');
const { handleWebhook } = require('../controllers/webhook.controller');

const router = Router();

// express.raw() must run BEFORE the global express.json() reaches this route.
// The raw Buffer is required by stripe.webhooks.constructEvent() for signature validation.
router.post('/stripe', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
