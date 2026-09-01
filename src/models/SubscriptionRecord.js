'use strict';

const mongoose = require('mongoose');

const STRIPE_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
];

const subscriptionRecordSchema = new mongoose.Schema(
  {
    // `accountId`, nunca `userId`: todo recurso se vincula a la cuenta
    // (CLAUDE.md, regla 3). Hoy la relación cuenta-usuario es 1:1, pero
    // modelarlo así admite cuentas multiusuario sin migración. El nombre de la
    // colección NO se toca aquí: eso es §7 y va en otro issue.
    accountId: {
      type: String,
      required: [true, 'accountId is required'],
      index: true,
    },

    stripeCustomerId: {
      type: String,
      required: [true, 'stripeCustomerId is required'],
      index: true,
    },

    stripeSubscriptionId: {
      type: String,
      required: [true, 'stripeSubscriptionId is required'],
      unique: true,
      index: true,
    },

    status: {
      type: String,
      required: [true, 'status is required'],
      enum: {
        values: STRIPE_STATUSES,
        message: `status must be one of: ${STRIPE_STATUSES.join(', ')}`,
      },
    },

    periodEnd: {
      type: Date,
      required: [true, 'periodEnd is required'],
    },

    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

const SubscriptionRecord = mongoose.model('SubscriptionRecord', subscriptionRecordSchema);

module.exports = SubscriptionRecord;
