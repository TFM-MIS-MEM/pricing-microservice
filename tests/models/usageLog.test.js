'use strict';

const mongoose = require('mongoose');
const UsageLog = require('../../src/models/UsageLog');

const VALID_PAYLOAD = {
  userId: 'user_123',
  endpoint: '/v1/fr/commercial/recognize',
};

describe('UsageLog model', () => {
  afterAll(() => mongoose.disconnect());

  describe('schema validation', () => {
    it('passes with all required fields', () => {
      const doc = new UsageLog(VALID_PAYLOAD);
      const err = doc.validateSync();
      expect(err).toBeUndefined();
    });

    it.each(['userId', 'endpoint'])('fails when %s is missing', (field) => {
      const payload = { ...VALID_PAYLOAD };
      delete payload[field];
      const doc = new UsageLog(payload);
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err.errors[field]).toBeDefined();
    });
  });

  describe('defaults', () => {
    it('auto-sets timestamp close to now', () => {
      const before = Date.now();
      const doc = new UsageLog(VALID_PAYLOAD);
      const after = Date.now();
      expect(doc.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(doc.timestamp.getTime()).toBeLessThanOrEqual(after);
    });

    it('initialises metadata to an empty object', () => {
      const doc = new UsageLog(VALID_PAYLOAD);
      expect(doc.metadata).toEqual({});
    });
  });

  describe('toJSON transform', () => {
    it('maps _id to id and removes __v', () => {
      const doc = new UsageLog(VALID_PAYLOAD);
      const json = doc.toJSON();
      expect(json.id).toBeDefined();
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });
});
