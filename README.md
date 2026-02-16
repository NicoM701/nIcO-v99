# nicov99.com

Personal gaming profile & link website for **nIcO v99**.

## ✨ Features

- **3D Interactive Card** — Profile card tilts relative to mouse position with parallax depth on avatar, name & social icons
- **Animated Background** — Looping visual background for an immersive feel
- **CS2 Settings (auto-parsed)** — Sensitivity, crosshair, viewmodel, radar and more are automatically read from `config.cfg` — just update the file and redeploy
- **Hardware Specs** — PC components and peripherals at a glance
- **Social Links** — Steam, Discord, FACEIT, YouTube, Twitter/X
- **Purple / Dark Theme** — Matching the Steam profile aesthetic

## 🗂 Structure

```
├── index.html          # Main page
├── styles.css          # Purple/dark theme styles
├── script.js           # 3D card effect + config.cfg parser
├── config.cfg          # CS2 config (update this to change settings)
├── assets/
│   ├── img/
│   │   └── profile.png # Profile picture
│   └── bg/
│       └── wavez.gif   # Background animation
└── README.md
```

## 🚀 Usage

1. Clone the repo
2. Open `index.html` in a browser, or deploy to any static host (GitHub Pages, Netlify, Vercel, etc.)
3. To update CS2 settings: replace `config.cfg` with your latest config and redeploy

## 🔧 Updating Settings

The website reads `config.cfg` at load time and translates CS2 console commands into human-readable settings. Just push an updated `config.cfg` to the repo and the site will reflect the new values automatically on the next visit.

## 📄 License

Personal project — all rights reserved.
