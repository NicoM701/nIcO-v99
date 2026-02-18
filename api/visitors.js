/**
 * api/visitors.js — Vercel Serverless Visitor Stats API
 * Uses Vercel KV if available, falls back to in-memory (resets on redeploy)
 */

let kvAvailable = false;
let kv = null;

// Try to import Vercel KV
try {
  const kvModule = require('@vercel/kv');
  if (kvModule && kvModule.kv) {
    kv = kvModule.kv;
    kvAvailable = true;
  }
} catch (e) {
  console.warn('Vercel KV not available, using in-memory storage');
}

// Fallback in-memory store
const memoryStore = {
  'nv99:total_visitors': 0,
  'nv99:live_sessions': {},
};

const VISITOR_KEY = 'nv99:total_visitors';
const LIVE_SESSION_PREFIX = 'nv99:session:';
const LIVE_SESSION_TTL = 35; // seconds

// ── Get from KV or memory ──
async function getValue(key) {
  if (kvAvailable && kv) {
    try {
      return await kv.get(key);
    } catch (err) {
      console.error('KV get error:', err);
      return memoryStore[key] || null;
    }
  }
  return memoryStore[key] || null;
}

// ── Set in KV or memory ──
async function setValue(key, value) {
  if (kvAvailable && kv) {
    try {
      await kv.set(key, value);
    } catch (err) {
      console.error('KV set error:', err);
      memoryStore[key] = value;
    }
  } else {
    memoryStore[key] = value;
  }
}

// ── Set with TTL ──
async function setValueWithTTL(key, value, ttl) {
  if (kvAvailable && kv) {
    try {
      await kv.setex(key, ttl, value);
    } catch (err) {
      console.error('KV setex error:', err);
      memoryStore[key] = value;
    }
  } else {
    // Simple in-memory TTL simulation
    memoryStore[key] = value;
    setTimeout(() => {
      delete memoryStore[key];
    }, ttl * 1000);
  }
}

// ── Get live session count ──
async function getLiveCount() {
  if (kvAvailable && kv) {
    try {
      const keys = await kv.keys(`${LIVE_SESSION_PREFIX}*`);
      return keys.length;
    } catch (err) {
      console.error('KV keys error:', err);
      return Object.keys(memoryStore)
        .filter(k => k.startsWith(LIVE_SESSION_PREFIX)).length;
    }
  }
  return Object.keys(memoryStore)
    .filter(k => k.startsWith(LIVE_SESSION_PREFIX)).length;
}

// ── GET: Fetch visitor stats ──
async function getVisitors(req, res) {
  try {
    const total = await getValue(VISITOR_KEY) || 0;
    const live = await getLiveCount();

    return res.status(200).json({ total, live });
  } catch (err) {
    console.error('GET /api/visitors error:', err);
    return res.status(200).json({ total: '—', live: 0 });
  }
}

// ── POST: Register visit ──
async function postVisit(req, res) {
  try {
    const sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    // Increment total
    let total = await getValue(VISITOR_KEY);
    total = (parseInt(total) || 0) + 1;
    await setValue(VISITOR_KEY, total);

    // Register live session
    const liveKey = `${LIVE_SESSION_PREFIX}${sessionId}`;
    await setValueWithTTL(liveKey, '1', 35);

    const live = await getLiveCount();
    return res.status(200).json({ total, live, sessionId });
  } catch (err) {
    console.error('POST /api/visitors/visit error:', err);
    return res.status(200).json({ total: '—', live: 0 });
  }
}

// ── POST: Heartbeat ──
async function postHeartbeat(req, res) {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const liveKey = `${LIVE_SESSION_PREFIX}${sessionId}`;
    await setValueWithTTL(liveKey, '1', 35);

    const total = await getValue(VISITOR_KEY) || 0;
    const live = await getLiveCount();

    return res.status(200).json({ total, live });
  } catch (err) {
    console.error('POST /api/visitors/heartbeat error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ── Main handler ──
export default async function handler(req, res) {
  const { method, url } = req;

  try {
    // POST /api/visitors/visit
    if (method === 'POST' && url.includes('/visit')) {
      return await postVisit(req, res);
    }

    // POST /api/visitors/heartbeat
    if (method === 'POST' && url.includes('/heartbeat')) {
      return await postHeartbeat(req, res);
    }

    // GET /api/visitors
    if (method === 'GET') {
      return await getVisitors(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
