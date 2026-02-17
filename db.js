/**
 * db.js — Vercel KV (Redis) helper for visitor stats
 * Stores total_visitors count and tracks live users via expiring keys
 */

const { kv } = require('@vercel/kv');

/**
 * Get total visitor count
 */
async function getTotalVisitors() {
  try {
    const total = await kv.get('total_visitors');
    return total || 0;
  } catch (err) {
    console.error('KV error (getTotalVisitors):', err.message);
    return null;
  }
}

/**
 * Increment and return the new total
 */
async function incrementTotalVisitors() {
  try {
    const newTotal = await kv.incr('total_visitors');
    return newTotal;
  } catch (err) {
    console.error('KV error (incrementTotalVisitors):', err.message);
    return null;
  }
}

/**
 * Track a live user and return current live count
 * We use a "set" of active keys with a short TTL (30s)
 */
async function trackLiveUser(visitorId) {
  if (!visitorId) return await getLiveCount();

  try {
    // Set a key for this visitor that expires in 30 seconds
    const key = `live_user:${visitorId}`;
    await kv.set(key, '1', { ex: 30 });
    return await getLiveCount();
  } catch (err) {
    console.error('KV error (trackLiveUser):', err.message);
    return 0;
  }
}

/**
 * Scan keys matching live_user:* to get count
 */
async function getLiveCount() {
  try {
    // Note: for very high traffic, scanning might be slow, 
    // but for smaller personal sites, this is fine on Vercel KV.
    const keys = await kv.keys('live_user:*');
    return keys.length;
  } catch (err) {
    console.error('KV error (getLiveCount):', err.message);
    return 0;
  }
}

/**
 * Placeholder for compatibility with server.js
 */
function closeDb() {
  // KV doesn't need explicit closing in serverless
}

module.exports = {
  getTotalVisitors,
  incrementTotalVisitors,
  trackLiveUser,
  getLiveCount,
  closeDb
};
