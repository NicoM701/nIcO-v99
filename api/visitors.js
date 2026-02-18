/**
 * GET /api/visitors — return total unique visitors + approximate live count
 * POST /api/visitors — register a visit (unique by IP hash + cookie fallback)
 * DELETE /api/visitors — reset counter (requires VISITOR_RESET_SECRET header)
 *
 * Uses Upstash Redis via @upstash/redis (REST-based, Vercel-friendly).
 * 
 * Env vars needed:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *   VISITOR_RESET_SECRET (optional, for reset endpoint)
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TOTAL_KEY = 'nv99:total_visitors';
const SEEN_KEY = 'nv99:seen_visitors';   // Redis SET of visitor fingerprints
const LIVE_KEY = 'nv99:live:';
const LIVE_TTL = 30; // seconds — a viewer is "live" if seen within 30s

function getVisitorId(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies['nv99_vid'] || null;
}

function getIpFingerprint(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';
  return `ip:${ip}`;
}

function parseCookies(cookieHeader) {
  const out = {};
  for (const pair of cookieHeader.split(';')) {
    const [k, ...v] = pair.trim().split('=');
    if (k) out[k] = v.join('=');
  }
  return out;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default async function handler(req, res) {
  try {
    const method = req.method;

    if (method === 'POST') {
      // Register visit
      let vid = getVisitorId(req);
      const ipFp = getIpFingerprint(req);

      if (!vid) {
        vid = generateId();
        res.setHeader('Set-Cookie', `nv99_vid=${vid}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`);
      }

      // Check uniqueness by both cookie ID and IP fingerprint
      const [addedByCookie, addedByIp] = await Promise.all([
        redis.sadd(SEEN_KEY, `cookie:${vid}`),
        redis.sadd(SEEN_KEY, ipFp),
      ]);

      // Only increment if BOTH are new (first time from this IP with this cookie)
      // If either the IP or the cookie was already seen, it's a repeat visitor
      if (addedByCookie === 1 && addedByIp === 1) {
        await redis.incr(TOTAL_KEY);
      }

      // Mark this visitor as live (TTL-based)
      await redis.set(`${LIVE_KEY}${vid}`, '1', { ex: LIVE_TTL });

      const total = (await redis.get(TOTAL_KEY)) || 0;
      const live = await countLive();

      return res.json({ total: Number(total), live });
    }

    if (method === 'GET') {
      const vid = getVisitorId(req);
      if (vid) {
        await redis.set(`${LIVE_KEY}${vid}`, '1', { ex: LIVE_TTL });
      }

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
      // Clear all live keys
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
