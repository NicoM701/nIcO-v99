/**
 * viewer-stats.js — Client-side visitor counter
 * Uses polling every 5-10 seconds for live updates via Vercel KV
 * Same UX as before, just without WebSocket
 */

(function () {
    'use strict';

    // ── State ──
    let totalVisitors = null;
    let liveUsers = 0;
    let sessionId = null;
    let pollInterval = null;

    // ── Format numbers nicely ──
    const fmt = (n) => {
        if (n === null || n === undefined || n === '—') return '—';
        return new Intl.NumberFormat('en-US').format(n);
    };

    // ── Create the pill element ──
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
        return pill;
    }

    // ── Update display ──
    function updateDisplay() {
        const totalEl = document.getElementById('vs-total');
        const liveEl = document.getElementById('vs-live-count');
        if (totalEl) totalEl.textContent = fmt(totalVisitors);
        if (liveEl) liveEl.textContent = fmt(liveUsers);
    }

    // ── Register visit via POST ──
    async function registerVisit() {
        try {
            const res = await fetch('/api/visitors/visit', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                totalVisitors = data.total;
                liveUsers = data.live || 0;
                sessionId = data.sessionId;
                updateDisplay();
            }
        } catch (err) {
            console.warn('Visitor stats: could not register visit', err);
        }
    }

    // ── Polling: Update stats every 5-10 seconds ──
    async function pollStats() {
        try {
            const res = await fetch('/api/visitors');
            if (res.ok) {
                const data = await res.json();
                totalVisitors = data.total;
                liveUsers = data.live || 0;
                updateDisplay();
            }
        } catch (err) {
            console.warn('Visitor stats: polling failed', err);
        }
    }

    // ── Heartbeat: Keep session alive ──
    async function sendHeartbeat() {
        if (!sessionId) return;
        try {
            await fetch('/api/visitors/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });
        } catch (err) {
            console.warn('Visitor stats: heartbeat failed', err);
        }
    }

    // ── Start polling ──
    function startPolling() {
        if (pollInterval) return;
        // Poll every 7 seconds (5-10 range)
        pollInterval = setInterval(() => {
            pollStats();
            sendHeartbeat();
        }, 7000);
    }

    // ── Initialize ──
    function init() {
        createPill();
        registerVisit();
        startPolling();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
