import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSkipStaleRender } from '../js/lifecycle.js';

describe('shouldSkipStaleRender', () => {
  it('skips when the route generation changed', () => {
    const node = { isConnected: true };
    assert.equal(shouldSkipStaleRender(1, 2, [node]), true);
  });

  it('skips when every captured node is disconnected', () => {
    const grid = { isConnected: false };
    const kb = { isConnected: false };
    assert.equal(shouldSkipStaleRender(3, 3, [grid, kb]), true);
  });

  it('skips when no nodes were captured', () => {
    assert.equal(shouldSkipStaleRender(1, 1, [null, undefined]), true);
    assert.equal(shouldSkipStaleRender(1, 1, []), true);
  });

  it('continues when the generation matches and a node is still mounted', () => {
    const grid = { isConnected: true };
    const kb = { isConnected: false };
    assert.equal(shouldSkipStaleRender(4, 4, [grid, kb]), false);
  });
});
