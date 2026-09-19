export const DPI = 1200;
export const CROSSHAIR_CODE = 'CSGO-JQZpU-3m3wr-rv889-nUCtF-WHFFN';

const WEAPON_NAMES = {
  ak47: 'AK-47',
  m4a1_silencer: 'M4A1-S',
  m4a1: 'M4A4',
  awp: 'AWP',
  deagle: 'Desert Eagle',
  p250: 'P250',
  fiveseven: 'Five-SeveN',
  tec9: 'Tec-9',
  galilar: 'Galil AR',
  famas: 'FAMAS',
  mp9: 'MP9',
  mac10: 'MAC-10',
  vest: 'Kevlar',
  vesthelm: 'Kevlar + Helmet',
  defuser: 'Defuse Kit',
  smokegrenade: 'Smoke',
  flashbang: 'Flash',
  hegrenade: 'HE Grenade',
  molotov: 'Molotov',
  incgrenade: 'Incendiary',
};

const ACTION_NAMES = {
  '+forward': 'Move Forward',
  '+back': 'Move Backward',
  '+left': 'Move Left',
  '+right': 'Move Right',
  '+jump': 'Jump',
  '+duck': 'Duck',
  '+sprint': 'Walk',
  '+attack': 'Fire',
  '+attack2': 'Scope / Aim',
  '+reload': 'Reload',
  drop: 'Drop Weapon',
  '+use': 'Use',
  '+voicerecord': 'Push to Talk',
  messagemode: 'All Chat',
  messagemode2: 'Team Chat',
  buymenu: 'Buy Menu',
  teammenu: 'Team Menu',
  'lastinv;switchhands': 'Last Weapon / Switch Hands',
  '+showscores': 'Scoreboard',
  cancelselect: 'Menu',
  '+radialradio': 'Radio Wheel',
  '+spray_menu': 'Spray Menu',
  toggleconsole: 'Toggle Console',
  '+lookatweapon': 'Inspect Weapon',
  player_ping: 'Ping',
  switchhands: 'Switch Hands',
  invprev: 'Prev Weapon',
  invnext: 'Next Weapon',
  clutch_mode_toggle: 'Clutch Mode',
  noclip: 'Noclip',
  jpeg: 'Screenshot',
  autobuy: 'Auto Buy',
  slot1: 'Primary',
  slot2: 'Secondary',
  slot3: 'Knife',
  slot4: 'Grenades',
  slot5: 'Bomb / Defuse',
  slot6: 'Slot 6',
  slot7: 'Slot 7',
  slot8: 'Slot 8',
  slot9: 'Slot 9',
  slot10: 'Slot 10',
};

const MOVEMENT_ACTIONS = new Set([
  'Move Forward', 'Move Backward', 'Move Left', 'Move Right',
  'Jump', 'Duck', 'Walk', 'Walk • Buy Modifier', 'Noclip',
]);

const COMBAT_ACTIONS = new Set([
  'Primary', 'Secondary', 'Knife', 'Grenades', 'Bomb / Defuse',
  'Slot 6', 'Slot 7', 'Slot 8', 'Slot 9', 'Slot 10',
  'Drop Weapon', 'Reload', 'Prev Weapon', 'Next Weapon',
  'Fire', 'Scope / Aim', 'Use', 'Last Weapon / Switch Hands',
]);

const COMM_ACTIONS = new Set([
  'Push to Talk', 'All Chat', 'Team Chat', 'Radio Wheel',
  'Speech Menu', 'Ping', 'Clutch Mode',
]);

const BUY_ACTIONS = new Set([
  'Buy Menu', 'Sell All', 'Auto Buy', 'Donate Buy Layer', 'Normal Buy Layer',
]);

let configCache = null;

export function stripInlineComment(line) {
  let inQuotes = false;
  for (let i = 0; i < line.length - 1; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === '/' && line[i + 1] === '/') {
      return line.slice(0, i).trimEnd();
    }
  }
  return line;
}

export function parseConfigVars(raw) {
  const vars = { __binds: [], __aliases: {} };
  for (const line of raw.split('\n')) {
    const t = stripInlineComment(line).trim();
    if (!t || t.startsWith('//')) continue;

    const bindMatch = t.match(/^bind\s+"([^"]+)"\s+"([^"]+)"$/i);
    if (bindMatch) {
      vars.__binds.push({ key: bindMatch[1], action: bindMatch[2] });
      continue;
    }

    const aliasMatch = t.match(/^alias\s+([^\s]+)\s+"([^"]+)"$/i);
    if (aliasMatch) {
      vars.__aliases[aliasMatch[1].toLowerCase()] = aliasMatch[2];
      continue;
    }

    const match = t.match(/^(\S+)\s+"?([^"]*)"?\s*$/);
    if (match) vars[match[1].toLowerCase()] = match[2].trim();
  }
  return vars;
}

export function mapConfigKeyToVisualId(key) {
  const k = String(key).toLowerCase();
  if (k === 'y') return 'z';
  if (k === 'z') return 'y';
  return k;
}

export function buildBindMap(binds = []) {
  const bindMap = {};
  for (const bind of binds) {
    bindMap[mapConfigKeyToVisualId(bind.key)] = bind.action;
  }
  return bindMap;
}

export function resolveAliasAction(action, aliases = {}, seen = new Set()) {
  const key = String(action).toLowerCase();
  if (!aliases[key] || seen.has(key)) return action;
  seen.add(key);
  return resolveAliasAction(aliases[key], aliases, seen);
}

export function weaponName(code) {
  return WEAPON_NAMES[code] || code;
}

export function getActionName(action, aliases = {}) {
  if (ACTION_NAMES[action]) return ACTION_NAMES[action];

  const resolved = resolveAliasAction(action, aliases);
  if (resolved !== action) {
    if (resolved.startsWith('+sprint; bind ') || resolved.startsWith('-sprint; bind ')) {
      return 'Walk';
    }
    return getActionName(resolved, aliases);
  }

  if (action.startsWith('buy ')) {
    const items = action.split(';').filter(Boolean).map((part) => {
      const match = part.trim().match(/^buy\s+(.+)$/);
      return match ? weaponName(match[1]) : part.trim();
    });
    return 'Buy: ' + items.join(' / ');
  }
  if (/^sellbackall;\s*sellbackall;?$/.test(action)) {
    return 'Sell All';
  }
  if (action.includes('Chatwheel_')) {
    const match = action.match(/#Chatwheel_(\w+)/);
    return match ? 'Chat: ' + match[1].replace(/([A-Z])/g, ' $1').trim() : 'Chat Wheel';
  }
  if (action.startsWith('radio')) return 'Radio ' + action.slice(-1);
  if (action.startsWith('say ')) return 'Say "' + action.slice(4) + '"';
  if (action.startsWith('volume ')) return 'Volume ' + action.slice(7);
  if (action.startsWith('toggle ')) return 'Toggle ' + action.split(' ')[1];
  return action;
}

export function getBindCategory(action) {
  if (!action) return 'utility';
  if (MOVEMENT_ACTIONS.has(action)) return 'move';
  if (COMBAT_ACTIONS.has(action)) return 'combat';
  if (action.startsWith('Chat:') || action.startsWith('Radio') || action.startsWith('Say')) return 'comm';
  if (COMM_ACTIONS.has(action)) return 'comm';
  if (action.startsWith('Buy:') || BUY_ACTIONS.has(action)) return 'buy';
  return 'utility';
}

export function getTooltipContent(keyId, actionText, rawAction, aliases = {}) {
  const resolved = resolveAliasAction(rawAction, aliases);
  if (keyId === 'ctrl' && resolved.startsWith('+sprint; bind ')) {
    return {
      title: 'Walk',
      detail: 'In buyzone: buy/drop modifier',
    };
  }
  return { title: actionText, detail: '' };
}

export function buildSettings(v) {
  const settings = {};
  const sens = parseFloat(v.sensitivity || '0');

  settings['Mouse & Sensitivity'] = {
    DPI: DPI.toString(),
    Sensitivity: sens.toString(),
    eDPI: Math.round(DPI * sens).toString(),
    'Zoom Sensitivity': parseFloat(parseFloat(v.zoom_sensitivity_ratio || '1').toFixed(4)).toString(),
    'Polling Rate': '1000 Hz',
  };

  settings['Video & Performance'] = {
    Resolution: '1920x1080',
    'Aspect Ratio': '16:9',
    'Display Mode': 'Fullscreen',
    'Refresh Rate': '240 Hz',
  };
  if (v.fps_max !== undefined) {
    settings['Video & Performance']['FPS Limit'] = v.fps_max === '0' ? 'Unlimited' : v.fps_max;
  }
  if (v.fps_max_ui !== undefined) settings['Video & Performance']['Menu FPS Limit'] = v.fps_max_ui;
  if (v.r_fullscreen_gamma !== undefined) settings['Video & Performance'].Gamma = v.r_fullscreen_gamma;
  if (v.r_player_visibility_mode !== undefined) {
    settings['Video & Performance']['Boost Player Contrast'] =
      v.r_player_visibility_mode === '1' ? 'Enabled' : 'Disabled';
  }

  const chStyles = {
    0: 'Default',
    1: 'Default Static',
    2: 'Classic',
    3: 'Classic Dynamic',
    4: 'Classic Static',
    5: 'Legacy',
  };
  const chR = v.cl_crosshaircolor_r || '50';
  const chG = v.cl_crosshaircolor_g || '250';
  const chB = v.cl_crosshaircolor_b || '50';
  settings.Crosshair = {};
  if (v.cl_crosshairstyle !== undefined) {
    settings.Crosshair.Style = chStyles[v.cl_crosshairstyle] || v.cl_crosshairstyle;
  }
  if (v.cl_crosshairsize !== undefined) settings.Crosshair.Size = v.cl_crosshairsize;
  if (v.cl_crosshairgap !== undefined) settings.Crosshair.Gap = v.cl_crosshairgap;
  if (v.cl_crosshairdot !== undefined) settings.Crosshair.Dot = v.cl_crosshairdot === '1' ? 'Yes' : 'No';
  if (v.cl_crosshair_drawoutline !== undefined) {
    settings.Crosshair.Outline = v.cl_crosshair_drawoutline === '1' ? 'Yes' : 'No';
  }
  settings.Crosshair.Color = `rgb(${chR}, ${chG}, ${chB})`;
  if (v.cl_crosshair_sniper_width !== undefined) {
    settings.Crosshair['Sniper Width'] = v.cl_crosshair_sniper_width;
  }
  settings.Crosshair.__sharecode = CROSSHAIR_CODE;

  settings.Viewmodel = {};
  if (v.viewmodel_fov !== undefined) settings.Viewmodel.FOV = v.viewmodel_fov;
  if (v.viewmodel_offset_x !== undefined) settings.Viewmodel['Offset X'] = v.viewmodel_offset_x;
  if (v.viewmodel_offset_y !== undefined) settings.Viewmodel['Offset Y'] = v.viewmodel_offset_y;
  if (v.viewmodel_offset_z !== undefined) settings.Viewmodel['Offset Z'] = v.viewmodel_offset_z;
  if (v.cl_prefer_lefthanded !== undefined) {
    settings.Viewmodel['Preferred Hand'] =
      (v.cl_prefer_lefthanded === 'true' || v.cl_prefer_lefthanded === '1') ? 'Left' : 'Right';
  }
  settings.Viewmodel['Switch Hands'] = 'Mouse 5';

  settings['Radar & HUD'] = {};
  if (v.cl_radar_scale !== undefined) settings['Radar & HUD']['Radar Scale'] = v.cl_radar_scale;
  if (v.cl_radar_rotate !== undefined) {
    settings['Radar & HUD'].Rotate = v.cl_radar_rotate === '1' ? 'Yes' : 'No';
  }
  if (v.cl_radar_always_centered !== undefined) {
    settings['Radar & HUD']['Always Centered'] = v.cl_radar_always_centered === '1' ? 'Yes' : 'No';
  }
  if (v.cl_radar_icon_scale_min !== undefined) {
    settings['Radar & HUD']['Icon Scale'] = v.cl_radar_icon_scale_min;
  }
  if (v.cl_hud_radar_scale !== undefined) settings['Radar & HUD']['HUD Scale'] = v.cl_hud_radar_scale;
  if (v.cl_radar_scale_dynamic !== undefined) {
    settings['Radar & HUD']['Dynamic Zoom'] = v.cl_radar_scale_dynamic === '1' ? 'Yes' : 'No';
  }
  const hudColors = {
    0: 'Default',
    1: 'White',
    2: 'Light Blue',
    3: 'Dark Blue',
    4: 'Purple',
    5: 'Red',
    6: 'Orange',
    7: 'Yellow',
    8: 'Green',
    9: 'Aqua',
    10: 'Pink',
  };
  if (v.cl_hud_color !== undefined) {
    settings['Radar & HUD']['HUD Color'] = hudColors[v.cl_hud_color] || v.cl_hud_color;
  }

  return settings;
}

export async function loadAndParseConfig() {
  try {
    const res = await fetch('config.cfg');
    if (!res.ok) throw new Error('Failed to load');
    return parseConfigVars(await res.text());
  } catch {
    return null;
  }
}

export async function getOrLoadConfig() {
  if (configCache) return configCache;
  configCache = await loadAndParseConfig();
  return configCache;
}

export function clearConfigCache() {
  configCache = null;
}
