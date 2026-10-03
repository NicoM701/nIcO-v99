# nIcO v99 — Gaming Profile

Personal gaming hub & config viewer for **nIcO v99**.

## ✨ Features

- **Interactive Setup** — View CS2 settings, crosshair, and keybinds parsed directly from `config.cfg`.
  - *Smart Mapping*: Automatically maps US-config binds to the correct German layout keys.
- **Hardware Specs** — Detailed PC components and peripherals list.
- **Social Hub** — Quick links to Steam, FACEIT, Twitch, YouTube, TikTok, X, Discord, and GitHub.
- **FAQ** — Origin story, CS playtime, and contact notes.
- **Live Visitor Stats** — Unique visitor-days and live viewers via Upstash Redis with polling updates.
- **Immersive UI** — 3D tilt effects, animated background, and glassmorphism design.

## 🛠️ Configuration

The website is powered by the `config.cfg` file.

- **Update Settings**: Replace `config.cfg` with your latest CS2 config file.
- **Update Binds**: The site automatically reads binds and updates the visual keyboard.
- **Crosshair**: The crosshair settings card uses `icons/crosshair.svg` as a custom cursor.

## 🗂 Structure

```
├── api/
│   └── visitors.js       # Vercel Serverless: visitor stats (Upstash Redis)
├── js/
│   ├── affiliates.js     # Partner carousel
│   ├── config.js         # CS2 config parser + bind mapping
│   ├── keyboard.js       # Visual keyboard
│   ├── lifecycle.js      # SPA stale-render guards
│   └── visitor-logic.js  # Visitor-day counting helpers
├── tests/
│   ├── config.test.js
│   ├── lifecycle.test.js
│   ├── visitor-logic.test.js
│   └── visitors-api.test.js # API authorization and Lua failure/retry coverage
├── icons/                 # Social & UI SVGs
├── assets/                # Images & Backgrounds
├── index.html             # Profile & Hardware (Home)
├── settings.html          # CS2 Config & Keyboard
├── faq.html               # FAQ
├── script.js              # SPA routing & page UI
├── viewer-stats.js        # Visitor counter client (polls /api/visitors)
├── styles.css             # Visual Styles
├── config.cfg             # Source of Truth (CS2 config)
├── vercel.json            # Vercel deployment config
└── package.json           # Dependencies (@upstash/redis)
```

## 🧪 Tests

```bash
npm ci
npm test
```

GitHub Actions runs these tests for pull requests and pushes to `main`.
API tests execute the production Lua script with simulated Redis commands;
they do not connect to the live database.

## 🚀 Deployment

1. Push to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Create a free [Upstash Redis](https://upstash.com) database
4. Add environment variables in Vercel project settings:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `VISITOR_RESET_SECRET` (optional; leave unset to disable counter resets)
5. Deploy!

### Visitor counter operations and privacy

Fingerprints use HMAC-SHA256 over the UTC day and client IP. The key is the first
non-empty value of `VISITOR_HASH_SECRET`, `VISITOR_RESET_SECRET`, or the existing
`UPSTASH_REDIS_REST_TOKEN`. No new variable is required for existing deployments.
A dedicated random `VISITOR_HASH_SECRET` is preferable to sharing a credential.
Set it before rollout and keep it stable. Changing the selected key can recount
visitors that day and temporarily duplicate live presence. Resets still require
`VISITOR_RESET_SECRET`; a hashing key alone does not enable resets.

This is pseudonymous counting, not anonymous tracking or a GDPR compliance
guarantee. The app stores no raw IPs or cookies. Different days produce different
hashes, but an operator holding the key can recompute them. IP sharing, VPNs and
address changes make visitor-days an approximation. Hosting-provider logs have
their own retention policies. Seen sets expire after 48 hours, live presence
after 30 seconds of inactivity, and rate-limit buckets after 120 seconds.

The rollout recognizes the historical SHA256 value in both the legacy set and
the current daily set, preserving same-day counts. It only writes keyed hashes.
Existing public-salt hashes remain until their set expires; a legacy set without
a TTL receives 48 hours on the next registration or reset. Historical hashing
matches commit `7c36027`; no original fingerprint mismatch was found.

Registration, live updates and snapshots run in one Redis Lua script. Reset
atomically replaces total and generation with MSET and clears live presence in
the same script. Old seen sets become inactive and expire normally. It never
scans or purges unrelated Redis keys. Redis scripts prevent interleaving, but
do not roll back arbitrary runtime/server failures; a lost response can still
mean the operation committed. Repeated registration is deduplicated. Avoid
blindly retrying an administrative reset after an uncertain response.
Older deployments must stop serving writes after rollout; rolling back across
the generation-aware reset requires coordinating counter state.

For this Vercel deployment, client identity retains the leftmost `X-Forwarded-For`
value. [Vercel documents that it overwrites external XFF to prevent spoofing](https://vercel.com/docs/headers/request-headers).
Other hosting or trusted-proxy configurations need their own trust policy.
GET and POST share a limit of 120 requests per fingerprint per UTC minute,
returning 429 and Retry-After when exceeded. Shared IPs share the limit. This
bounds accepted app work per IP; it is not distributed-bot or DDoS protection,
and rejected requests still reach the function and Redis. Use Vercel Firewall
for infrastructure-level traffic controls if needed.

API failures return 503 with no-store. The UI keeps its last valid numbers and
makes up to three visible registration attempts, then continues GET polling.
Hiding the page cancels requests and timers; an interrupted registration resumes
when visible without consuming a failure attempt. Server deduplication makes
retries safe even if the first response was lost.

Unversioned assets revalidate instead of remaining immutable for a year. Browsers
that already cached the old immutable responses may retain them until expiry
or cache clearing. `assets/bg/wavez.gif` is archived source media excluded through
`.vercelignore`; the tracked file remains intact. The site uses the MP4 and poster.

## 📄 License

MIT
