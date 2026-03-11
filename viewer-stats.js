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
  let registerPromise = null;
  let isPolling = false;

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
      return res;
    } finally {
      window.clearTimeout(timeoutId);
      if (activeFetchController === controller) {
        activeFetchController = null;
      }
    }
  }

  async function syncStats(method) {
    try {
      const res = await fetchWithTimeout('/api/visitors', { method });
      if (!res || !res.ok) return;

      const data = await res.json();
      totalVisitors = data.total;
      liveUsers = data.live || 0;
      updateDisplay();
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Expected network failures from blocked/offline clients stay silent in production.
      }
    }
  }

  function stopPolling() {
    isPolling = false;
    if (pollTimeout) {
      window.clearTimeout(pollTimeout);
      pollTimeout = null;
    }
    if (activeFetchController) {
      activeFetchController.abort();
      activeFetchController = null;
    }
  }

  function scheduleNextPoll() {
    if (!isPolling || document.visibilityState === 'hidden') return;
    const delay = POLL_INTERVAL_MS + Math.floor(Math.random() * POLL_JITTER_MS);
    pollTimeout = window.setTimeout(async () => {
      await syncStats('GET');
      scheduleNextPoll();
    }, delay);
  }

  async function startPolling() {
    if (isPolling || document.visibilityState === 'hidden') return;
    isPolling = true;
    await syncStats('GET');
    scheduleNextPoll();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      stopPolling();
      return;
    }

    if (registerPromise) {
      registerPromise.finally(() => startPolling());
      return;
    }

    startPolling();
  }

  function init() {
    createPill();
    updateDisplay();

    if (!registerPromise) {
      registerPromise = syncStats('POST');
    }

    registerPromise.finally(() => {
      if (document.visibilityState !== 'hidden') {
        startPolling();
      }
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
