/**
 * viewer-stats.js — Polling-based visitor counter + live users
 * Compatible with serverless environments (Vercel)
 */

(function () {
    'use strict';

    // ── State ──
    let totalVisitors = null;
    let liveUsers = 0;
    const POLL_INTERVAL = 10000; // 10 seconds

    // ── Format numbers nicely ──
    const fmt = (n) => {
        if (n === null || n === undefined || n === '—') return '—';
        return new Intl.NumberFormat('en-US').format(n);
    };

    // ── Create the pill element ──
    function createPill() {
        if (document.getElementById('viewer-stats-pill')) return;
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

    // ── Update display ──
    function updateDisplay() {
        const totalEl = document.getElementById('vs-total');
        const liveEl = document.getElementById('vs-live-count');
        if (totalEl) totalEl.textContent = fmt(totalVisitors);
        if (liveEl) liveEl.textContent = fmt(liveUsers);
    }

    // ── Fetch stats ──
    async function fetchStats(isFirstVisit = false) {
        try {
            const url = isFirstVisit ? '/api/visitors/visit' : '/api/visitors';
            const method = isFirstVisit ? 'POST' : 'GET';

            const res = await fetch(url, { method });
            if (res.ok) {
                const data = await res.json();
                totalVisitors = data.total;
                liveUsers = data.live || 0;
                updateDisplay();
            }
        } catch (err) {
            console.warn('Visitor stats: could not fetch stats', err);
        }
    }

    // ── Polling logic ──
    function startPolling() {
        setInterval(() => {
            fetchStats(false);
        }, POLL_INTERVAL);
    }

    // ── Initialize ──
    function init() {
        createPill();
        fetchStats(true); // First call is a visit registration
        startPolling();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
