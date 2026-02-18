/**
 * GET /api/visitors — return total visitors + approximate live count
 * POST /api/visitors — register a visit (increment if new visitor cookie)
 *
 * Uses Upstash Redis via @upstash/redis (REST-based, Vercel-friendly).
 * 
 * Env vars needed:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TOTAL_KEY = 'nv99:total_visitors';
const LIVE_KEY = 'nv99:live:';
const LIVE_TTL = 30; // seconds — a viewer is "live" if seen within 30s

function getVisitorId(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies['nv99_vid'] || null;
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
      let isNew = false;

      if (!vid) {
        vid = generateId();
        isNew = true;
        // Set cookie for 1 year
        res.setHeader('Set-Cookie', `nv99_vid=${vid}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`);
      }

      // Increment total if new visitor
      if (isNew) {
        await redis.incr(TOTAL_KEY);
      }

      // Mark this visitor as live (TTL-based)
      await redis.set(`${LIVE_KEY}${vid}`, '1', { ex: LIVE_TTL });

      const total = (await redis.get(TOTAL_KEY)) || 0;
      const live = await countLive();

      return res.json({ total: Number(total), live });
    }

    if (method === 'GET') {
      // Just return stats; also refresh live presence if visitor has cookie
      const vid = getVisitorId(req);
      if (vid) {
        await redis.set(`${LIVE_KEY}${vid}`, '1', { ex: LIVE_TTL });
      }

      const total = (await redis.get(TOTAL_KEY)) || 0;
      const live = await countLive();

      return res.json({ total: Number(total), live });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Visitor API error:', err);
    return res.json({ total: '—', live: 0 });
  }
}

async function countLive() {
  try {
    // SCAN for all live keys
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
