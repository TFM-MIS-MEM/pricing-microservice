'use strict';

const mongoose = require('mongoose');

/**
 * @openapi
 * components:
 *   schemas:
 *     UsageLog:
 *       type: object
 *       description: >
 *         Reference Data: immutable audit record of a single API consumption event.
 *         Used for billing reconciliation and forensic tracing only.
 *         Quota enforcement is delegated entirely to the SPACE platform.
 *         Documents expire automatically after 90 days (TTL index).
 *       properties:
 *         id:
 *           type: string
 *           readOnly: true
 *           example: "664a1f2b3c4d5e6f7a8b9c10"
 *         userId:
 *           type: string
 *           description: Auth-service user identifier who triggered the call.
 *           example: "664a1f2b3c4d5e6f7a8b9c01"
 *         endpoint:
 *           type: string
 *           description: The API route that was consumed.
 *           example: "/v1/fr/commercial/recognize"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: When the event occurred (auto-set, immutable).
 *           readOnly: true
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *           description: Optional context payload (e.g. latency, model version).
 *           example: { "latencyMs": 120, "modelVersion": "1.0" }
 *       required:
 *         - userId
 *         - endpoint
 */

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
