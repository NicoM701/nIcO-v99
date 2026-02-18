import { kv } from '@vercel/kv';

/**
 * API Route: /api/visitors
 * Handles visitor counting + live user tracking via Vercel KV
 */

// ── Constants ──
const VISITOR_KEY = 'nv99:total_visitors';
const LIVE_USERS_KEY = 'nv99:live_users';
const LIVE_SESSION_PREFIX = 'nv99:session:';
const LIVE_SESSION_TTL = 35; // seconds

// ── GET: Fetch visitor stats ──
async function getVisitors(req) {
  try {
    const total = await kv.get(VISITOR_KEY) || 0;
    
    // Count live users (keys with active sessions)
    const pattern = `${LIVE_SESSION_PREFIX}*`;
    const keys = await kv.keys(pattern);
    const liveCount = keys.length;

    return {
      status: 200,
      body: JSON.stringify({ total, live: liveCount }),
    };
  } catch (err) {
    console.error('GET /api/visitors error:', err);
    return {
      status: 200,
      body: JSON.stringify({ total: '—', live: 0 }),
    };
  }
}

// ── POST: Register visit (first-time only) ──
async function postVisit(req) {
  try {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    // Check if already visited (cookie not available in serverless, use session ID from request)
    // For now, assume all requests are new visits to Vercel KV
    
    // Increment total visitors
    let total = (await kv.get(VISITOR_KEY)) || 0;
    total = parseInt(total) + 1;
    await kv.set(VISITOR_KEY, total);

    // Register live session with TTL
    const liveKey = `${LIVE_SESSION_PREFIX}${sessionId}`;
    await kv.setex(liveKey, LIVE_SESSION_TTL, '1');

    // Return stats
    const keys = await kv.keys(`${LIVE_SESSION_PREFIX}*`);
    const liveCount = keys.length;

    return {
      status: 200,
      body: JSON.stringify({ total, live: liveCount, sessionId }),
    };
  } catch (err) {
    console.error('POST /api/visitors/visit error:', err);
    return {
      status: 200,
      body: JSON.stringify({ total: '—', live: 0 }),
    };
  }
}

// ── Heartbeat: Keep session alive ──
async function postHeartbeat(req) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return { status: 400, body: JSON.stringify({ error: 'Missing sessionId' }) };
    }

    const liveKey = `${LIVE_SESSION_PREFIX}${sessionId}`;
    await kv.setex(liveKey, LIVE_SESSION_TTL, '1');

    // Get stats
    const total = await kv.get(VISITOR_KEY) || 0;
    const keys = await kv.keys(`${LIVE_SESSION_PREFIX}*`);
    const liveCount = keys.length;

    return {
      status: 200,
      body: JSON.stringify({ total, live: liveCount }),
    };
  } catch (err) {
    console.error('POST /api/visitors/heartbeat error:', err);
    return { status: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
}

// ── Main handler ──
export default async function handler(req, res) {
  const { method, query, url } = req;

  try {
    // POST /api/visitors/visit
    if (method === 'POST' && url.includes('/visit')) {
      const result = await postVisit(req);
      res.status(result.status).json(JSON.parse(result.body));
      return;
    }

    // POST /api/visitors/heartbeat
    if (method === 'POST' && url.includes('/heartbeat')) {
      const result = await postHeartbeat(req);
      res.status(result.status).json(JSON.parse(result.body));
      return;
    }

    // GET /api/visitors
    if (method === 'GET') {
      const result = await getVisitors(req);
      res.status(result.status).json(JSON.parse(result.body));
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
