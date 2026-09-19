/**
 * GET  /api/visitors — return total unique visitor-days + live count
 * POST /api/visitors — register a visit (cookieless, daily-salted IP hash)
 * DELETE /api/visitors — reset counter (requires VISITOR_RESET_SECRET header)
 *
 * Privacy-friendly: no cookies, no persistent IP storage.
 * Uses a daily-rotating salt so IP hashes can't be correlated across days.
 * `total` counts unique visitor-days (same IP on a new UTC day increments again).
 * Seen fingerprints live in `nv99:seen_visitors:YYYY-MM-DD` keys with a 48h TTL.
 *
 * Env vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *   VISITOR_RESET_SECRET (for reset endpoint)
 */

import { Redis } from '@upstash/redis';
import {
  LIVE_SET_KEY,
  LIVE_TTL,
  SEEN_KEY,
  SEEN_TTL_SECONDS,
  TOTAL_KEY,
  parseScanResult,
  seenKeyForDay,
  seenKeyMatchPattern,
  utcDay,
} from '../js/visitor-logic.js';

// Redis executes this without interleaving requests. Read membership before any
// writes, and increment before recording a new fingerprint so a failed INCR
// cannot consume the visit. SADD and EXPIRE cannot be split by a network failure.
export const REGISTER_VISIT_SCRIPT = `
local seen = redis.call('SISMEMBER', KEYS[1], ARGV[1])
local legacy = redis.call('SISMEMBER', KEYS[2], ARGV[1])
local legacyTtl = redis.call('TTL', KEYS[2])
if legacyTtl == -1 then
  redis.call('EXPIRE', KEYS[2], ARGV[2])
end
if seen == 0 and legacy == 0 then
  redis.call('INCR', KEYS[3])
end
redis.call('SADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
`;

let defaultHandler;
export default async function handler(req, res) {
  defaultHandler ??= createVisitorHandler(new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  }));
  return defaultHandler(req, res);
}

/**
 * Create a privacy-safe fingerprint from IP + daily salt.
 * The salt rotates daily so hashes can't be correlated long-term.
 */
async function getFingerprint(req, today = utcDay()) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';

  const raw = `${ip}:${today}:nv99salt`;

  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function createVisitorHandler(redis, getResetSecret = () => process.env.VISITOR_RESET_SECRET) {
  return async function handleVisitorRequest(req, res) {
    try {
      const method = req.method;

      if (method === 'POST') {
        const today = utcDay();
        const fp = await getFingerprint(req, today);
        const dayKey = seenKeyForDay(today);

        await redis.eval(
          REGISTER_VISIT_SCRIPT,
          [dayKey, SEEN_KEY, TOTAL_KEY],
          [fp, SEEN_TTL_SECONDS],
        );
        await touchLiveVisitor(fp);

        const [total, live] = await Promise.all([
          redis.get(TOTAL_KEY),
          countLive(),
        ]);

        return res.json({ total: Number(total || 0), live });
      }

      if (method === 'GET') {
        const fp = await getFingerprint(req);
        await touchLiveVisitor(fp);

        const [total, live] = await Promise.all([
          redis.get(TOTAL_KEY),
          countLive(),
        ]);
        return res.json({ total: Number(total || 0), live });
      }

      if (method === 'DELETE') {
        const secret = req.headers['x-reset-secret'];
        const expectedSecret = getResetSecret();
        if (typeof expectedSecret !== 'string' || !expectedSecret.trim() || secret !== expectedSecret) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        await Promise.all([
          redis.set(TOTAL_KEY, 0),
          deleteMatchingKeys(seenKeyMatchPattern()),
          redis.del(LIVE_SET_KEY),
        ]);
        return res.json({ reset: true, total: 0, live: 0 });
      }

      res.setHeader('Allow', 'GET, POST, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
      console.error('Visitor API error:', err);
      return res.json({ total: '—', live: 0 });
    }
  };

  async function deleteMatchingKeys(match) {
    let cursor = '0';
    do {
      const scanned = parseScanResult(await redis.scan(cursor, { match, count: 100 }));
      cursor = scanned.cursor;
      if (scanned.keys.length) {
        await redis.del(...scanned.keys);
      }
    } while (cursor !== '0');
  }

  async function touchLiveVisitor(fingerprint) {
    const now = Date.now();
    await redis.zadd(LIVE_SET_KEY, { score: now, member: fingerprint });
  }

  async function countLive() {
    try {
      const now = Date.now();
      const cutoff = now - (LIVE_TTL * 1000);

      await redis.zremrangebyscore(LIVE_SET_KEY, 0, cutoff);
      const count = await redis.zcount(LIVE_SET_KEY, cutoff, now);
      return Number(count || 0);
    } catch {
      return 0;
    }
  }
}
