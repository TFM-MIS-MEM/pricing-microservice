'use strict';

const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const config = require('../config');

/**
 * Verifies the Bearer JWT issued by auth-microservice.
 * Attaches `req.user = { id, email, role }` on success.
 */
const authenticate = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication token required', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      issuer: 'auth-microservice',
    });
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    return next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
};

module.exports = { authenticate };
