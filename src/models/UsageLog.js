'use strict';

const mongoose = require('mongoose');

const TTL_90_DAYS_SECONDS = 90 * 24 * 60 * 60;

const usageLogSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'userId is required'],
      index: true,
    },

    endpoint: {
      type: String,
      required: [true, 'endpoint is required'],
      trim: true,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: { expires: TTL_90_DAYS_SECONDS },
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    // No updatedAt — usage logs are immutable append-only records
    timestamps: { createdAt: true, updatedAt: false },
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

const UsageLog = mongoose.model('UsageLog', usageLogSchema);

module.exports = UsageLog;
