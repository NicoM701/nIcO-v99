import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fengari from 'fengari';
import { createVisitorHandler, REGISTER_VISIT_SCRIPT } from '../api/visitors.js';
import { SEEN_KEY, SEEN_TTL_SECONDS, TOTAL_KEY, LIVE_SET_KEY, seenKeyForDay } from '../js/visitor-logic.js';

const { lua, lauxlib, to_luastring } = fengari;

// Execute the production Lua, rather than reimplementing its control flow.
// Only Redis commands are simulated; no test accesses the production database.
function database() {
  const values = new Map();
  const ttls = new Map();
  const calls = [];
  let failCommand;
  function command(name, ...args) {
    calls.push([name, ...args]);
    if (name === failCommand) throw new Error(`Simulated ${name} failure`);
    const [key, value] = args;
    switch (name) {
      case 'SISMEMBER': return values.get(key)?.has(value) ? 1 : 0;
      case 'TTL': return values.has(key) ? (ttls.get(key) ?? -1) : -2;
      case 'EXPIRE':
        if (!values.has(key)) return 0;
        ttls.set(key, Number(value));
        return 1;
      case 'INCR': {
        const current = values.get(key) ?? 0;
        if (!Number.isInteger(current)) throw new Error('Value is not an integer');
        values.set(key, current + 1);
        return current + 1;
      }
      case 'SADD': {
        if (!values.has(key)) values.set(key, new Set());
        const set = values.get(key);
        const added = set.has(value) ? 0 : 1;
        set.add(value);
        return added;
      }
      default: throw new Error(`Unexpected Redis command: ${name}`);
    }
  }
  const redis = {
    async eval(script, keys, args) {
      const state = lauxlib.luaL_newstate();
      for (const [name, entries] of [['KEYS', keys], ['ARGV', args]]) {
        lua.lua_newtable(state);
        entries.forEach((entry, index) => {
          lua.lua_pushstring(state, to_luastring(String(entry)));
          lua.lua_rawseti(state, -2, index + 1);
        });
        lua.lua_setglobal(state, to_luastring(name));
      }
      lua.lua_newtable(state);
      lua.lua_pushjsfunction(state, (L) => {
        const params = Array.from({ length: lua.lua_gettop(L) }, (_, i) => lua.lua_tojsstring(L, i + 1));
        try {
          lua.lua_pushinteger(L, command(...params));
          return 1;
        } catch (error) {
          return lauxlib.luaL_error(L, to_luastring(error.message));
        }
      });
      lua.lua_setfield(state, -2, to_luastring('call'));
      lua.lua_setglobal(state, to_luastring('redis'));
      try {
        const status = lauxlib.luaL_dostring(state, to_luastring(script));
        if (status !== lua.LUA_OK) throw new Error(lua.lua_tojsstring(state, -1));
        return lua.lua_tointeger(state, -1);
      } finally {
        lua.lua_close(state);
      }
    },
    async get(key) { calls.push(['GET', key]); return values.get(key); },
    async set(key, value) { calls.push(['SET', key, value]); values.set(key, value); },
    async del(...keys) { calls.push(['DEL', ...keys]); keys.forEach(key => { values.delete(key); ttls.delete(key); }); },
    async scan() { return ['0', [...values.keys()].filter(key => key.startsWith(SEEN_KEY))]; },
    async zadd() {},
    async zremrangebyscore() {},
    async zcount() { return 1; },
  };
  return { redis, values, ttls, calls, fail: name => { failCommand = name; } };
}

async function request(handler, method = 'POST', headers = {}) {
  const response = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
  await handler({ method, headers, socket: { remoteAddress: '192.0.2.1' } }, response);
  return response;
}

describe('visitor API reset authorization', () => {
  for (const secret of [undefined, '', '   ']) {
    it(`rejects reset with unconfigured secret ${JSON.stringify(secret)}`, async () => {
      const db = database();
      db.values.set(TOTAL_KEY, 42);
      const handler = createVisitorHandler(db.redis, () => secret);
      const res = await request(handler, 'DELETE');
      assert.equal(res.statusCode, 403);
      assert.equal(db.values.get(TOTAL_KEY), 42);
      assert.deepEqual(db.calls, []);
    });
  }

  it('rejects missing or incorrect request secrets', async () => {
    const db = database();
    const handler = createVisitorHandler(db.redis, () => 'test-secret');
    for (const headers of [{}, { 'x-reset-secret': '' }, { 'x-reset-secret': 'wrong' }]) {
      assert.equal((await request(handler, 'DELETE', headers)).statusCode, 403);
    }
    assert.deepEqual(db.calls, []);
  });

  it('allows an authenticated reset and deletes legacy, daily and live keys only', async () => {
    const db = database();
    for (const key of [SEEN_KEY, seenKeyForDay(), LIVE_SET_KEY, 'unrelated']) db.values.set(key, new Set());
    db.values.set(TOTAL_KEY, 42);
    const handler = createVisitorHandler(db.redis, () => 'test-secret');
    const res = await request(handler, 'DELETE', { 'x-reset-secret': 'test-secret' });
    assert.deepEqual(res.body, { reset: true, total: 0, live: 0 });
    assert.deepEqual([...db.values.keys()].sort(), [TOTAL_KEY, 'unrelated'].sort());
    assert.equal(db.values.get(TOTAL_KEY), 0);
  });
});

describe('visitor registration with production Lua', () => {
  it('counts repeated and concurrent visits once and always expires the daily key', async () => {
    const db = database();
    const handler = createVisitorHandler(db.redis);
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(handler)));
    responses.forEach(res => assert.deepEqual(res.body, { total: 1, live: 1 }));
    assert.equal(db.values.get(TOTAL_KEY), 1);
    assert.equal(db.values.get(seenKeyForDay()).size, 1);
    assert.equal(db.ttls.get(seenKeyForDay()), SEEN_TTL_SECONDS);
  });

  it('does not create a non-expiring key or consume the visit when INCR fails', async (t) => {
    t.mock.method(console, 'error', () => {});
    const db = database();
    const handler = createVisitorHandler(db.redis);
    db.fail('INCR');
    await request(handler);
    assert.equal(db.values.has(seenKeyForDay()), false);
    db.fail(undefined);
    assert.equal((await request(handler)).body.total, 1);
    assert.equal(db.ttls.get(seenKeyForDay()), SEEN_TTL_SECONDS);
  });

  it('retains TTL and avoids double counting after a lost EVAL response', async (t) => {
    t.mock.method(console, 'error', () => {});
    const db = database();
    const originalEval = db.redis.eval;
    db.redis.eval = async (...args) => {
      await originalEval(...args);
      throw new Error('Network response lost after commit');
    };
    const handler = createVisitorHandler(db.redis);
    await request(handler);
    assert.equal(db.ttls.get(seenKeyForDay()), SEEN_TTL_SECONDS);
    db.redis.eval = originalEval;
    assert.equal((await request(handler)).body.total, 1);
  });

  it('does not treat a failed legacy lookup as an unseen visitor', async () => {
    const db = database();
    db.fail('SISMEMBER');
    await assert.rejects(db.redis.eval(REGISTER_VISIT_SCRIPT, [seenKeyForDay(), SEEN_KEY, TOTAL_KEY], ['fingerprint', SEEN_TTL_SECONDS]));
    assert.equal(db.values.size, 0);
  });

  it('migrates legacy fingerprints without recounting or extending the legacy TTL', async () => {
    const db = database();
    db.values.set(SEEN_KEY, new Set(['legacy-fingerprint']));
    db.values.set(TOTAL_KEY, 42);
    const keys = [seenKeyForDay(), SEEN_KEY, TOTAL_KEY];
    await db.redis.eval(REGISTER_VISIT_SCRIPT, keys, ['legacy-fingerprint', SEEN_TTL_SECONDS]);
    assert.equal(db.values.get(TOTAL_KEY), 42);
    assert.equal(db.ttls.get(SEEN_KEY), SEEN_TTL_SECONDS);
    assert.equal(db.ttls.get(seenKeyForDay()), SEEN_TTL_SECONDS);
    db.ttls.set(SEEN_KEY, 123);
    await db.redis.eval(REGISTER_VISIT_SCRIPT, keys, ['new-fingerprint', SEEN_TTL_SECONDS]);
    assert.equal(db.values.get(TOTAL_KEY), 43);
    assert.equal(db.ttls.get(SEEN_KEY), 123);
  });

  it('counts a new UTC day independently', async () => {
    const db = database();
    for (const day of ['2026-09-19', '2026-09-20']) {
      await db.redis.eval(REGISTER_VISIT_SCRIPT, [seenKeyForDay(day), SEEN_KEY, TOTAL_KEY], [`fingerprint-${day}`, SEEN_TTL_SECONDS]);
      assert.equal(db.ttls.get(seenKeyForDay(day)), SEEN_TTL_SECONDS);
    }
    assert.equal(db.values.get(TOTAL_KEY), 2);
  });

  it('does not increment totals on GET and rejects unsupported methods', async () => {
    const db = database();
    db.values.set(TOTAL_KEY, 42);
    const handler = createVisitorHandler(db.redis);
    assert.deepEqual((await request(handler, 'GET')).body, { total: 42, live: 1 });
    const res = await request(handler, 'PATCH');
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'GET, POST, DELETE');
    assert.equal(db.values.get(TOTAL_KEY), 42);
  });
});
