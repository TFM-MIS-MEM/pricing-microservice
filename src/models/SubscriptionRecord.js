'use strict';

const mongoose = require('mongoose');

/**
 * @openapi
 * components:
 *   schemas:
 *     SubscriptionRecord:
 *       type: object
 *       description: >
 *         Reference Data: tracks the binding between a platform user and their
 *         Stripe subscription. Does NOT store plan details, limits, or quotas —
 *         those are owned by the SPACE platform and carried in the Pricing Token.
 *       properties:
 *         id:
 *           type: string
 *           readOnly: true
 *           example: "664a1f2b3c4d5e6f7a8b9c0d"
 *         userId:
 *           type: string
 *           description: Auth-service user identifier.
 *           example: "664a1f2b3c4d5e6f7a8b9c01"
 *         stripeCustomerId:
 *           type: string
 *           example: "cus_ABC123"
 *         stripeSubscriptionId:
 *           type: string
 *           example: "sub_XYZ789"
 *         status:
 *           type: string
 *           enum: [active, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired]
 *           example: active
 *         periodEnd:
 *           type: string
 *           format: date-time
 *           description: End of the current billing period.
 *           example: "2026-05-21T00:00:00.000Z"
 *         cancelAtPeriodEnd:
 *           type: boolean
 *           default: false
 *           description: Whether Stripe will cancel the subscription at period end.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *       required:
 *         - userId
 *         - stripeCustomerId
 *         - stripeSubscriptionId
 *         - status
 *         - periodEnd
 */

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
    userId: {
      type: String,
      required: [true, 'userId is required'],
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
