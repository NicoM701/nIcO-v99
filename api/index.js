/**
 * api/index.js — Vercel Serverless Express Handler
 */

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { getTotalVisitors, incrementTotalVisitors } = require('../db');

const app = express();

// ── Trust proxy ──
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
            connectSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

app.use(cookieParser());

const visitorLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
});

// ── API Routes ──

app.post('/api/visitors/visit', visitorLimiter, async (req, res) => {
    try {
        const hasVisited = req.cookies && req.cookies.nv99_visited;
        let total;

        if (!hasVisited) {
            total = await incrementTotalVisitors();
            if (total !== null) {
                res.cookie('nv99_visited', uuidv4(), {
                    maxAge: 365 * 24 * 60 * 60 * 1000,
                    httpOnly: true,
                    sameSite: 'lax',
                });
            }
        } else {
            total = await getTotalVisitors();
        }

        res.json({ total: total !== null ? total : '—', live: 0 });
    } catch (err) {
        console.error('Visit error:', err);
        res.json({ total: '—', live: 0 });
    }
});

app.get('/api/visitors', visitorLimiter, async (req, res) => {
    try {
        const total = await getTotalVisitors();
        res.json({ total: total !== null ? total : '—', live: 0 });
    } catch (err) {
        console.error('Visitors error:', err);
        res.json({ total: '—', live: 0 });
    }
});

// ── Serve static files from root ──
app.use(express.static(path.join(__dirname, '..')));

// ── Fallback to index.html for SPA routes ──
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Export for Vercel ──
module.exports = app;
