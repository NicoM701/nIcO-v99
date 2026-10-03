/**
 * viewer-stats.js — Client-side visitor counter + live users (polling)
 * Renders pill in top-right and polls /api/visitors for live updates
 */

(function () {
  'use strict';

  if (window.__viewerStatsInitialized) return;
  window.__viewerStatsInitialized = true;

  const POLL_INTERVAL_MS = 15000;
  const POLL_JITTER_MS = 1500;
  const FETCH_TIMEOUT_MS = 4000;

  let totalVisitors = null;
  let liveUsers = 0;
  let pollTimeout = null;
  let activeFetchController = null;
  let pending = false;
  let registered = false;
  let registerAttempts = 0;
  let generation = 0;
  let pageActive = true;

  const fmt = (n) => {
    if (n === null || n === undefined || n === '—') return '—';
    return new Intl.NumberFormat('en-US').format(n);
  };

  function createPill() {
    const existingPill = document.getElementById('viewer-stats-pill');
    if (existingPill) return existingPill;

    const pill = document.createElement('div');
    pill.id = 'viewer-stats-pill';
    pill.innerHTML = `
      <svg class="vs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <span class="vs-count" id="vs-total">—</span>
      <span class="vs-label">visitors</span>
      <div class="vs-tooltip" id="vs-tooltip">
        <span class="vs-live-dot"></span>
        <span id="vs-live-count">0</span> live now
      </div>
    `;
    document.body.appendChild(pill);
    return pill;
  }

  function updateDisplay() {
    const totalEl = document.getElementById('vs-total');
    const liveEl = document.getElementById('vs-live-count');
    if (totalEl) totalEl.textContent = fmt(totalVisitors);
    if (liveEl) liveEl.textContent = fmt(liveUsers);
  }

  async function fetchWithTimeout(url, options = {}) {
    if (activeFetchController) {
      activeFetchController.abort();
    }

    const controller = new AbortController();
    activeFetchController = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        ...options,
        cache: 'no-store',
        signal: controller.signal
      });
      if (!res.ok) return null;
      return await res.json();
    } finally {
      window.clearTimeout(timeoutId);
      if (activeFetchController === controller) {
        activeFetchController = null;
      }
    }
  }

  async function syncStats(method, currentGeneration) {
    try {
      const data = await fetchWithTimeout('/api/visitors', { method });
      if (currentGeneration !== generation || !data
        || !Number.isSafeInteger(data.total) || data.total < 0
        || !Number.isSafeInteger(data.live) || data.live < 0) return false;
      totalVisitors = data.total;
      liveUsers = data.live || 0;
      updateDisplay();
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Expected network failures from blocked/offline clients stay silent in production.
      }
    }
    return false;
  }

  function stopPolling() {
    generation++;
    if (pollTimeout) {
      window.clearTimeout(pollTimeout);
      pollTimeout = null;
    }
    if (activeFetchController) {
      activeFetchController.abort();
      activeFetchController = null;
    }
  }

  async function startPolling() {
    if (!pageActive || pending || pollTimeout || document.visibilityState === 'hidden') return;
    pending = true;
    const currentGeneration = generation;
    const method = !registered && registerAttempts < 3 ? 'POST' : 'GET';
    const success = await syncStats(method, currentGeneration);
    pending = false;
    if (currentGeneration !== generation) {
      // A hide abort does not consume a retry. Resume only after it settles.
      startPolling();
      return;
    }
    if (method === 'POST') {
      registerAttempts++;
      registered = success;
    }
    if (document.visibilityState === 'hidden') return;
    const delay = !registered && registerAttempts < 3
      ? 1000 * registerAttempts
      : POLL_INTERVAL_MS + Math.floor(Math.random() * POLL_JITTER_MS);
    pollTimeout = window.setTimeout(() => {
      pollTimeout = null;
      startPolling();
    }, delay);
  }

  function init() {
    createPill();
    updateDisplay();

    startPolling();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') stopPolling();
      else { if (pollTimeout) window.clearTimeout(pollTimeout); pollTimeout = null; startPolling(); }
    });
    window.addEventListener('pagehide', () => { pageActive = false; stopPolling(); });
    window.addEventListener('pageshow', () => { pageActive = true; startPolling(); });
  }

  function scheduleInit() {
    const start = () => window.setTimeout(init, 0);

    if (document.readyState === 'complete') {
      start();
      return;
    }

    window.addEventListener('load', start, { once: true });
  }

  scheduleInit();
})();
