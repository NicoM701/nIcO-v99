import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fengari from 'fengari';
import { createVisitorHandler, fingerprints, clientIp, GENERATION_KEY } from '../api/visitors.js';
import { SEEN_KEY, SEEN_TTL_SECONDS, TOTAL_KEY, LIVE_SET_KEY, seenKeyForDay, utcDay } from '../js/visitor-logic.js';

const { lua, lauxlib, lualib, to_luastring } = fengari;

// Runs the actual production Lua. Only Redis storage/commands are simulated.
function database() {
  const values = new Map(), ttls = new Map(), calls = [];
  let failure, failureKey;
  function command(name, ...args) {
    calls.push([name, ...args]);
    if (name === failure && (!failureKey || args[0] === failureKey)) throw new Error('Simulated failure');
    const [key, value] = args;
    switch (name) {
      case 'GET': return values.get(key);
      case 'TTL': return values.has(key) ? ttls.get(key) ?? -1 : -2;
      case 'EXPIRE': if (!values.has(key)) return 0; ttls.set(key, Number(value)); return 1;
      case 'INCR': {
        const current = Number(values.get(key) ?? 0);
        if (!Number.isInteger(current)) throw new Error('Not an integer');
        values.set(key, current + 1); return current + 1;
      }
      case 'SISMEMBER': return values.get(key)?.has(value) ? 1 : 0;
      case 'SADD': {
        if (!values.has(key)) values.set(key, new Set());
        const set = values.get(key), added = set.has(value) ? 0 : 1;
        set.add(value); return added;
      }
      case 'MSET': for (let i = 0; i < args.length; i += 2) values.set(args[i], args[i + 1]); return 'OK';
      case 'DEL': args.forEach(k => { values.delete(k); ttls.delete(k); }); return 1;
      case 'ZADD': if (!values.has(key)) values.set(key, new Map()); values.get(key).set(args[2], Number(value)); return 1;
      case 'ZREMRANGEBYSCORE': {
        for (const [member, score] of values.get(key) ?? []) if (score <= Number(args[2])) values.get(key).delete(member);
        return 1;
      }
      case 'ZCOUNT': return [...(values.get(key)?.values() ?? [])].filter(score => score >= Number(value) && score <= Number(args[2])).length;
      default: throw new Error('Unexpected command ' + name);
    }
  }
  const redis = {
    async get(key) { return values.get(key); },
    async eval(script, keys, args) {
      const state = lauxlib.luaL_newstate();
      lualib.luaL_openlibs(state);
      for (const [name, entries] of [['KEYS', keys], ['ARGV', args]]) {
        lua.lua_newtable(state);
        entries.forEach((entry, i) => {
          lua.lua_pushstring(state, to_luastring(String(entry))); lua.lua_rawseti(state, -2, i + 1);
        });
        lua.lua_setglobal(state, to_luastring(name));
      }
      lua.lua_newtable(state);
      lua.lua_pushjsfunction(state, L => {
        try {
          const params = Array.from({ length: lua.lua_gettop(L) }, (_, i) => lua.lua_tojsstring(L, i + 1));
          const accessed = params[0] === 'MSET' ? params.slice(1).filter((_, i) => i % 2 === 0) : [params[1]];
          if (!accessed.every(key => keys.includes(key))) throw new Error('Undeclared Redis key');
          const result = command(...params);
          if (result === undefined) lua.lua_pushboolean(L, false);
          else if (typeof result === 'number') lua.lua_pushnumber(L, result);
          else lua.lua_pushstring(L, to_luastring(String(result)));
          return 1;
        } catch (error) { return lauxlib.luaL_error(L, to_luastring(error.message)); }
      });
      lua.lua_setfield(state, -2, to_luastring('call')); lua.lua_setglobal(state, to_luastring('redis'));
      try {
        if (lauxlib.luaL_dostring(state, to_luastring(script)) !== lua.LUA_OK) throw new Error(lua.lua_tojsstring(state, -1));
        if (!lua.lua_istable(state, -1)) return lua.lua_tonumber(state, -1);
        const result = [];
        for (let i = 1; i <= lua.lua_rawlen(state, -1); i++) {
          lua.lua_rawgeti(state, -1, i); result.push(lua.lua_tonumber(state, -1)); lua.lua_pop(state, 1);
        }
        return result;
      } finally { lua.lua_close(state); }
    },
  };
  return { redis, values, ttls, calls, fail: (name, key) => { failure = name; failureKey = key; } };
}
const handlerFor = db => createVisitorHandler(db.redis, () => 'reset-test', () => 'hash-test');
async function request(handler, method = 'POST', headers = {}) {
  const res = { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }, setHeader(name, value) { this.headers[name] = value; } };
  await handler({ method, headers, socket: { remoteAddress: '192.0.2.1' } }, res);
  return res;
}
const reset = handler => request(handler, 'DELETE', { 'x-reset-secret': 'reset-test' });

describe('visitor authorization and fingerprints', () => {
  it('rejects absent, whitespace, wrong and non-string reset secrets without Redis writes', async () => {
    for (const expected of [undefined, '', '   ', 'reset-test']) {
      const db = database(), handler = createVisitorHandler(db.redis, () => expected);
      for (const supplied of [undefined, '', 'wrong', ['reset-test']]) {
        assert.equal((await request(handler, 'DELETE', { 'x-reset-secret': supplied })).statusCode, 403);
      }
      assert.deepEqual(db.calls, []);
    }
  });
  it('uses keyed daily hashes and exactly matches the historical SHA256 migration value', () => {
    const day = '2026-10-03', fp = fingerprints('192.0.2.1', day, 'key');
    assert.equal(fp.legacy, createHash('sha256').update('192.0.2.1:2026-10-03:nv99salt').digest('hex'));
    assert.notEqual(fp.current, fp.legacy);
    assert.notEqual(fp.current, fingerprints('192.0.2.1', day, 'other-key').current);
    assert.notEqual(fp.current, fingerprints('192.0.2.1', '2026-10-04', 'key').current);
    assert.throws(() => fingerprints('ip', day, ''), /unavailable/);
    assert.equal(clientIp({ headers: { 'x-forwarded-for': '192.0.2.1, 10.0.0.1' }, socket: { remoteAddress: '10.0.0.2' } }), '192.0.2.1');
  });
  it('works with the existing Redis token when both optional secrets are absent', async t => {
    const previous = process.env.UPSTASH_REDIS_REST_TOKEN;
    const previousHash = process.env.VISITOR_HASH_SECRET;
    process.env.VISITOR_HASH_SECRET = '   ';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-test-token';
    try {
      const db = database();
      const handler = createVisitorHandler(db.redis, () => '   ');
      assert.equal((await request(handler)).statusCode, 200);
      assert.ok(db.values.get(seenKeyForDay()).has(fingerprints('192.0.2.1', utcDay(), 'redis-test-token').current));
    } finally {
      if (previous === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
      else process.env.UPSTASH_REDIS_REST_TOKEN = previous;
      if (previousHash === undefined) delete process.env.VISITOR_HASH_SECRET;
      else process.env.VISITOR_HASH_SECRET = previousHash;
    }
  });
});

describe('production Lua visitor state', () => {
  it('counts concurrent/retried registrations once with bounded retention', async () => {
    const db = database(), handler = handlerFor(db);
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(handler)));
    responses.forEach(res => assert.deepEqual(res.body, { total: 1, live: 1 }));
    assert.equal(db.values.get(TOTAL_KEY), 1);
    assert.equal(db.ttls.get(seenKeyForDay()), SEEN_TTL_SECONDS);
  });
  it('returns 503 and does not consume a visit on failed INCR', async t => {
    t.mock.method(console, 'error', () => {});
    const db = database(), handler = handlerFor(db); db.fail('INCR', TOTAL_KEY);
    assert.equal((await request(handler)).statusCode, 503);
    assert.equal(db.values.has(seenKeyForDay()), false);
    db.fail(undefined); assert.equal((await request(handler)).body.total, 1);
  });
  it('does not recount after a committed response is lost', async t => {
    t.mock.method(console, 'error', () => {});
    const db = database(), original = db.redis.eval, handler = handlerFor(db);
    db.redis.eval = async (...args) => { await original(...args); throw new Error('Lost response'); };
    assert.equal((await request(handler)).statusCode, 503);
    db.redis.eval = original;
    assert.equal((await request(handler)).body.total, 1);
  });
  it('migrates both real historical key layouts without recounting or extending legacy TTL', async () => {
    for (const key of [SEEN_KEY, seenKeyForDay()]) {
      const db = database(), handler = handlerFor(db);
      const legacy = fingerprints('192.0.2.1', utcDay(), 'hash-test').legacy;
      db.values.set(key, new Set([legacy])); db.values.set(TOTAL_KEY, 42);
      if (key === SEEN_KEY) db.ttls.set(key, 123);
      assert.equal((await request(handler)).body.total, 42);
      assert.equal(db.values.get(seenKeyForDay()).has(fingerprints('192.0.2.1', utcDay(), 'hash-test').current), true);
      if (key === SEEN_KEY) assert.equal(db.ttls.get(key), 123);
    }
  });
  it('does not mistake a failed legacy read for an unseen visitor', async t => {
    t.mock.method(console, 'error', () => {});
    const db = database(); db.fail('SISMEMBER');
    assert.equal((await request(handlerFor(db))).statusCode, 503);
    assert.equal(db.values.has(TOTAL_KEY), false);
  });
  it('resets atomically, retains unrelated keys, and ignores old generations and legacy visits', async () => {
    const db = database(), handler = handlerFor(db);
    db.values.set('unrelated', 'keep');
    await request(handler);
    db.values.set(SEEN_KEY, new Set([fingerprints('192.0.2.1', utcDay(), 'hash-test').legacy]));
    assert.deepEqual((await reset(handler)).body, { reset: true, total: 0, live: 0 });
    assert.equal(db.values.has(LIVE_SET_KEY), false);
    assert.equal(db.values.get('unrelated'), 'keep');
    const generation = db.values.get(GENERATION_KEY);
    assert.equal((await request(handler)).body.total, 1);
    assert.equal(db.ttls.get(seenKeyForDay() + ':' + generation), SEEN_TTL_SECONDS);
    assert.equal(db.ttls.get(SEEN_KEY), SEEN_TTL_SECONDS);
  });
  it('serializes reset between visits and resets again without reusing old sets', async () => {
    const db = database(), handler = handlerFor(db);
    await Promise.all([request(handler), reset(handler), request(handler)]);
    assert.equal(Number(db.values.get(TOTAL_KEY)), 1);
    const firstGeneration = db.values.get(GENERATION_KEY);
    await reset(handler); await request(handler);
    assert.notEqual(db.values.get(GENERATION_KEY), firstGeneration);
    assert.equal(Number(db.values.get(TOTAL_KEY)), 1);
  });
  it('does not partially reset when the atomic MSET fails', async t => {
    t.mock.method(console, 'error', () => {});
    const db = database(), handler = handlerFor(db); await request(handler); db.fail('MSET');
    assert.equal((await reset(handler)).statusCode, 503);
    assert.equal(db.values.get(TOTAL_KEY), 1); assert.equal(db.values.has(GENERATION_KEY), false);
    assert.equal(db.values.has(LIVE_SET_KEY), true);
  });
  it('bounds generation-conflict retries and never registers into a stale generation', async t => {
    t.mock.method(console, 'error', () => {});
    const db = database(), handler = handlerFor(db);
    let reads = 0;
    db.redis.get = async () => {
      const old = db.values.get(GENERATION_KEY);
      db.values.set(GENERATION_KEY, String(++reads));
      return old;
    };
    assert.equal((await request(handler)).statusCode, 503);
    assert.equal(reads, 3);
    assert.equal(db.values.has(TOTAL_KEY), false);
    assert.equal(db.values.has(LIVE_SET_KEY), false);
  });
  it('limits GET/POST together, returns Retry-After, and recovers in the next minute', async t => {
    let now = Date.parse('2026-10-03T12:00:01Z');
    t.mock.method(Date, 'now', () => now);
    const db = database(), handler = handlerFor(db);
    for (let i = 0; i < 120; i++) assert.equal((await request(handler, i % 2 ? 'GET' : 'POST')).statusCode, 200);
    const limited = await request(handler);
    assert.equal(limited.statusCode, 429); assert.equal(limited.headers['Retry-After'], '60');
    assert.equal(db.values.get(TOTAL_KEY), 1);
    now += 60000; assert.equal((await request(handler)).statusCode, 200);
    assert.equal(db.values.get(TOTAL_KEY), 1);
    assert.ok([...db.ttls].filter(([key]) => key.startsWith('nv99:visitor_rate:')).every(([, ttl]) => ttl === 120));
  });
  it('GET refreshes presence without counting and a new day counts separately', async t => {
    let now = Date.parse('2026-10-03T12:00:01Z'); t.mock.method(Date, 'now', () => now);
    const db = database(), handler = handlerFor(db);
    assert.deepEqual((await request(handler, 'GET')).body, { total: 0, live: 1 });
    await request(handler); now += 86400000;
    assert.equal((await request(handler)).body.total, 2);
    const unsupported = await request(handler, 'PATCH');
    assert.equal(unsupported.statusCode, 405); assert.equal(unsupported.headers.Allow, 'GET, POST, DELETE');
  });
  it('propagates live-count failures as 503', async t => {
    t.mock.method(console, 'error', () => {});
    const db = database(); db.fail('ZCOUNT');
    assert.equal((await request(handlerFor(db), 'GET')).statusCode, 503);
  });
});
