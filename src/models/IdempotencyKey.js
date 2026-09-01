'use strict';

const mongoose = require('mongoose');

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
