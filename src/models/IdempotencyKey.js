'use strict';

const mongoose = require('mongoose');

/**
 * @openapi
 * components:
 *   schemas:
 *     IdempotencyKey:
 *       type: object
 *       description: >
 *         Operational Data: stores the unique key of each processed Stripe webhook
 *         event. Before processing any webhook, the handler checks for the presence
 *         of its event ID here. If found, the event is a duplicate and is rejected
 *         with 200 OK (idempotent). Documents expire after 7 days (Stripe replay window).
 *       properties:
 *         id:
 *           type: string
 *           readOnly: true
 *           example: "664a1f2b3c4d5e6f7a8b9c20"
 *         key:
 *           type: string
 *           description: Stripe event ID used as the idempotency token.
 *           example: "evt_1OqABC2eZvKYlo2CxYnOj3mI"
 *         processedAt:
 *           type: string
 *           format: date-time
 *           description: When the event was first successfully processed.
 *           readOnly: true
 *       required:
 *         - key
 */

// Stripe's replay window is 72 h; 7 days gives comfortable headroom.
const TTL_7_DAYS_SECONDS = 7 * 24 * 60 * 60;

const idempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'key is required'],
      unique: true,
      trim: true,
      index: true,
    },

    processedAt: {
      type: Date,
      default: Date.now,
      index: { expires: TTL_7_DAYS_SECONDS },
    },
  },
  {
    timestamps: false,
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

const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencyKeySchema);

module.exports = IdempotencyKey;
