'use strict';

const mongoose = require('mongoose');
const IdempotencyKey = require('../../src/models/IdempotencyKey');

describe('IdempotencyKey model', () => {
  afterAll(() => mongoose.disconnect());

  describe('schema validation', () => {
    it('passes with a valid key', () => {
      const doc = new IdempotencyKey({ key: 'evt_1OqABC2eZvKYlo2CxYnOj3mI' });
      const err = doc.validateSync();
      expect(err).toBeUndefined();
    });

    it('fails when key is missing', () => {
      const doc = new IdempotencyKey({});
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.key).toBeDefined();
    });

    it('trims whitespace from key', () => {
      const doc = new IdempotencyKey({ key: '  evt_trimmed  ' });
      expect(doc.key).toBe('evt_trimmed');
    });
  });

  describe('defaults', () => {
    it('auto-sets processedAt close to now', () => {
      const before = Date.now();
      const doc = new IdempotencyKey({ key: 'evt_test' });
      const after = Date.now();
      expect(doc.processedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(doc.processedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('toJSON transform', () => {
    it('maps _id to id and removes __v', () => {
      const doc = new IdempotencyKey({ key: 'evt_json_test' });
      const json = doc.toJSON();
      expect(json.id).toBeDefined();
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });
});
