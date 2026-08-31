const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const { setupSwagger } = require('./config/swagger');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const config = require('./config');

const app = express();

// This service is only reachable through Kong: the real client IP arrives in
// X-Forwarded-For and the gateway is the one that writes it. Trusting exactly
// one hop (not `true`) means a client talking to the service directly cannot
// spoof its own X-Forwarded-For.
app.set('trust proxy', 1);

// ---------------------
// Security Middleware
// ---------------------
// The general rate limit belongs to the gateway (I6): Kong applies it before
// the request ever reaches this service. Keeping a second limiter here would
// only split one client across two independent buckets.
//
// Helmet's default Content-Security-Policy sets `default-src 'self'` and no
// `connect-src`, so the browser only allows requests back to this same origin.
// Swagger UI targets the gateway on another port, so every "Try it out" was
// blocked before leaving the browser — no request ever reached Kong, and
// Swagger reported it as the generic "Failed to fetch", listing CORS among the
// possible causes, which it is not. The relaxation is scoped to /docs; every
// other path keeps the full set of headers.
app.use((req, res, next) => {
  if (req.path.startsWith('/docs')) {
    helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })(req, res, next);
  } else {
    helmet()(req, res, next);
  }
});
app.use(cors());

// ---------------------
// Stripe Webhook — raw body MUST be registered before express.json()
// stripe.webhooks.constructEvent() requires the original Buffer, not a parsed object.
// ---------------------
const webhookRoutes = require('./routes/webhook.routes');
app.use('/v1/pricing/webhooks', webhookRoutes);

// ---------------------
// Request Parsing
// ---------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------------------
// HTTP Request Logging
// ---------------------
if (!config.isTest) {
  app.use(morgan('dev'));
}

// ---------------------
// API Documentation (Swagger)
// ---------------------
setupSwagger(app);

// ---------------------
// API Routes
// ---------------------
app.use(routes);

// ---------------------
// Error Handling (Error Report Pattern)
// ---------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
