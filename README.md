# nIcO v99 - Gaming Profile

Personal gaming hub & config viewer for **nIcO v99**.

## ✨ Features

- **Interactive Setup** — View CS2 settings, crosshair, and keybinds parsed directly from `config.cfg`.
- **Visual Keyboard (ISO-DE)** — Hover over keys to see binds. Color-coded by action (Combat, Move, Comm, Buy, Misc).
- **Hardware Specs** — Detailed PC components and peripherals list.
- **Social Hub** — Quick links to Steam, FACEIT, Twitch, YouTube, TikTok, X, and Discord.
- **Live Visitor Stats** — Real-time viewer count and total visits tracking using Vercel KV.
- **Immersive UI** — 3D tilt effects, animated background, and glassmorphism design.

## 🛠️ Configuration

The website is powered by the `config.cfg` file.
1.  **Update Settings**: Replace `config.cfg` with your latest CS2 config file.
2.  **Update Binds**: The site automatically reads binds and updates the visual keyboard.
3.  **Crosshair**: The crosshair settings card uses `icons/crosshair.svg` as a custom cursor. Replace this file to change the preview.

## 🗂 Structure

```
├── api/
│   └── visitors.js     # Vercel KV Serverless Visitor Stats API
├── icons/              # Social & UI SVGs
├── assets/             # Images & Backgrounds
├── index.html          # Profile & Hardware
├── settings.html       # CS2 Config & Keyboard
├── script.js           # SPA Routing & UI Logic
├── viewer-stats.js     # Visitor Counter + Live Poll Client
├── styles.css          # Visual Styles
├── config.cfg          # Source of Truth (CS2 Settings)
├── vercel.json         # Vercel Configuration
└── package.json        # Dependencies
```

## 🚀 Deployment

### Local Development
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Start Dev Server** (static files only):
    ```bash
    npm run dev
    ```
3.  **Open Browser**:
    Navigate to `http://localhost:3000`

### Vercel Deployment (with Visitor Stats)
1.  **Connect Vercel KV** (optional, for visitor tracking):
    - Push to GitHub repo connected to Vercel
    - In Vercel Dashboard → Storage → Create KV Database
    - Link database to project
    - Environment variables will auto-populate
2.  **Deploy**:
    - Push changes to GitHub — Vercel auto-deploys
3.  **Verify**:
    - Check `/api/visitors` endpoint for stats
    - Visitor pill appears in top-right with live count updating every ~7 seconds

## 📄 License

Personal project — all rights reserved.
