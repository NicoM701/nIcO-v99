import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEEN_KEY,
  parseScanResult,
  seenKeyForDay,
  seenKeyMatchPattern,
  shouldIncrementTotal,
  utcDay,
} from '../js/visitor-logic.js';

describe('shouldIncrementTotal', () => {
  it('counts a new day-key member that is not in the legacy set', () => {
    assert.equal(shouldIncrementTotal(1, 0), true);
    assert.equal(shouldIncrementTotal(true, false), true);
  });

  it('does not recount Upstash boolean or integer membership', () => {
    assert.equal(shouldIncrementTotal(1, 1), false);
    assert.equal(shouldIncrementTotal(1, true), false);
    assert.equal(shouldIncrementTotal(true, 1), false);
    assert.equal(shouldIncrementTotal(0, 0), false);
  });
});

describe('seen keys', () => {
  it('namespaces daily keys and matches legacy plus daily keys', () => {
    assert.equal(seenKeyForDay('2026-09-19'), `${SEEN_KEY}:2026-09-19`);
    assert.equal(seenKeyMatchPattern(), `${SEEN_KEY}*`);
    assert.match(utcDay(new Date('2026-09-19T23:59:59.000Z')), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('parses both tuple and object SCAN payloads', () => {
    assert.deepEqual(parseScanResult(['42', ['nv99:seen_visitors:2026-09-19']]), {
      cursor: '42',
      keys: ['nv99:seen_visitors:2026-09-19'],
    });
    assert.deepEqual(parseScanResult({ cursor: 0, keys: ['nv99:seen_visitors'] }), {
      cursor: '0',
      keys: ['nv99:seen_visitors'],
    });
  });
});
