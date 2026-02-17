/**
 * server.js — Express server for nIcO v99 website (Vercel/Serverless compatible)
 */

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const {
    getTotalVisitors,
    incrementTotalVisitors,
    trackLiveUser,
    getLiveCount
} = require('./db');

const app = express();

// ── Trust proxy ──
app.set('trust proxy', 1);

// ── Helmet ──
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

app.use(cookieParser());

const visitorLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60, // Slightly higher for serverless bursts
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' },
});

// ── API Routes ──

// POST /api/visitors/visit — check/increment + heartbeat for live
app.post('/api/visitors/visit', visitorLimiter, async (req, res) => {
    try {
        const visitorId = req.cookies && req.cookies.nv99_visited;
        let total;
        let live;

        if (!visitorId) {
            // New visitor
            const newId = uuidv4();
            total = await incrementTotalVisitors();
            live = await trackLiveUser(newId);

            res.cookie('nv99_visited', newId, {
                maxAge: 365 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                sameSite: 'lax',
            });
        } else {
            // Returning visitor — just track as live and get total
            total = await getTotalVisitors();
            live = await trackLiveUser(visitorId);
        }

        res.json({ total: total || '—', live: live || 0 });
    } catch (err) {
        console.error('Visit endpoint error:', err);
        res.json({ total: '—', live: 0 });
    }
});

// GET /api/visitors — get current stats (can be used for polling)
app.get('/api/visitors', visitorLimiter, async (req, res) => {
    try {
        const visitorId = req.cookies && req.cookies.nv99_visited;
        // Also update heartbeat on simple GET if possible
        const live = await trackLiveUser(visitorId);
        const total = await getTotalVisitors();
        res.json({ total: total || '—', live: live || 0 });
    } catch (err) {
        console.error('Visitors endpoint error:', err);
        res.json({ total: '—', live: 0 });
    }
});

// ── Routes ──
app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'settings.html'));
});

// Serve static files
app.use(express.static(path.join(__dirname), {
    extensions: ['html'],
    index: 'index.html',
}));

// Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// No server.listen() here for Vercel, but we wrap it for local testing
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`✨ Local test server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
