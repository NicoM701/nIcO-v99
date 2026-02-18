/**
 * viewer-stats.js — Client-side visitor counter + live users
 * Renders pill in top-right, connects via WebSocket for live updates
 */

(function () {
    'use strict';

    // ── State ──
    let totalVisitors = null;
    let liveUsers = 0;
    let ws = null;
    let wsRetries = 0;
    const MAX_WS_RETRIES = 5;

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
                updateDisplay();
            }
        } catch (err) {
            console.warn('Visitor stats: could not register visit', err);
        }
    }

    // ── WebSocket connection for live count ──
    function connectWebSocket() {
        if (wsRetries >= MAX_WS_RETRIES) {
            // Fall back to polling
            startPolling();
            return;
        }

        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${location.host}/ws`);

        ws.onopen = () => {
            wsRetries = 0; // Reset on successful connection
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'live' || data.type === 'pong') {
                    liveUsers = data.live;
                    updateDisplay();
                }
            } catch (e) {
                // Ignore
            }
        };

        ws.onclose = () => {
            ws = null;
            wsRetries++;
            // Reconnect with exponential backoff
            const delay = Math.min(1000 * Math.pow(2, wsRetries), 30000);
            setTimeout(connectWebSocket, delay);
        };

        ws.onerror = () => {
            // onclose will handle reconnection
        };
    }

    // ── Polling fallback ──
    let pollInterval = null;
    function startPolling() {
        if (pollInterval) return;
        pollInterval = setInterval(async () => {
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
        }, 10000);
    }

    // ── Initialize ──
    function init() {
        createPill();
        registerVisit();
        connectWebSocket();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
