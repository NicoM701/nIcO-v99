/* ========================================
   nIcO v99 — script.js  v3.2
   Global 3D Tilt + Config Parser + Keyboard Layout
   ======================================== */

// ──────────────────────────────────────────
//  AGE CALCULATION
// ──────────────────────────────────────────
(function calcAge() {
  const meta = document.querySelector('meta[name="bd"]');
  const el = document.getElementById('userAge');
  if (!meta || !el) return;
  const bd = new Date(meta.content);
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  el.textContent = age;
})();


// ──────────────────────────────────────────
//  3D CARD TILT — GLOBAL
// ──────────────────────────────────────────
(function initGlobalTilt() {
  const container = document.getElementById('tiltContainer');
  const card = document.getElementById('profileCard');
  const glow = document.getElementById('cardGlow');

  const layerAvatar = document.getElementById('layerAvatar');
  const layerName = document.getElementById('layerName');
  const layerTag = document.getElementById('layerTag'); // Separate layer

  if (!container || !card) return;

  const MAX_TILT = 8;

  // Parallax depths (reduced by 50%)
  const DEPTH_TAG = 8;
  const DEPTH_NAME = 22;
  const DEPTH_AVATAR = 45;

  document.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const normX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (window.innerWidth / 2)));
    const normY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (window.innerHeight / 2)));

    card.style.transform = `rotateX(${-normY * MAX_TILT}deg) rotateY(${normX * MAX_TILT}deg)`;

    if (layerTag) {
      layerTag.style.transform = `translateZ(20px) translateX(${normX * DEPTH_TAG}px) translateY(${normY * DEPTH_TAG}px)`;
    }
    if (layerName) {
      layerName.style.transform = `translateZ(50px) translateX(${normX * DEPTH_NAME}px) translateY(${normY * DEPTH_NAME}px)`;
    }
    if (layerAvatar) {
      layerAvatar.style.transform = `translateZ(80px) translateX(${normX * DEPTH_AVATAR}px) translateY(${normY * DEPTH_AVATAR}px)`;
    }

    if (glow) {
      glow.style.left = `${e.clientX - rect.left}px`;
      glow.style.top = `${e.clientY - rect.top}px`;
      const dist = Math.sqrt((e.clientX - centerX) ** 2 + (e.clientY - centerY) ** 2);
      glow.classList.toggle('active', dist < 600);
    }
  });
})();


// ──────────────────────────────────────────
//  CONFIG PARSER
// ──────────────────────────────────────────
const DPI = 1200;
const CROSSHAIR_CODE = 'CSGO-JQZpU-3m3wr-rv889-nUCtF-WHFFN';

async function loadAndParseConfig() {
  try {
    const res = await fetch('config.cfg');
    if (!res.ok) throw new Error('Failed to load');
    return parseConfigVars(await res.text());
  } catch (e) {
    console.error(e);
    return null;
  }
}

function parseConfigVars(raw) {
  const vars = { __binds: [] };
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('//')) continue;
    const bindMatch = t.match(/^bind\s+"([^"]+)"\s+"([^"]+)"$/i);
    if (bindMatch) {
      vars.__binds.push({ key: bindMatch[1], action: bindMatch[2] });
      continue;
    }
    const match = t.match(/^(\S+)\s+"?([^"]*)"?\s*$/);
    if (match) vars[match[1].toLowerCase()] = match[2].trim();
  }
  return vars;
}


// ──────────────────────────────────────────
//  HOME PAGE — settings overview
// ──────────────────────────────────────────
(async function homeOverview() {
  const el = document.getElementById('settingsOverview');
  if (!el) return;

  const v = await loadAndParseConfig();
  if (!v) { el.innerHTML = '<p style="color:var(--text-muted)">Could not load settings.</p>'; return; }

  const sens = parseFloat(v['sensitivity'] || '0');
  const edpi = Math.round(DPI * sens);

  // Filtered list for Home Page
  const stats = [
    { value: DPI, label: 'DPI' },
    { value: sens, label: 'Sensitivity' },
    { value: edpi, label: 'eDPI' },
    { value: parseFloat(parseFloat(v['zoom_sensitivity_ratio'] || '1').toFixed(4)), label: 'Zoom Sens' },
    { value: '1000 Hz', label: 'Polling Rate' },
    { value: '1920x1080', label: 'Resolution' },
    { value: '16:9', label: 'Aspect Ratio' },
    { value: 'Fullscreen', label: 'Mode' },
  ];

  // Split into two explicit rows
  const row1 = stats.slice(0, 5);
  const row2 = stats.slice(5);

  const renderRow = (items) => items.map(s =>
    `<div class="stat-item"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`
  ).join('');

  el.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:20px; width:100%;">
      ${renderRow(row1)}
    </div>
    <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:20px; width:100%; margin-top:12px;">
      ${renderRow(row2)}
    </div>
  `;
})();


// ──────────────────────────────────────────
//  SETTINGS PAGE
// ──────────────────────────────────────────
(async function settingsPage() {
  const grid = document.getElementById('settingsGrid');
  const kbWrap = document.getElementById('keyboardWrap');
  if (!grid) return;

  const v = await loadAndParseConfig();
  if (!v) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center">Could not load config.cfg</p>';
    return;
  }

  renderSettings(grid, buildSettings(v), v);

  if (kbWrap && v.__binds) {
    renderKeyboard(kbWrap, v.__binds);
  }
})();


function buildSettings(v) {
  const s = {};

  // ── MOUSE & SENSITIVITY ──
  const sens = parseFloat(v['sensitivity'] || '0');
  s['Mouse & Sensitivity'] = {
    'DPI': DPI.toString(),
    'Sensitivity': sens.toString(),
    'eDPI': Math.round(DPI * sens).toString(),
    'Zoom Sensitivity': parseFloat(parseFloat(v['zoom_sensitivity_ratio'] || '1').toFixed(4)).toString(),
    'Polling Rate': '1000 Hz',
  };

  // ── VIDEO & PERFORMANCE ──
  s['Video & Performance'] = {
    'Resolution': '1920x1080',
    'Aspect Ratio': '16:9',
    'Display Mode': 'Fullscreen',
    'Refresh Rate': '240 Hz',
  };
  // Restore FPS / Gamma from config if available
  if (v['fps_max'] !== undefined) s['Video & Performance']['FPS Limit'] = v['fps_max'] === '0' ? 'Unlimited' : v['fps_max'];
  if (v['fps_max_ui'] !== undefined) s['Video & Performance']['Menu FPS Limit'] = v['fps_max_ui'];
  if (v['r_fullscreen_gamma'] !== undefined) s['Video & Performance']['Gamma'] = v['r_fullscreen_gamma'];
  if (v['r_player_visibility_mode'] !== undefined) s['Video & Performance']['Boost Player Contrast'] = v['r_player_visibility_mode'] === '1' ? 'Enabled' : 'Disabled';


  // ── CROSSHAIR ──
  const chStyles = { '0': 'Default', '1': 'Default Static', '2': 'Classic', '3': 'Classic Dynamic', '4': 'Classic Static', '5': 'Legacy' };
  const chR = v['cl_crosshaircolor_r'] || '50';
  const chG = v['cl_crosshaircolor_g'] || '250';
  const chB = v['cl_crosshaircolor_b'] || '50';
  s['Crosshair'] = {};
  if (v['cl_crosshairstyle'] !== undefined) s['Crosshair']['Style'] = chStyles[v['cl_crosshairstyle']] || v['cl_crosshairstyle'];
  if (v['cl_crosshairsize'] !== undefined) s['Crosshair']['Size'] = v['cl_crosshairsize'];
  if (v['cl_crosshairgap'] !== undefined) s['Crosshair']['Gap'] = v['cl_crosshairgap'];
  if (v['cl_crosshairdot'] !== undefined) s['Crosshair']['Dot'] = v['cl_crosshairdot'] === '1' ? 'Yes' : 'No';
  if (v['cl_crosshair_drawoutline'] !== undefined) s['Crosshair']['Outline'] = v['cl_crosshair_drawoutline'] === '1' ? 'Yes' : 'No';
  s['Crosshair']['Color'] = `rgb(${chR}, ${chG}, ${chB})`;
  if (v['cl_crosshair_sniper_width'] !== undefined) s['Crosshair']['Sniper Width'] = v['cl_crosshair_sniper_width'];
  s['Crosshair']['__sharecode'] = CROSSHAIR_CODE;

  // ── VIEWMODEL ──
  s['Viewmodel'] = {};
  if (v['viewmodel_fov'] !== undefined) s['Viewmodel']['FOV'] = v['viewmodel_fov'];
  if (v['viewmodel_offset_x'] !== undefined) s['Viewmodel']['Offset X'] = v['viewmodel_offset_x'];
  if (v['viewmodel_offset_y'] !== undefined) s['Viewmodel']['Offset Y'] = v['viewmodel_offset_y'];
  if (v['viewmodel_offset_z'] !== undefined) s['Viewmodel']['Offset Z'] = v['viewmodel_offset_z'];
  if (v['cl_prefer_lefthanded'] !== undefined) {
    s['Viewmodel']['Preferred Hand'] = (v['cl_prefer_lefthanded'] === 'true' || v['cl_prefer_lefthanded'] === '1') ? 'Left' : 'Right';
  }
  s['Viewmodel']['Switch Hands'] = 'Mouse 5';

  // ── RADAR & HUD (merged) ──
  s['Radar & HUD'] = {};
  if (v['cl_radar_scale'] !== undefined) s['Radar & HUD']['Radar Scale'] = v['cl_radar_scale'];
  if (v['cl_radar_rotate'] !== undefined) s['Radar & HUD']['Rotate'] = v['cl_radar_rotate'] === '1' ? 'Yes' : 'No';
  if (v['cl_radar_always_centered'] !== undefined) s['Radar & HUD']['Always Centered'] = v['cl_radar_always_centered'] === '1' ? 'Yes' : 'No';
  if (v['cl_radar_icon_scale_min'] !== undefined) s['Radar & HUD']['Icon Scale'] = v['cl_radar_icon_scale_min'];
  if (v['cl_hud_radar_scale'] !== undefined) s['Radar & HUD']['HUD Scale'] = v['cl_hud_radar_scale'];
  if (v['cl_radar_scale_dynamic'] !== undefined) s['Radar & HUD']['Dynamic Zoom'] = v['cl_radar_scale_dynamic'] === '1' ? 'Yes' : 'No';
  const hudColors = { '0': 'Default', '1': 'White', '2': 'Light Blue', '3': 'Dark Blue', '4': 'Purple', '5': 'Red', '6': 'Orange', '7': 'Yellow', '8': 'Green', '9': 'Aqua', '10': 'Pink' };
  if (v['cl_hud_color'] !== undefined) s['Radar & HUD']['HUD Color'] = hudColors[v['cl_hud_color']] || v['cl_hud_color'];

  return s;
}


function renderSettings(grid, settings, v) {
  grid.innerHTML = '';

  for (const [category, items] of Object.entries(settings)) {
    const realItems = Object.entries(items).filter(([k]) => !k.startsWith('__'));
    if (realItems.length === 0) continue;

    const card = document.createElement('div');
    card.className = 'settings-card';
    if (realItems.length <= 4) card.className += ' settings-card--compact';

    const title = document.createElement('h3');
    title.className = 'settings-card-title';
    title.textContent = category;
    card.appendChild(title);

    // Dynamic Crosshair Cursor for this card
    if (category === 'Crosshair') {
      card.style.cursor = `url('icons/crosshair.svg') 12 12, auto`;
    }

    for (const [label, value] of realItems) {
      const row = document.createElement('div');
      row.className = 'setting-row';

      const labelEl = document.createElement('span');
      labelEl.className = 'setting-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.className = 'setting-value';

      if (label === 'Color' && value.startsWith('rgb')) {
        valueEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="width:14px;height:14px;border-radius:3px;background:${value};display:inline-block;border:1px solid rgba(255,255,255,0.15);"></span>
          ${value}
        </span>`;
      } else {
        valueEl.textContent = value;
      }

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      card.appendChild(row);
    }

    // Share code copy button for crosshair
    if (items['__sharecode']) {
      const row = document.createElement('div');
      row.className = 'setting-row';
      const labelEl = document.createElement('span');
      labelEl.className = 'setting-label';
      labelEl.textContent = 'Share Code';
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.innerHTML = `<svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        <span>${items['__sharecode']}</span>`;
      btn.title = 'Click to copy';
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(items['__sharecode']).then(() => {
          btn.querySelector('span').textContent = 'Copied!';
          setTimeout(() => { btn.querySelector('span').textContent = items['__sharecode']; }, 1500);
        });
      });
      row.appendChild(labelEl);
      row.appendChild(btn);
      card.appendChild(row);
    }

    grid.appendChild(card);
  }
}

function weaponName(code) {
  const names = {
    'ak47': 'AK-47', 'm4a1_silencer': 'M4A1-S', 'm4a1': 'M4A4', 'awp': 'AWP',
    'deagle': 'Desert Eagle', 'p250': 'P250', 'fiveseven': 'Five-SeveN', 'tec9': 'Tec-9',
    'galilar': 'Galil AR', 'famas': 'FAMAS', 'mp9': 'MP9', 'mac10': 'MAC-10',
    'vest': 'Kevlar', 'vesthelm': 'Kevlar + Helmet', 'defuser': 'Defuse Kit',
    'smokegrenade': 'Smoke', 'flashbang': 'Flash', 'hegrenade': 'HE Grenade',
    'molotov': 'Molotov', 'incgrenade': 'Incendiary',
  };
  return names[code] || code;
}



// ──────────────────────────────────────────
//  INTERACTIVE KEYBOARD LAYOUT
//  ISO-DE 96% (Keychron K4 style) - Absolute Positioning
// ──────────────────────────────────────────
function renderKeyboard(container, binds) {
  const bindMap = {};
  for (const b of binds) {
    let k = b.key.toLowerCase();
    // Swap CONFIG keys to match VISUAL DE layout
    // Config 'z' (US pos) -> Visual 'y' key (DE pos)
    // Config 'y' (US pos) -> Visual 'z' key (DE pos)
    if (k === 'y') k = 'z';
    else if (k === 'z') k = 'y';
    bindMap[k] = b.action;
  }

  const U = 44;

  const k = (id, label, x, y, w = 1, h = 1) => ({ id, label, x, y, w, h });

  const keys = [
    // --- ROW 0 (F-Keys) ---
    k('escape', 'Esc', 0, 0),
    k('f1', 'F1', 1.5, 0), k('f2', 'F2', 2.5, 0), k('f3', 'F3', 3.5, 0), k('f4', 'F4', 4.5, 0),
    k('f5', 'F5', 6, 0), k('f6', 'F6', 7, 0), k('f7', 'F7', 8, 0), k('f8', 'F8', 9, 0),
    k('f9', 'F9', 10.5, 0), k('f10', 'F10', 11.5, 0), k('f11', 'F11', 12.5, 0), k('f12', 'F12', 13.5, 0),
    k('del', 'Del', 15, 0), k('ins', 'Ins', 16, 0), k('pgup', 'PgUp', 17, 0), k('pgdn', 'PgDn', 18, 0),

    // --- ROW 1 (Numbers) ---
    k('^', '^', 0, 1.25), k('1', '1', 1, 1.25), k('2', '2', 2, 1.25), k('3', '3', 3, 1.25),
    k('4', '4', 4, 1.25), k('5', '5', 5, 1.25), k('6', '6', 6, 1.25), k('7', '7', 7, 1.25),
    k('8', '8', 8, 1.25), k('9', '9', 9, 1.25), k('0', '0', 10, 1.25), k('ss', 'ß', 11, 1.25),
    k('acute', '´', 12, 1.25), k('backspace', '⌫', 13, 1.25, 2),
    k('numlock', 'Num', 15.5, 1.25), k('kp_slash', '/', 16.5, 1.25), k('kp_multiply', '*', 17.5, 1.25), k('kp_minus', '-', 18.5, 1.25),

    // --- ROW 2 (QWERTY) ---
    k('tab', 'Tab', 0, 2.25, 1.5),
    k('q', 'Q', 1.5, 2.25), k('w', 'W', 2.5, 2.25), k('e', 'E', 3.5, 2.25), k('r', 'R', 4.5, 2.25),
    k('t', 'T', 5.5, 2.25), k('z', 'Z', 6.5, 2.25), k('u', 'U', 7.5, 2.25), k('i', 'I', 8.5, 2.25),
    k('o', 'O', 9.5, 2.25), k('p', 'P', 10.5, 2.25), k('ue', 'Ü', 11.5, 2.25), k('plus', '+', 12.5, 2.25),
    k('kp_7', '7', 15.5, 2.25), k('kp_8', '8', 16.5, 2.25), k('kp_9', '9', 17.5, 2.25), k('kp_plus', '+', 18.5, 2.25, 1, 2),

    // --- ROW 3 (ASDF) ---
    k('capslock', 'Caps', 0, 3.25, 1.75),
    k('a', 'A', 1.75, 3.25), k('s', 'S', 2.75, 3.25), k('d', 'D', 3.75, 3.25), k('f', 'F', 4.75, 3.25),
    k('g', 'G', 5.75, 3.25), k('h', 'H', 6.75, 3.25), k('j', 'J', 7.75, 3.25), k('k', 'K', 8.75, 3.25),
    k('l', 'L', 9.75, 3.25), k('oe', 'Ö', 10.75, 3.25), k('ae', 'Ä', 11.75, 3.25), k('hash', '#', 12.75, 3.25),

    // ENTER KEY (Split parts but treated as one ID for coloring)
    // The bottom part is bound to 'enter', the top part is visual extension
    k('enter', '', 13.5, 2.25, 1.5, 1),      // Top part
    k('enter', 'Enter', 13.75, 3.25, 1.25),  // Bottom part

    k('kp_4', '4', 15.5, 3.25), k('kp_5', '5', 16.5, 3.25), k('kp_6', '6', 17.5, 3.25),

    // --- ROW 4 (ZXCV) ---
    k('shift', 'Shift', 0, 4.25, 1.25), k('less', '<', 1.25, 4.25),
    k('y', 'Y', 2.25, 4.25), k('x', 'X', 3.25, 4.25), k('c', 'C', 4.25, 4.25), k('v', 'V', 5.25, 4.25),
    k('b', 'B', 6.25, 4.25), k('n', 'N', 7.25, 4.25), k('m', 'M', 8.25, 4.25),
    k('comma', ',', 9.25, 4.25), k('period', '.', 10.25, 4.25), k('minus', '-', 11.25, 4.25),
    k('rshift', 'Shift', 12.25, 4.25, 1.75),
    k('uparrow', '↑', 14.25, 4.25),
    k('kp_1', '1', 15.5, 4.25), k('kp_2', '2', 16.5, 4.25), k('kp_3', '3', 17.5, 4.25), k('kp_enter', '⏎', 18.5, 4.25, 1, 2),

    // --- ROW 5 (Mods) ---
    k('ctrl', 'Ctrl', 0, 5.25, 1.25), k('win', 'Win', 1.25, 5.25, 1.25), k('alt', 'Alt', 2.5, 5.25, 1.25),
    k('space', 'Space', 3.75, 5.25, 6.25),
    k('ralt', 'AltGr', 10, 5.25, 1), k('fn', 'Fn', 11, 5.25, 1), k('rctrl', 'Ctrl', 12, 5.25, 1),
    k('leftarrow', '←', 13.25, 5.25), k('downarrow', '↓', 14.25, 5.25), k('rightarrow', '→', 15.25, 5.25),
    k('kp_0', '0', 16.5, 5.25, 1), k('kp_del', '.', 17.5, 5.25, 1),
  ];

  /*
    COLOR CATEGORIES:
    - Movement (Purple)
    - Combat (Red)
    - Communication (Green)
    - Miscellaneous (Blue)
    - Buy (Yellow/Orange)
  */

  function getCategory(action) {
    if (!action) return 'utility'; // Default Blue (Misc)

    // PURPLE: Jump, Move, Walk, Crouch, Noclip
    if (['Move Forward', 'Move Backward', 'Move Left', 'Move Right', 'Jump', 'Duck', 'Walk', 'Noclip'].includes(action)) return 'move';

    // RED: Weapons, Grenades, Slots 6-10, Use, Fire, Scope
    if (['Primary', 'Secondary', 'Knife', 'Grenades', 'Bomb / Defuse', 'Slot 6', 'Slot 7', 'Slot 8', 'Slot 9', 'Slot 10',
      'Drop Weapon', 'Reload', 'Prev Weapon', 'Next Weapon', 'Fire', 'Scope / Aim', 'Use', 'Last Weapon / Switch Hands'].includes(action)) return 'combat';

    // GREEN: Chat, Radio, Ping, Clutch Mode
    if (action.startsWith('Chat:') || action.startsWith('Radio') || action.startsWith('Say')) return 'comm';
    if (['Push to Talk', 'All Chat', 'Team Chat', 'Radio Wheel', 'Speech Menu', 'Ping', 'Clutch Mode'].includes(action)) return 'comm';

    // YELLOW: Buy
    if (action.startsWith('Buy:') || ['Buy Menu', 'Sell All', 'Auto Buy'].includes(action)) return 'buy';

    // BLUE (Miscellaneous): Default fallback
    // Explicitly listed by user: Inspect Weapon, Switch Hands, Scoreboard, Spray Menu, Team Menu
    // Plus console, screenshot etc.
    return 'utility';
  }

  // Action name lookup
  const actionNames = {
    '+forward': 'Move Forward', '+back': 'Move Backward', '+left': 'Move Left', '+right': 'Move Right',
    '+jump': 'Jump', '+duck': 'Duck', '+sprint': 'Walk',
    '+attack': 'Fire', '+attack2': 'Scope / Aim', '+reload': 'Reload',
    'drop': 'Drop Weapon', '+use': 'Use',
    '+voicerecord': 'Push to Talk', 'messagemode': 'All Chat', 'messagemode2': 'Team Chat',
    'buymenu': 'Buy Menu', 'teammenu': 'Team Menu', 'lastinv;switchhands': 'Last Weapon / Switch Hands',
    '+showscores': 'Scoreboard', 'cancelselect': 'Menu',
    '+radialradio': 'Radio Wheel', '+spray_menu': 'Spray Menu',
    'toggleconsole': 'Toggle Console', '+lookatweapon': 'Inspect Weapon',
    'player_ping': 'Ping', 'switchhands': 'Switch Hands',
    'invprev': 'Prev Weapon', 'invnext': 'Next Weapon',
    'clutch_mode_toggle': 'Clutch Mode', 'noclip': 'Noclip',
    'jpeg': 'Screenshot', 'autobuy': 'Auto Buy',
    'slot1': 'Primary', 'slot2': 'Secondary', 'slot3': 'Knife', 'slot4': 'Grenades',
    'slot5': 'Bomb / Defuse', 'slot6': 'Slot 6', 'slot7': 'Slot 7', 'slot8': 'Slot 8',
    'slot9': 'Slot 9', 'slot10': 'Slot 10',
  };

  function getActionName(action) {
    if (actionNames[action]) return actionNames[action];
    if (action.startsWith('buy ')) {
      const items = action.split(';').filter(Boolean).map(s => {
        const m = s.trim().match(/^buy\s+(.+)$/);
        return m ? weaponName(m[1]) : s.trim();
      });
      return 'Buy: ' + items.join(' / ');
    }
    if (action === 'sellbackall;sellbackall;') return 'Sell All';
    if (action.includes('Chatwheel_')) {
      const m = action.match(/#Chatwheel_(\w+)/);
      return m ? 'Chat: ' + m[1].replace(/([A-Z])/g, ' $1').trim() : 'Chat Wheel';
    }
    if (action.startsWith('radio')) return 'Radio ' + action.slice(-1);
    if (action.startsWith('say ')) return 'Say "' + action.slice(4) + '"';
    if (action.startsWith('volume ')) return 'Volume ' + action.slice(7);
    if (action.startsWith('toggle ')) return 'Toggle ' + action.split(' ')[1];
    return action;
  }

  // --- RENDER KEYBOARD ---
  const keyboard = document.createElement('div');
  keyboard.className = 'keyboard';

  const maxX = 19.5 * U;
  const maxY = 6.25 * U; // 5 rows + gaps
  keyboard.style.width = `${maxX}px`;
  keyboard.style.height = `${maxY}px`;

  // Tooltip - append to BODY to avoid clipping
  let tooltip = document.querySelector('.kb-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'kb-tooltip';
    document.body.appendChild(tooltip);
  } else {
    tooltip.style.display = 'none';
  }

  // Helper for synchronized enter highlighting
  const enterKeys = [];

  // Cleanup old tooltip listeners if re-rendering?
  // Should ideally remove old tooltip if it exists, or reuse.
  // Since we append to body, we might have multiple if we re-render.
  // Best to only create if not exists, or empty it.

  keys.forEach(k => {
    const keyEl = document.createElement('div');
    keyEl.className = 'kb-key';
    keyEl.textContent = k.label;

    // Absolute positioning
    keyEl.style.position = 'absolute';
    keyEl.style.left = `${k.x * U}px`;
    keyEl.style.top = `${k.y * U}px`;
    keyEl.style.width = `${k.w * U - 4}px`;
    keyEl.style.height = `${k.h * U - 4}px`;

    if (k.id === 'escape') keyEl.classList.add('kb-key--accent');

    // Handle Enter Key merging
    if (k.id === 'enter') enterKeys.push(keyEl);

    const bound = bindMap[k.id];
    if (bound) {
      const actionText = getActionName(bound);
      const cat = getCategory(actionText);
      keyEl.classList.add('kb-key--bound', `kb-key--${cat}`);

      keyEl.addEventListener('mouseenter', (e) => {
        tooltip.textContent = actionText;
        tooltip.style.display = 'block';

        // Use page coordinates for body-appended tooltip
        const rect = keyEl.getBoundingClientRect();
        const docScrollY = window.scrollY;

        // Position above the key
        const ttW = tooltip.offsetWidth;
        const ttH = tooltip.offsetHeight;

        let left = rect.left + rect.width / 2;
        let top = rect.top + docScrollY - 8;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.position = 'absolute'; // Ensure it's absolute in body context
        tooltip.style.transform = 'translate(-50%, -100%)';
        tooltip.style.zIndex = '9999';

        // Enter Highlight Sync
        if (k.id === 'enter') enterKeys.forEach(el => el.classList.add('kb-key--hover'));
      });

      keyEl.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
        if (k.id === 'enter') enterKeys.forEach(el => el.classList.remove('kb-key--hover'));
      });
    }

    keyboard.appendChild(keyEl);
  });

  // --- MOUSE SECTION ---
  const mouseSection = document.createElement('div');
  mouseSection.className = 'kb-mouse-section';
  mouseSection.innerHTML = '<div class="kb-mouse-title">Mouse</div>';
  const mouseGrid = document.createElement('div');
  mouseGrid.className = 'kb-mouse-grid';

  const mouseKeys = [
    { id: 'mouse1', label: 'M1' }, { id: 'mouse2', label: 'M2' },
    { id: 'mouse3', label: 'M3' }, { id: 'mouse4', label: 'M4' },
    { id: 'mouse5', label: 'M5' },
    { id: 'mwheelup', label: 'Scroll ↑' }, { id: 'mwheeldown', label: 'Scroll ↓' },
  ];

  mouseKeys.forEach(mk => {
    const keyEl = document.createElement('div');
    keyEl.className = 'kb-key kb-key--mouse';
    keyEl.textContent = mk.label;
    keyEl.style.position = 'relative';
    keyEl.style.width = '50px';
    keyEl.style.height = '40px';

    const bound = bindMap[mk.id];
    if (bound) {
      const actionText = getActionName(bound);
      const cat = getCategory(actionText);
      keyEl.classList.add('kb-key--bound', `kb-key--${cat}`);

      keyEl.addEventListener('mouseenter', (e) => {
        tooltip.textContent = actionText;
        tooltip.style.display = 'block';

        const rect = keyEl.getBoundingClientRect();
        const docScrollY = window.scrollY;

        let left = rect.left + rect.width / 2;
        let top = rect.top + docScrollY - 8;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.position = 'absolute';
        tooltip.style.transform = 'translate(-50%, -100%)';
        tooltip.style.zIndex = '9999';
      });
      keyEl.addEventListener('mouseleave', () => tooltip.style.display = 'none');
    }
    mouseGrid.appendChild(keyEl);
  });

  mouseSection.appendChild(mouseGrid);

  // --- LEGEND ---
  const legend = document.createElement('div');
  legend.className = 'kb-legend';
  const cats = [
    { label: 'Movement', cls: 'move' },
    { label: 'Combat', cls: 'combat' },
    { label: 'Communication', cls: 'comm' },
    { label: 'Miscellaneous', cls: 'utility' }, // Renamed from Utility
    { label: 'Buy', cls: 'buy' },
  ];
  legend.innerHTML = cats.map(c =>
    `<div class="kb-legend-item"><span class="kb-dot kb-dot--${c.cls}"></span>${c.label}</div>`
  ).join('');

  container.innerHTML = '';
  // Removed container.appendChild(tooltip); since it's on body now
  container.appendChild(keyboard);
  container.appendChild(mouseSection);
  container.appendChild(legend);
}
