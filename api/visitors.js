/** Cookieless, pseudonymous visitor-day counting. See README for key/migration guarantees. */
import { Redis } from '@upstash/redis';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { LIVE_SET_KEY, LIVE_TTL, SEEN_KEY, SEEN_TTL_SECONDS, TOTAL_KEY, utcDay } from '../js/visitor-logic.js';

export const GENERATION_KEY = 'nv99:visitor_generation';

// EVAL serializes visits, snapshots and resets. Old generation sets expire.
export const REGISTER_VISIT_SCRIPT = `
local generation = redis.call('GET', KEYS[4]) or ''
if generation ~= ARGV[10] then return {-2, 0} end
local dayKey = KEYS[5]
local rateKey = KEYS[6]
local requests = redis.call('INCR', rateKey)
redis.call('EXPIRE', rateKey, 120)
if requests > 120 then return {-1, 0} end
local total = redis.call('GET', KEYS[1]) or '0'
if ARGV[4] == 'POST' then
  local seen = redis.call('SISMEMBER', dayKey, ARGV[1])
  local legacy = 0
  if generation == '' then
    legacy = redis.call('SISMEMBER', KEYS[2], ARGV[2])
    if redis.call('SISMEMBER', dayKey, ARGV[2]) == 1 then legacy = 1 end
    if redis.call('TTL', KEYS[2]) == -1 then redis.call('EXPIRE', KEYS[2], ARGV[8]) end
  end
  if seen == 0 and legacy == 0 then total = redis.call('INCR', KEYS[1]) end
  redis.call('SADD', dayKey, ARGV[1])
  redis.call('EXPIRE', dayKey, ARGV[8])
end
redis.call('ZADD', KEYS[3], ARGV[5], ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', ARGV[6])
redis.call('EXPIRE', KEYS[3], ARGV[9])
local live = redis.call('ZCOUNT', KEYS[3], ARGV[6], ARGV[5])
return {total, live}
`;

export const RESET_VISIT_SCRIPT = `
redis.call('MSET', KEYS[1], 0, KEYS[4], ARGV[1])
redis.call('DEL', KEYS[3])
if redis.call('TTL', KEYS[2]) == -1 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
return 1
`;

export function clientIp(req) {
  // Vercel overwrites XFF. Other hosts need their own trusted proxy policy.
  return (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].split(',')[0].trim())
    || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

export function fingerprints(ip, day, key) {
  if (typeof key !== 'string' || !key.trim()) throw new Error('Visitor hashing key unavailable');
  return {
    current: createHmac('sha256', key).update(`nv99:visitor:${day}:${ip}`).digest('hex'),
    legacy: createHash('sha256').update(`${ip}:${day}:nv99salt`).digest('hex'),
  };
}

function authorized(secret, expected) {
  if (typeof expected !== 'string' || !expected.trim() || typeof secret !== 'string') return false;
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(secret), digest(expected));
}

export function createVisitorHandler(redis, getResetSecret = () => process.env.VISITOR_RESET_SECRET,
  getHashKey = () => [process.env.VISITOR_HASH_SECRET, getResetSecret(), process.env.UPSTASH_REDIS_REST_TOKEN]
    .find(key => typeof key === 'string' && key.trim())) {
  const keys = [TOTAL_KEY, SEEN_KEY, LIVE_SET_KEY, GENERATION_KEY];
  return async function handleVisitorRequest(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.method === 'DELETE') {
        if (!authorized(req.headers['x-reset-secret'], getResetSecret())) return res.status(403).json({ error: 'Forbidden' });
        await redis.eval(RESET_VISIT_SCRIPT, keys, [randomUUID(), SEEN_TTL_SECONDS]);
        return res.json({ reset: true, total: 0, live: 0 });
      }
      if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: 'Method not allowed' });
      }
      const now = Date.now();
      const day = utcDay(new Date(now));
      const fp = fingerprints(clientIp(req), day, getHashKey());
      let snapshot;
      // Declare every accessed key to Redis. A reset between GET and EVAL
      // returns a sentinel before writes, then retries against the new generation.
      for (let attempt = 0; attempt < 3; attempt++) {
        const generation = String(await redis.get(GENERATION_KEY) || '');
        const dayKey = `${SEEN_KEY}:${day}${generation ? `:${generation}` : ''}`;
        const rateKey = `nv99:visitor_rate:${fp.current}:${Math.floor(now / 60000)}`;
        snapshot = await redis.eval(REGISTER_VISIT_SCRIPT, [...keys, dayKey, rateKey],
          [fp.current, fp.legacy, day, req.method, now, now - LIVE_TTL * 1000, Math.floor(now / 60000), SEEN_TTL_SECONDS, LIVE_TTL * 2, generation]);
        if (Number(snapshot[0]) !== -2) break;
      }
      const [total, live] = snapshot;
      if (Number(total) === -1) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: 'Too many requests' });
      }
      const stats = { total: Number(total), live: Number(live) };
      if (!Object.values(stats).every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Invalid stats');
      return res.json(stats);
    } catch {
      console.error('Visitor API unavailable');
      return res.status(503).json({ error: 'Visitor stats unavailable' });
    }
  };
}

let defaultHandler;
export default async function handler(req, res) {
  try {
    defaultHandler ??= createVisitorHandler(new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }));
    return await defaultHandler(req, res);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Visitor stats unavailable' });
  }
}
