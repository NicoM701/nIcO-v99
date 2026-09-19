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
│   └── keyboard.js       # Visual keyboard
├── tests/
│   └── config.test.js    # Parser, DE layout, and alias tests
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
npm test
```

## 🚀 Deployment

1. Push to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Create a free [Upstash Redis](https://upstash.com) database
4. Add environment variables in Vercel project settings:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
5. Deploy!

## 📄 License

MIT
