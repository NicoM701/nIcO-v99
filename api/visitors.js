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
  shouldIncrementTotal,
  utcDay,
} from '../js/visitor-logic.js';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

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

export default async function handler(req, res) {
  try {
    const method = req.method;

    if (method === 'POST') {
      const today = utcDay();
      const fp = await getFingerprint(req, today);
      const dayKey = seenKeyForDay(today);

      const added = await redis.sadd(dayKey, fp);

      if (shouldIncrementTotal(added, await redis.sismember(SEEN_KEY, fp).catch(() => 0))) {
        await redis.incr(TOTAL_KEY);
      }

      await Promise.all([
        redis.expire(dayKey, SEEN_TTL_SECONDS),
        expireLegacySeenSetOnce(),
        touchLiveVisitor(fp),
      ]);

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
      if (secret !== process.env.VISITOR_RESET_SECRET) {
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
}

async function expireLegacySeenSetOnce() {
  const ttl = await redis.ttl(SEEN_KEY);
  if (ttl === -1) {
    await redis.expire(SEEN_KEY, SEEN_TTL_SECONDS);
  }
}

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
