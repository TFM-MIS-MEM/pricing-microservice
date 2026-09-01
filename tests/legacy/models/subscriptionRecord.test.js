'use strict';

const mongoose = require('mongoose');
const SubscriptionRecord = require('../../src/models/SubscriptionRecord');

const VALID_PAYLOAD = {
  userId: 'user_123',
  stripeCustomerId: 'cus_ABC123',
  stripeSubscriptionId: 'sub_XYZ789',
  status: 'active',
  periodEnd: new Date('2026-05-21'),
};

describe('SubscriptionRecord model', () => {
  afterAll(() => mongoose.disconnect());

  describe('schema validation', () => {
    it('passes with all required fields', () => {
      const doc = new SubscriptionRecord(VALID_PAYLOAD);
      const err = doc.validateSync();
      expect(err).toBeUndefined();
    });

    it.each(['userId', 'stripeCustomerId', 'stripeSubscriptionId', 'status', 'periodEnd'])(
      'fails when %s is missing',
      (field) => {
        const payload = { ...VALID_PAYLOAD };
        delete payload[field];
        const doc = new SubscriptionRecord(payload);
        const err = doc.validateSync();
        expect(err).toBeDefined();
        expect(err.errors[field]).toBeDefined();
      },
    );

    it('rejects an invalid status value', () => {
      const doc = new SubscriptionRecord({ ...VALID_PAYLOAD, status: 'invalid_status' });
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.status).toBeDefined();
    });

    it('accepts all valid Stripe status values', () => {
      const statuses = [
        'active',
        'trialing',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
      ];
      statuses.forEach((status) => {
        const doc = new SubscriptionRecord({ ...VALID_PAYLOAD, status });
        const err = doc.validateSync();
        expect(err).toBeUndefined();
      });
    });
  });

  describe('defaults', () => {
    it('sets cancelAtPeriodEnd to false by default', () => {
      const doc = new SubscriptionRecord(VALID_PAYLOAD);
      expect(doc.cancelAtPeriodEnd).toBe(false);
    });
  });

  describe('toJSON transform', () => {
    it('maps _id to id and removes __v', () => {
      const doc = new SubscriptionRecord(VALID_PAYLOAD);
      const json = doc.toJSON();
      expect(json.id).toBeDefined();
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });
});
