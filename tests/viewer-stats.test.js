import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { it } from 'node:test';
import assert from 'node:assert/strict';

const code = readFileSync(new URL('../viewer-stats.js', import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function harness(respond, visibility = 'visible') {
  const timers = new Map(), calls = [], elements = new Map();
  let nextId = 0, active = 0, maxActive = 0;
  const doc = new EventTarget();
  doc.readyState = 'complete'; doc.visibilityState = visibility;
  doc.getElementById = id => elements.get(id);
  doc.createElement = () => ({});
  doc.body = { appendChild(pill) {
    elements.set(pill.id, pill);
    for (const id of ['vs-total', 'vs-live-count']) elements.set(id, { textContent: '' });
  } };
  const win = new EventTarget();
  win.setTimeout = (fn, delay) => { const id = ++nextId; timers.set(id, { fn, delay }); return id; };
  win.clearTimeout = id => timers.delete(id);
  const fetch = async (url, options) => {
    calls.push(options.method); active++; maxActive = Math.max(maxActive, active);
    try { return await respond(options, calls.length); } finally { active--; }
  };
  vm.runInNewContext(code, { window: win, document: doc, fetch, AbortController, Intl, Math, console });
  const runNext = async () => {
    const entry = [...timers].sort((a, b) => a[1].delay - b[1].delay)[0];
    assert.ok(entry, 'expected a timer');
    timers.delete(entry[0]); entry[1].fn(); await settle();
  };
  return { calls, timers, elements, runNext, maxActive: () => maxActive,
    async page(type) { win.dispatchEvent(new Event(type)); await settle(); },
    async visible(state) { doc.visibilityState = state; doc.dispatchEvent(new Event('visibilitychange')); await settle(); } };
}
const response = (total, live) => ({ ok: true, json: async () => ({ total, live }) });

it('retries registration at most three times before GET polling', async () => {
  const h = harness(async () => ({ ok: false }));
  await h.runNext(); await h.runNext(); await h.runNext(); await h.runNext();
  assert.deepEqual(h.calls, ['POST', 'POST', 'POST', 'GET']);
  assert.equal(h.maxActive(), 1);
});

it('preserves last good values on 503, old placeholders and malformed data', async () => {
  const h = harness(async (_options, count) => [
    response(42, 3), { ok: false }, response('—', 0), response(43, -1), response(44, 2),
  ][count - 1]);
  await h.runNext();
  for (let i = 0; i < 3; i++) {
    await h.runNext();
    assert.equal(h.elements.get('vs-total').textContent, '42');
    assert.equal(h.elements.get('vs-live-count').textContent, '3');
  }
  await h.runNext();
  assert.equal(h.elements.get('vs-total').textContent, '44');
});

it('does not register while initially hidden and resumes a single polling loop', async () => {
  const h = harness(async () => response(1, 1), 'hidden');
  await h.runNext(); assert.deepEqual(h.calls, []); assert.equal(h.timers.size, 0);
  await h.visible('visible'); assert.deepEqual(h.calls, ['POST']);
  await h.visible('visible'); await h.visible('visible');
  assert.deepEqual(h.calls, ['POST', 'GET', 'GET']);
  assert.equal(h.timers.size, 1); assert.equal(h.maxActive(), 1);
  await h.visible('hidden'); assert.equal(h.timers.size, 0);
});

it('aborts on hide and retries POST after the aborted request settles', async () => {
  const h = harness(async (options, count) => {
    if (count > 1) return response(1, 1);
    return await new Promise((_resolve, reject) => options.signal.addEventListener('abort',
      () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), { once: true }));
  });
  await h.runNext(); assert.deepEqual(h.calls, ['POST']);
  await h.visible('hidden'); assert.equal(h.timers.size, 0);
  await h.visible('visible');
  assert.deepEqual(h.calls, ['POST', 'POST']);
  assert.equal(h.elements.get('vs-total').textContent, '1');
  assert.equal(h.maxActive(), 1);
});

it('times out slow response bodies and retries without overlapping requests', async () => {
  const h = harness(async (options, count) => count > 1 ? response(1, 1) : ({
    ok: true, json: () => new Promise((_resolve, reject) => options.signal.addEventListener('abort',
      () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), { once: true })),
  }));
  await h.runNext(); await h.runNext(); await h.runNext();
  assert.deepEqual(h.calls, ['POST', 'POST']); assert.equal(h.maxActive(), 1);
  assert.equal(h.elements.get('vs-total').textContent, '1');
});

it('stops on pagehide even while visible and resumes on BFCache pageshow', async () => {
  const h = harness(async (options, count) => count > 1 ? response(1, 1) : new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
  }));
  await h.runNext(); await h.page('pagehide');
  assert.deepEqual(h.calls, ['POST']); assert.equal(h.timers.size, 0);
  await h.page('pageshow');
  assert.deepEqual(h.calls, ['POST', 'POST']); assert.equal(h.timers.size, 1);
});
