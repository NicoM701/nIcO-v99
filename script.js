/* ========================================
   nIcO v99 — script.js  v2
   Global 3D Tilt + Config Parser + Crosshair Preview
   ======================================== */

// ──────────────────────────────────────────
//  AGE CALCULATION (from hidden meta tag)
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
//  3D CARD TILT — GLOBAL (mouse anywhere)
// ──────────────────────────────────────────
(function initGlobalTilt() {
  const container = document.getElementById('tiltContainer');
  const card = document.getElementById('profileCard');
  const glow = document.getElementById('cardGlow');
  const layerAvatar = document.getElementById('layerAvatar');
  const layerInfo = document.getElementById('layerInfo');

  if (!container || !card) return;

  const MAX_TILT = 16;
  const PARALLAX_INFO = 12;     // info = closer to bg, less movement
  const PARALLAX_AVATAR = 30;   // avatar = furthest out, most movement

  function updateTilt(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Distance from center of card, normalized
    const normX = Math.max(-1, Math.min(1, (clientX - centerX) / (window.innerWidth / 2)));
    const normY = Math.max(-1, Math.min(1, (clientY - centerY) / (window.innerHeight / 2)));

    const rotateY = normX * MAX_TILT;
    const rotateX = -normY * MAX_TILT;

    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

    if (layerInfo) {
      layerInfo.style.transform =
        `translateZ(20px) translateX(${normX * PARALLAX_INFO}px) translateY(${normY * PARALLAX_INFO}px)`;
    }
    if (layerAvatar) {
      layerAvatar.style.transform =
        `translateZ(70px) translateX(${normX * PARALLAX_AVATAR}px) translateY(${normY * PARALLAX_AVATAR}px)`;
    }

    // Glow — position relative to card when mouse is near it
    if (glow) {
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      glow.style.left = `${localX}px`;
      glow.style.top = `${localY}px`;
      // Show glow only when mouse is somewhat close
      const dist = Math.sqrt((clientX - centerX) ** 2 + (clientY - centerY) ** 2);
      glow.classList.toggle('active', dist < 600);
    }
  }

  document.addEventListener('mousemove', (e) => {
    updateTilt(e.clientX, e.clientY);
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
    if (!res.ok) throw new Error('Failed to load config.cfg');
    const raw = await res.text();
    return parseConfigVars(raw);
  } catch (e) {
    console.error(e);
    return null;
  }
}

function parseConfigVars(raw) {
  const vars = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('//')) continue;
    // handle: bind "KEY" "action" — we store these under __binds
    const bindMatch = t.match(/^bind\s+"([^"]+)"\s+"([^"]+)"$/i);
    if (bindMatch) {
      if (!vars.__binds) vars.__binds = [];
      vars.__binds.push({ key: bindMatch[1], action: bindMatch[2] });
      continue;
    }
    const match = t.match(/^(\S+)\s+"?([^"]*)"?\s*$/);
    if (match) {
      vars[match[1].toLowerCase()] = match[2].trim();
    }
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
  const fov = v['viewmodel_fov'] || '—';
  const crosshairSize = v['cl_crosshairsize'] || '—';
  const hand = (v['cl_prefer_lefthanded'] === 'true' || v['cl_prefer_lefthanded'] === '1') ? 'Left' : 'Right';

  const stats = [
    { value: DPI, label: 'DPI' },
    { value: sens, label: 'Sensitivity' },
    { value: edpi, label: 'eDPI' },
    { value: fov, label: 'FOV' },
    { value: crosshairSize, label: 'Crosshair Size' },
    { value: hand, label: 'Preferred Hand' },
  ];

  el.innerHTML = stats.map(s =>
    `<div class="stat-item"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`
  ).join('');
})();


// ──────────────────────────────────────────
//  SETTINGS PAGE — full settings + keybinds
// ──────────────────────────────────────────
(async function settingsPage() {
  const grid = document.getElementById('settingsGrid');
  const bindsGrid = document.getElementById('keybindsGrid');
  if (!grid) return; // not on settings page

  const v = await loadAndParseConfig();
  if (!v) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:24px;">Could not load config.cfg</p>';
    return;
  }

  const settings = buildSettings(v);
  renderSettings(grid, settings, v);

  if (bindsGrid && v.__binds) {
    renderKeybinds(bindsGrid, v.__binds);
  }
})();


function buildSettings(v) {
  const s = {};

  // ── MOUSE & SENSITIVITY ──
  s['Mouse & Sensitivity'] = {};
  const sens = parseFloat(v['sensitivity'] || '0');
  const edpi = Math.round(DPI * sens);
  const zoomSens = parseFloat(v['zoom_sensitivity_ratio'] || '1');
  s['Mouse & Sensitivity']['DPI'] = DPI.toString();
  s['Mouse & Sensitivity']['Sensitivity'] = sens.toString();
  s['Mouse & Sensitivity']['eDPI'] = edpi.toString();
  s['Mouse & Sensitivity']['Zoom Sensitivity'] = parseFloat(zoomSens.toFixed(4)).toString();

  // ── CROSSHAIR ──
  s['Crosshair'] = {};
  const chStyles = { '0': 'Default', '1': 'Default Static', '2': 'Classic', '3': 'Classic Dynamic', '4': 'Classic Static', '5': 'Legacy' };
  if (v['cl_crosshairstyle'] !== undefined) s['Crosshair']['Style'] = chStyles[v['cl_crosshairstyle']] || v['cl_crosshairstyle'];
  if (v['cl_crosshairsize'] !== undefined) s['Crosshair']['Size'] = v['cl_crosshairsize'];
  if (v['cl_crosshairthickness'] !== undefined) s['Crosshair']['Thickness'] = v['cl_crosshairthickness'];
  if (v['cl_crosshairgap'] !== undefined) s['Crosshair']['Gap'] = v['cl_crosshairgap'];
  if (v['cl_crosshairdot'] !== undefined) s['Crosshair']['Dot'] = v['cl_crosshairdot'] === '1' ? 'Yes' : 'No';
  if (v['cl_crosshair_drawoutline'] !== undefined) s['Crosshair']['Outline'] = v['cl_crosshair_drawoutline'] === '1' ? 'Yes' : 'No';
  if (v['cl_crosshair_outlinethickness'] !== undefined) s['Crosshair']['Outline Thickness'] = v['cl_crosshair_outlinethickness'];
  if (v['cl_crosshair_t'] !== undefined) s['Crosshair']['T-Shape'] = v['cl_crosshair_t'] === '1' ? 'Yes' : 'No';

  const chR = v['cl_crosshaircolor_r'] || '50';
  const chG = v['cl_crosshaircolor_g'] || '250';
  const chB = v['cl_crosshaircolor_b'] || '50';
  s['Crosshair']['Color'] = `rgb(${chR}, ${chG}, ${chB})`;
  if (v['cl_crosshairalpha'] !== undefined) s['Crosshair']['Alpha'] = v['cl_crosshairalpha'];
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

  // ── RADAR ──
  s['Radar'] = {};
  if (v['cl_radar_scale'] !== undefined) s['Radar']['Scale'] = v['cl_radar_scale'];
  if (v['cl_radar_rotate'] !== undefined) s['Radar']['Rotate'] = v['cl_radar_rotate'] === '1' ? 'Yes' : 'No';
  if (v['cl_radar_always_centered'] !== undefined) s['Radar']['Always Centered'] = v['cl_radar_always_centered'] === '1' ? 'Yes' : 'No';
  if (v['cl_radar_icon_scale_min'] !== undefined) s['Radar']['Icon Scale'] = v['cl_radar_icon_scale_min'];
  if (v['cl_hud_radar_scale'] !== undefined) s['Radar']['HUD Scale'] = v['cl_hud_radar_scale'];
  if (v['cl_radar_scale_dynamic'] !== undefined) s['Radar']['Dynamic Zoom'] = v['cl_radar_scale_dynamic'] === '1' ? 'Yes' : 'No';

  // ── HUD ──
  s['HUD'] = {};
  const hudColors = { '0': 'Default', '1': 'White', '2': 'Light Blue', '3': 'Dark Blue', '4': 'Purple', '5': 'Red', '6': 'Orange', '7': 'Yellow', '8': 'Green', '9': 'Aqua', '10': 'Pink' };
  if (v['cl_hud_color'] !== undefined) s['HUD']['HUD Color'] = hudColors[v['cl_hud_color']] || v['cl_hud_color'];

  // ── VIDEO & PERFORMANCE ──
  s['Video & Performance'] = {};
  if (v['fps_max'] !== undefined) s['Video & Performance']['FPS Limit'] = v['fps_max'] === '0' ? 'Unlimited' : v['fps_max'];
  if (v['fps_max_ui'] !== undefined) s['Video & Performance']['Menu FPS Limit'] = v['fps_max_ui'];
  if (v['r_fullscreen_gamma'] !== undefined) s['Video & Performance']['Gamma'] = v['r_fullscreen_gamma'];
  if (v['r_player_visibility_mode'] !== undefined) s['Video & Performance']['Boost Player Contrast'] = v['r_player_visibility_mode'] === '1' ? 'Enabled' : 'Disabled';
  if (v['r_drawtracers_firstperson'] !== undefined) s['Video & Performance']['First Person Tracers'] = v['r_drawtracers_firstperson'] === '1' ? 'On' : 'Off';

  return s;
}


function renderSettings(grid, settings, v) {
  grid.innerHTML = '';

  for (const [category, items] of Object.entries(settings)) {
    const realItems = Object.entries(items).filter(([k]) => !k.startsWith('__'));
    if (realItems.length === 0) continue;

    const card = document.createElement('div');
    card.className = 'settings-card';

    const title = document.createElement('h3');
    title.className = 'settings-card-title';
    title.textContent = category;
    card.appendChild(title);

    // Crosshair preview
    if (category === 'Crosshair') {
      const previewWrap = document.createElement('div');
      previewWrap.className = 'crosshair-preview';
      const canvas = document.createElement('canvas');
      canvas.className = 'crosshair-canvas';
      canvas.width = 120;
      canvas.height = 120;
      previewWrap.appendChild(canvas);
      card.appendChild(previewWrap);
      drawCrosshair(canvas, v);
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

    // Share code for crosshair
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


// ──────────────────────────────────────────
//  CROSSHAIR CANVAS PREVIEW
// ──────────────────────────────────────────
function drawCrosshair(canvas, v) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  const r = parseInt(v['cl_crosshaircolor_r'] || '50');
  const g = parseInt(v['cl_crosshaircolor_g'] || '250');
  const b = parseInt(v['cl_crosshaircolor_b'] || '50');
  const alpha = (parseInt(v['cl_crosshairalpha'] || '255')) / 255;
  const size = parseFloat(v['cl_crosshairsize'] || '5') * 4;
  const thickness = parseFloat(v['cl_crosshairthickness'] || '0.5') * 2;
  const gap = parseFloat(v['cl_crosshairgap'] || '0') * 2;
  const hasDot = v['cl_crosshairdot'] === '1';
  const hasOutline = v['cl_crosshair_drawoutline'] === '1';
  const outlineW = parseFloat(v['cl_crosshair_outlinethickness'] || '1');
  const isT = v['cl_crosshair_t'] === '1';

  const color = `rgba(${r},${g},${b},${alpha})`;
  const outlineColor = 'rgba(0,0,0,0.7)';

  function drawBar(x, y, bw, bh) {
    if (hasOutline) {
      ctx.fillStyle = outlineColor;
      ctx.fillRect(x - outlineW, y - outlineW, bw + outlineW * 2, bh + outlineW * 2);
    }
    ctx.fillStyle = color;
    ctx.fillRect(x, y, bw, bh);
  }

  // Right
  drawBar(cx + gap, cy - thickness / 2, size, thickness);
  // Left
  drawBar(cx - gap - size, cy - thickness / 2, size, thickness);
  // Bottom
  drawBar(cx - thickness / 2, cy + gap, thickness, size);
  // Top (unless T-shape)
  if (!isT) {
    drawBar(cx - thickness / 2, cy - gap - size, thickness, size);
  }

  // Dot
  if (hasDot) {
    if (hasOutline) {
      ctx.fillStyle = outlineColor;
      ctx.fillRect(cx - thickness / 2 - outlineW, cy - thickness / 2 - outlineW, thickness + outlineW * 2, thickness + outlineW * 2);
    }
    ctx.fillStyle = color;
    ctx.fillRect(cx - thickness / 2, cy - thickness / 2, thickness, thickness);
  }
}


// ──────────────────────────────────────────
//  KEYBINDS
// ──────────────────────────────────────────
function renderKeybinds(container, binds) {
  const actionMap = {
    '+forward': 'Move Forward', '+back': 'Move Backward', '+left': 'Move Left', '+right': 'Move Right',
    '+jump': 'Jump', '+duck': 'Duck', '+sprint': 'Walk',
    '+attack': 'Fire', '+attack2': 'Aim / Scope', '+reload': 'Reload',
    'drop': 'Drop Weapon', '+use': 'Use',
    '+voicerecord': 'Push to Talk', 'messagemode': 'All Chat', 'messagemode2': 'Team Chat',
    'buymenu': 'Buy Menu', 'teammenu': 'Team Menu', 'lastinv;switchhands': 'Last Weapon / Switch Hands',
    '+showscores': 'Scoreboard', 'cancelselect': 'Menu / Escape',
    '+radialradio': 'Radio Wheel', '+spray_menu': 'Spray Menu',
    'toggleconsole': 'Toggle Console', '+lookatweapon': 'Inspect Weapon',
    'player_ping': 'Player Ping', 'switchhands': 'Switch Hands',
    'invprev': 'Previous Weapon', 'invnext': 'Next Weapon',
    'clutch_mode_toggle': 'Clutch Mode',
    'noclip': 'Noclip',
    'jpeg': 'Screenshot',
    'autobuy': 'Auto Buy',
    'slot1': 'Slot 1', 'slot2': 'Slot 2', 'slot3': 'Slot 3', 'slot4': 'Slot 4',
    'slot5': 'Slot 5', 'slot6': 'Slot 6', 'slot7': 'Slot 7', 'slot8': 'Slot 8',
    'slot9': 'Slot 9', 'slot10': 'Slot 10',
  };

  const keyRename = {
    'MOUSE1': 'Mouse 1', 'MOUSE2': 'Mouse 2', 'MOUSE3': 'Mouse 3',
    'MOUSE4': 'Mouse 4', 'MOUSE5': 'Mouse 5',
    'MWHEELUP': 'Scroll Up', 'MWHEELDOWN': 'Scroll Down',
    'SPACE': 'Space', 'TAB': 'Tab', 'ESCAPE': 'Esc',
    'SHIFT': 'Shift', 'CTRL': 'Ctrl', 'ALT': 'Alt',
    'ENTER': 'Enter', 'PGUP': 'Page Up', 'PGDN': 'Page Down',
  };

  // Categorize
  const categories = {
    'Movement': [],
    'Combat': [],
    'Communication': [],
    'Buy Binds': [],
    'Weapons & Inventory': [],
    'Utility': [],
  };

  const movementActions = ['+forward', '+back', '+left', '+right', '+jump', '+duck', '+sprint', 'noclip'];
  const combatActions = ['+attack', '+attack2', '+reload', 'drop', '+use', 'switchhands', 'lastinv;switchhands', '+lookatweapon'];
  const commActions = ['+voicerecord', 'messagemode', 'messagemode2', '+radialradio', '+spray_menu', 'clutch_mode_toggle'];

  for (const b of binds) {
    const action = b.action;
    const key = b.key;

    // Skip mouse axis binds
    if (key === 'MOUSE_X' || key === 'MOUSE_Y') continue;

    const displayKey = keyRename[key] || key.replace('kp_', 'KP ').toUpperCase();
    const displayAction = actionMap[action] || prettifyAction(action);

    if (movementActions.includes(action)) {
      categories['Movement'].push({ key: displayKey, action: displayAction });
    } else if (combatActions.includes(action)) {
      categories['Combat'].push({ key: displayKey, action: displayAction });
    } else if (commActions.includes(action)) {
      categories['Communication'].push({ key: displayKey, action: displayAction });
    } else if (key.startsWith('kp_') || action.startsWith('buy ') || action === 'sellbackall;sellbackall;') {
      categories['Buy Binds'].push({ key: displayKey, action: displayAction });
    } else if (action.startsWith('slot') || action === 'invprev' || action === 'invnext') {
      categories['Weapons & Inventory'].push({ key: displayKey, action: displayAction });
    } else {
      categories['Utility'].push({ key: displayKey, action: displayAction });
    }
  }

  container.innerHTML = '';

  for (const [cat, items] of Object.entries(categories)) {
    if (items.length === 0) continue;

    const card = document.createElement('div');
    card.className = 'keybind-card';

    const title = document.createElement('h3');
    title.className = 'keybind-card-title';
    title.textContent = cat;
    card.appendChild(title);

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'bind-row';
      row.innerHTML = `<span class="bind-action">${item.action}</span><span class="bind-key">${item.key}</span>`;
      card.appendChild(row);
    }

    container.appendChild(card);
  }
}

function prettifyAction(action) {
  // Handle buy commands
  if (action.startsWith('buy ')) {
    const items = action.split(';').map(s => s.trim()).filter(Boolean);
    const names = items.map(s => {
      const m = s.match(/^buy\s+(.+)$/);
      if (!m) return s;
      return weaponName(m[1]);
    });
    return names.join(' / ');
  }
  if (action === 'sellbackall;sellbackall;') return 'Sell All';
  // Handle chatwheel
  if (action.includes('Chatwheel_') || action.includes('playerchatwheel')) {
    const m = action.match(/#Chatwheel_(\w+)/);
    if (m) return 'Chat: ' + m[1].replace(/([A-Z])/g, ' $1').trim();
    return 'Chat Wheel';
  }
  // Handle radio
  if (action.match(/^radio\d$/)) return 'Radio ' + action.slice(-1);
  // Handle say
  if (action.startsWith('say ')) return 'Say "' + action.slice(4) + '"';
  // Handle volume
  if (action.startsWith('volume ')) return 'Set Volume ' + action.slice(7);
  // Handle toggle
  if (action.startsWith('toggle ')) return 'Toggle ' + action.split(' ')[1];
  return action;
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
