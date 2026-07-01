'use strict';

const { Router } = require('express');
const healthRoutes = require('./health.routes');
const checkoutRoutes = require('./checkout.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/api/v1/pricing/checkout', checkoutRoutes);

// NOTE: webhook routes are mounted directly in app.js BEFORE express.json()
// to preserve the raw Buffer required by Stripe signature validation.

module.exports = router;
