/**
 * viewer-stats.js — Client-side visitor counter + live users (polling)
 * Renders pill in top-right, polls /api/visitors every 10s for live updates
 */

(function () {
  'use strict';

  let totalVisitors = null;
  let liveUsers = 0;
  let pollInterval = null;

  const fmt = (n) => {
    if (n === null || n === undefined || n === '—') return '—';
    return new Intl.NumberFormat('en-US').format(n);
  };

  function createPill() {
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
  }

  function updateDisplay() {
    const totalEl = document.getElementById('vs-total');
    const liveEl = document.getElementById('vs-live-count');
    if (totalEl) totalEl.textContent = fmt(totalVisitors);
    if (liveEl) liveEl.textContent = fmt(liveUsers);
  }

  async function registerVisit() {
    try {
      const res = await fetch('/api/visitors', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        totalVisitors = data.total;
        liveUsers = data.live || 0;
        updateDisplay();
      }
    } catch (err) {
      console.warn('Visitor stats: could not register visit', err);
    }
  }

  async function pollStats() {
    try {
      const res = await fetch('/api/visitors');
      if (res.ok) {
        const data = await res.json();
        totalVisitors = data.total;
        liveUsers = data.live || 0;
        updateDisplay();
      }
    } catch (e) {
      // Silently fail
    }
  }

  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(pollStats, 10000);
  }

  function init() {
    createPill();
    registerVisit();
    startPolling();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
