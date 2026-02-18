# nIcO v99 - Gaming Profile

Personal gaming hub & config viewer for **nIcO v99**.

## ✨ Features

- **Interactive Setup** — View CS2 settings, crosshair, and keybinds parsed directly from `config.cfg`.
- **Visual Keyboard (ISO-DE)** — Hover over keys to see binds. Color-coded by action (Combat, Move, Comm, Buy, Misc).
- **Hardware Specs** — Detailed PC components and peripherals list.
- **Social Hub** — Quick links to Steam, FACEIT, Twitch, YouTube, TikTok, X, and Discord.
- **Immersive UI** — 3D tilt effects, animated background, and glassmorphism design.

## 🛠️ Configuration

The website is powered by the `config.cfg` file.

1. **Update Settings**: Replace `config.cfg` with your latest CS2 config file.
2. **Update Binds**: The site automatically reads binds and updates the visual keyboard.
3. **Crosshair**: The crosshair settings card uses `icons/crosshair.svg` as a custom cursor. Replace this file to change the preview.

## 🗂 Structure

```
├── icons/              # Social & UI SVGs
├── assets/             # Images & Backgrounds
├── index.html          # Profile & Hardware
├── settings.html       # CS2 Config & Keyboard
├── script.js           # SPA Routing & UI Logic
├── styles.css          # Visual Styles
├── config.cfg          # Source of Truth (CS2 Settings)
├── vercel.json         # Vercel Configuration
└── package.json        # Project Metadata
```

## 🚀 Deployment

### Local Development

1. Open `index.html` in your browser
2. Or use a local server:
   ```bash
   python -m http.server 3000
   # or
   npx http-server -p 3000
   ```

### Vercel Deployment

1. Push to GitHub (repo must be connected to Vercel)
2. Vercel auto-deploys on push
3. Visit your deployment URL

Live site: https://nicov99.vercel.app

## 📄 License

Personal project — all rights reserved.
