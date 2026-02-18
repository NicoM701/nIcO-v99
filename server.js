/**
 * server.js — Express + WebSocket server for nIcO v99 website
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { getTotalVisitors, incrementTotalVisitors, closeDb } = require('./db');

const app = express();
const server = http.createServer(app);

// ── Trust proxy (for deployments behind reverse proxies) ──
app.set('trust proxy', 1);

// ── Helmet (security headers) ──
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// ── Cookie parser ──
app.use(cookieParser());

// ── Rate limiting on visitor API ──
const visitorLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' },
});

// ── Live users tracking ──
let liveConnections = new Set();

function getLiveCount() {
    return liveConnections.size;
}

// ── API Routes ──

// POST /api/visitors/visit — first visit check + increment
app.post('/api/visitors/visit', visitorLimiter, async (req, res) => {
    try {
        const hasVisited = req.cookies && req.cookies.nv99_visited;
        let total;

        if (!hasVisited) {
            // First visit — increment and set cookie
            total = await incrementTotalVisitors();
            if (total !== null) {
                res.cookie('nv99_visited', uuidv4(), {
                    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
                    httpOnly: true,
                    sameSite: 'lax',
                });
            }
        } else {
            total = await getTotalVisitors();
        }

        if (total === null) {
            return res.json({ total: '—', live: getLiveCount() });
        }

        res.json({ total, live: getLiveCount() });
    } catch (err) {
        console.error('Visit endpoint error:', err);
        res.json({ total: '—', live: getLiveCount() });
    }
});



// GET /api/visitors — get current stats
app.get('/api/visitors', visitorLimiter, async (req, res) => {
    try {
        const total = await getTotalVisitors();
        res.json({ total: total !== null ? total : '—', live: getLiveCount() });
    } catch (err) {
        console.error('Visitors endpoint error:', err);
        res.json({ total: '—', live: getLiveCount() });
    }
});

// ── Explicit routes for clean URLs ──
app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'settings.html'));
});

// ── Serve static files ──
app.use(express.static(path.join(__dirname), {
    extensions: ['html'],
    index: 'index.html',
}));

// ── Fallback for SPA-like routes ──
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── WebSocket Server ──
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
    liveConnections.add(ws);
    broadcastLiveCount();

    // Heartbeat
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', live: getLiveCount() }));
            }
        } catch (e) {
            // Ignore malformed messages
        }
    });

    ws.on('close', () => {
        liveConnections.delete(ws);
        broadcastLiveCount();
    });

    ws.on('error', () => {
        liveConnections.delete(ws);
    });

    // Send initial live count
    ws.send(JSON.stringify({ type: 'live', live: getLiveCount() }));
});

// Broadcast live count to all connected clients
function broadcastLiveCount() {
    const msg = JSON.stringify({ type: 'live', live: getLiveCount() });
    for (const client of liveConnections) {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(msg);
        }
    }
}

// Heartbeat interval — clean up dead connections
const heartbeatInterval = setInterval(() => {
    for (const ws of liveConnections) {
        if (!ws.isAlive) {
            liveConnections.delete(ws);
            ws.terminate();
            continue;
        }
        ws.isAlive = false;
        ws.ping();
    }
    broadcastLiveCount();
}, 30000);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

// ── Start server ──
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✨ nIcO v99 server running on http://localhost:${PORT}`);
});

// ── Graceful shutdown ──
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    clearInterval(heartbeatInterval);
    wss.close();
    server.close();
    closeDb();
    process.exit(0);
});

process.on('SIGTERM', () => {
    clearInterval(heartbeatInterval);
    wss.close();
    server.close();
    closeDb();
    process.exit(0);
});
