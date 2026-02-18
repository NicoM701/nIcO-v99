/**
 * GET  /api/visitors — return total unique visitors + live count
 * POST /api/visitors — register a visit (cookieless, daily-salted IP hash)
 * DELETE /api/visitors — reset counter (requires VISITOR_RESET_SECRET header)
 *
 * Privacy-friendly: no cookies, no persistent IP storage.
 * Uses a daily-rotating salt so IP hashes can't be correlated across days.
 *
 * Env vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *   VISITOR_RESET_SECRET (for reset endpoint)
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TOTAL_KEY = 'nv99:total_visitors';
const SEEN_KEY = 'nv99:seen_visitors';   // Redis SET of hashed fingerprints
const LIVE_KEY = 'nv99:live:';
const LIVE_TTL = 30;

/**
 * Create a privacy-safe fingerprint from IP + daily salt.
 * The salt rotates daily so hashes can't be correlated long-term.
 */
async function getFingerprint(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const raw = `${ip}:${today}:nv99salt`;

  // Use Web Crypto (available in Vercel Edge & Node 18+)
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
      const fp = await getFingerprint(req);

      // Check if this fingerprint was already seen
      const added = await redis.sadd(SEEN_KEY, fp);

      if (added === 1) {
        // New unique visitor
        await redis.incr(TOTAL_KEY);
      }

      // Track live presence using the hash (no IP stored)
      await redis.set(`${LIVE_KEY}${fp}`, '1', { ex: LIVE_TTL });

      const total = (await redis.get(TOTAL_KEY)) || 0;
      const live = await countLive();

      return res.json({ total: Number(total), live });
    }

    if (method === 'GET') {
      const total = (await redis.get(TOTAL_KEY)) || 0;
      const live = await countLive();
      return res.json({ total: Number(total), live });
    }

    if (method === 'DELETE') {
      const secret = req.headers['x-reset-secret'];
      if (secret !== process.env.VISITOR_RESET_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      await redis.set(TOTAL_KEY, 0);
      await redis.del(SEEN_KEY);
      let cursor = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, { match: `${LIVE_KEY}*`, count: 100 });
        if (keys.length) await Promise.all(keys.map(k => redis.del(k)));
        cursor = Number(nextCursor);
      } while (cursor !== 0);
      return res.json({ reset: true, total: 0, live: 0 });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Visitor API error:', err);
    return res.json({ total: '—', live: 0 });
  }
}

async function countLive() {
  try {
    let cursor = 0;
    let count = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: `${LIVE_KEY}*`, count: 100 });
      count += keys.length;
      cursor = Number(nextCursor);
    } while (cursor !== 0);
    return count;
  } catch {
    return 0;
  }
}
