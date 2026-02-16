/* ========================================
   nIcO v99 — script.js
   3D Card Tilt Effect + Config.cfg Parser
   ======================================== */

// ──────────────────────────────────────────
//  3D CARD TILT EFFECT
// ──────────────────────────────────────────
(function initTiltCard() {
  const container = document.getElementById('tiltContainer');
  const card = document.getElementById('profileCard');
  const glow = document.getElementById('cardGlow');
  const layerAvatar = document.getElementById('layerAvatar');
  const layerInfo = document.getElementById('layerInfo');
  const layerSocials = document.getElementById('layerSocials');

  if (!container || !card) return;

  const MAX_TILT = 18;          // degrees
  const PARALLAX_AVATAR = 20;   // px
  const PARALLAX_INFO = 35;     // px
  const PARALLAX_SOCIALS = 50;  // px

  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Normalized -1 to 1
    const normX = (x - centerX) / centerX;
    const normY = (y - centerY) / centerY;

    // Tilt (rotate)
    const rotateY = normX * MAX_TILT;
    const rotateX = -normY * MAX_TILT;

    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

    // Parallax layers
    if (layerAvatar) {
      layerAvatar.style.transform =
        `translateZ(40px) translateX(${normX * PARALLAX_AVATAR}px) translateY(${normY * PARALLAX_AVATAR}px)`;
    }
    if (layerInfo) {
      layerInfo.style.transform =
        `translateZ(60px) translateX(${normX * PARALLAX_INFO}px) translateY(${normY * PARALLAX_INFO}px)`;
    }
    if (layerSocials) {
      layerSocials.style.transform =
        `translateZ(80px) translateX(${normX * PARALLAX_SOCIALS}px) translateY(${normY * PARALLAX_SOCIALS}px)`;
    }

    // Glow follows cursor
    if (glow) {
      glow.style.left = `${x}px`;
      glow.style.top = `${y}px`;
    }
  });

  container.addEventListener('mouseleave', () => {
    card.style.transform = 'rotateX(0deg) rotateY(0deg)';
    card.style.transition = 'transform 0.5s ease';

    if (layerAvatar) {
      layerAvatar.style.transform = 'translateZ(40px)';
      layerAvatar.style.transition = 'transform 0.5s ease';
    }
    if (layerInfo) {
      layerInfo.style.transform = 'translateZ(60px)';
      layerInfo.style.transition = 'transform 0.5s ease';
    }
    if (layerSocials) {
      layerSocials.style.transform = 'translateZ(80px)';
      layerSocials.style.transition = 'transform 0.5s ease';
    }

    setTimeout(() => {
      card.style.transition = 'transform 0.08s ease-out, box-shadow 0.25s ease';
      [layerAvatar, layerInfo, layerSocials].forEach(l => {
        if (l) l.style.transition = 'transform 0.08s ease-out';
      });
    }, 500);
  });

  container.addEventListener('mouseenter', () => {
    card.style.transition = 'transform 0.08s ease-out, box-shadow 0.25s ease';
    [layerAvatar, layerInfo, layerSocials].forEach(l => {
      if (l) l.style.transition = 'transform 0.08s ease-out';
    });
  });
})();


// ──────────────────────────────────────────
//  CONFIG.CFG PARSER
// ──────────────────────────────────────────
(async function loadConfig() {
  const grid = document.getElementById('settingsGrid');
  if (!grid) return;

  try {
    const res = await fetch('config.cfg');
    if (!res.ok) throw new Error('Could not load config.cfg');
    const raw = await res.text();
    const settings = parseConfig(raw);
    renderSettings(grid, settings);
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:24px;">
      Could not load config.cfg — ${err.message}</p>`;
  }
})();

/**
 * Parse a CS2 config.cfg into structured, human-readable settings
 */
function parseConfig(raw) {
  const lines = raw.split('\n');
  const vars = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Match: command "value" or command value
    const match = trimmed.match(/^(\S+)\s+"?([^"]*)"?\s*$/);
    if (match) {
      const key = match[1].toLowerCase();
      const val = match[2].trim();
      vars[key] = val;
    }
  }

  // Build human-readable settings grouped into categories
  const settings = {};

  // ── MOUSE / SENSITIVITY ──
  settings['Mouse & Sensitivity'] = {};
  const dpi = 1200; // from user input, not in cfg
  const sens = parseFloat(vars['sensitivity'] || '0');
  const edpi = Math.round(dpi * sens);
  const zoomSens = parseFloat(vars['zoom_sensitivity_ratio'] || '1');

  settings['Mouse & Sensitivity']['DPI'] = dpi.toString();
  settings['Mouse & Sensitivity']['Sensitivity'] = sens.toString();
  settings['Mouse & Sensitivity']['eDPI'] = edpi.toString();
  settings['Mouse & Sensitivity']['Zoom Sensitivity'] = round4(zoomSens);
  if (vars['m_yaw']) settings['Mouse & Sensitivity']['m_yaw'] = vars['m_yaw'];
  if (vars['m_pitch']) settings['Mouse & Sensitivity']['m_pitch'] = vars['m_pitch'];

  // ── CROSSHAIR ──
  settings['Crosshair'] = {};
  const chStyle = { '0': 'Default', '1': 'Default Static', '2': 'Classic', '3': 'Classic Dynamic', '4': 'Classic Static', '5': 'Legacy' };
  if (vars['cl_crosshairstyle'] !== undefined) {
    settings['Crosshair']['Style'] = chStyle[vars['cl_crosshairstyle']] || vars['cl_crosshairstyle'];
  }
  if (vars['cl_crosshairsize'] !== undefined) settings['Crosshair']['Size'] = vars['cl_crosshairsize'];
  if (vars['cl_crosshairthickness'] !== undefined) settings['Crosshair']['Thickness'] = vars['cl_crosshairthickness'];
  if (vars['cl_crosshairgap'] !== undefined) settings['Crosshair']['Gap'] = vars['cl_crosshairgap'];
  if (vars['cl_crosshairdot'] !== undefined) {
    settings['Crosshair']['Dot'] = vars['cl_crosshairdot'] === '1' ? 'Yes' : 'No';
  }
  if (vars['cl_crosshair_drawoutline'] !== undefined) {
    settings['Crosshair']['Outline'] = vars['cl_crosshair_drawoutline'] === '1' ? 'Yes' : 'No';
  }
  if (vars['cl_crosshair_outlinethickness'] !== undefined) {
    settings['Crosshair']['Outline Thickness'] = vars['cl_crosshair_outlinethickness'];
  }
  if (vars['cl_crosshair_t'] !== undefined) {
    settings['Crosshair']['T-Shape'] = vars['cl_crosshair_t'] === '1' ? 'Yes' : 'No';
  }
  // Crosshair color
  const chR = vars['cl_crosshaircolor_r'] || '50';
  const chG = vars['cl_crosshaircolor_g'] || '250';
  const chB = vars['cl_crosshaircolor_b'] || '50';
  settings['Crosshair']['Color'] = `rgb(${chR}, ${chG}, ${chB})`;
  if (vars['cl_crosshairalpha'] !== undefined) {
    settings['Crosshair']['Alpha'] = vars['cl_crosshairalpha'];
  }
  if (vars['cl_crosshair_sniper_width'] !== undefined) {
    settings['Crosshair']['Sniper Width'] = vars['cl_crosshair_sniper_width'];
  }

  // ── VIEWMODEL ──
  settings['Viewmodel'] = {};
  // Use last defined values (the cfg has two sets, we take the later one)
  if (vars['viewmodel_fov'] !== undefined) settings['Viewmodel']['FOV'] = vars['viewmodel_fov'];
  if (vars['viewmodel_offset_x'] !== undefined) settings['Viewmodel']['Offset X'] = vars['viewmodel_offset_x'];
  if (vars['viewmodel_offset_y'] !== undefined) settings['Viewmodel']['Offset Y'] = vars['viewmodel_offset_y'];
  if (vars['viewmodel_offset_z'] !== undefined) settings['Viewmodel']['Offset Z'] = vars['viewmodel_offset_z'];
  if (vars['cl_prefer_lefthanded'] !== undefined) {
    settings['Viewmodel']['Hand'] = (vars['cl_prefer_lefthanded'] === 'true' || vars['cl_prefer_lefthanded'] === '1') ? 'Left' : 'Right';
  }

  // ── RADAR ──
  settings['Radar'] = {};
  if (vars['cl_radar_scale'] !== undefined) settings['Radar']['Scale'] = vars['cl_radar_scale'];
  if (vars['cl_radar_rotate'] !== undefined) {
    settings['Radar']['Rotate'] = vars['cl_radar_rotate'] === '1' ? 'Yes' : 'No';
  }
  if (vars['cl_radar_always_centered'] !== undefined) {
    settings['Radar']['Always Centered'] = vars['cl_radar_always_centered'] === '1' ? 'Yes' : 'No';
  }
  if (vars['cl_radar_icon_scale_min'] !== undefined) settings['Radar']['Icon Scale'] = vars['cl_radar_icon_scale_min'];
  if (vars['cl_hud_radar_scale'] !== undefined) settings['Radar']['HUD Scale'] = vars['cl_hud_radar_scale'];

  // ── HUD / UI ──
  settings['HUD & UI'] = {};
  const hudColors = { '0': 'Default', '1': 'White', '2': 'Light Blue', '3': 'Dark Blue', '4': 'Purple', '5': 'Red', '6': 'Orange', '7': 'Yellow', '8': 'Green', '9': 'Aqua', '10': 'Pink', '11': 'Custom' };
  if (vars['cl_hud_color'] !== undefined) {
    settings['HUD & UI']['HUD Color'] = hudColors[vars['cl_hud_color']] || vars['cl_hud_color'];
  }
  if (vars['cl_showloadout'] !== undefined) {
    settings['HUD & UI']['Show Loadout'] = vars['cl_showloadout'] === '1' ? 'Always' : 'On Change';
  }
  if (vars['cl_teamid_overhead_mode'] !== undefined) {
    const overhead = { '0': 'Off', '1': 'Show Name', '2': 'Show Equipment', '3': 'Show Name & Equipment' };
    settings['HUD & UI']['Teammate Info'] = overhead[vars['cl_teamid_overhead_mode']] || vars['cl_teamid_overhead_mode'];
  }
  if (vars['cl_teammate_colors_show'] !== undefined) {
    settings['HUD & UI']['Teammate Colors'] = vars['cl_teammate_colors_show'] === '1' ? 'Show Colors' : 'Off';
  }
  if (vars['ui_steam_overlay_notification_position'] !== undefined) {
    settings['HUD & UI']['Notification Pos'] = capitalize(vars['ui_steam_overlay_notification_position']);
  }
  if (vars['gameinstructor_enable'] !== undefined) {
    settings['HUD & UI']['Game Instructor'] = vars['gameinstructor_enable'] === '1' ? 'Enabled' : 'Disabled';
  }

  // ── AUDIO ──
  settings['Audio'] = {};
  if (vars['volume'] !== undefined) {
    settings['Audio']['Master Volume'] = Math.round(parseFloat(vars['volume']) * 100) + '%';
  }
  if (vars['snd_mvp_volume'] !== undefined) {
    settings['Audio']['MVP Volume'] = Math.round(parseFloat(vars['snd_mvp_volume']) * 100) + '%';
  }
  if (vars['snd_tensecondwarning_volume'] !== undefined) {
    settings['Audio']['10s Warning'] = Math.round(parseFloat(vars['snd_tensecondwarning_volume']) * 100) + '%';
  }
  if (vars['snd_mute_losefocus'] !== undefined) {
    settings['Audio']['Mute on Alt-Tab'] = vars['snd_mute_losefocus'] === '1' ? 'Yes' : 'No';
  }

  // ── VIDEO / PERFORMANCE ──
  settings['Video & Performance'] = {};
  if (vars['fps_max'] !== undefined) {
    settings['Video & Performance']['FPS Limit'] = vars['fps_max'] === '0' ? 'Unlimited' : vars['fps_max'];
  }
  if (vars['fps_max_ui'] !== undefined) {
    settings['Video & Performance']['Menu FPS Limit'] = vars['fps_max_ui'];
  }
  if (vars['r_fullscreen_gamma'] !== undefined) {
    settings['Video & Performance']['Gamma'] = vars['r_fullscreen_gamma'];
  }
  if (vars['r_player_visibility_mode'] !== undefined) {
    settings['Video & Performance']['Boost Player Contrast'] = vars['r_player_visibility_mode'] === '1' ? 'Enabled' : 'Disabled';
  }
  if (vars['r_drawtracers_firstperson'] !== undefined) {
    settings['Video & Performance']['First Person Tracers'] = vars['r_drawtracers_firstperson'] === '1' ? 'On' : 'Off';
  }
  if (vars['engine_low_latency_sleep_after_client_tick'] !== undefined) {
    settings['Video & Performance']['Low Latency'] = vars['engine_low_latency_sleep_after_client_tick'] === 'true' ? 'Enabled' : 'Disabled';
  }

  // ── NETWORK ──
  settings['Network'] = {};
  if (vars['rate'] !== undefined) {
    const rateKbps = Math.round(parseInt(vars['rate']) / 1024);
    settings['Network']['Rate'] = `${rateKbps} KB/s`;
  }
  if (vars['cl_net_buffer_ticks'] !== undefined) {
    settings['Network']['Net Buffer'] = vars['cl_net_buffer_ticks'] + ' tick(s)';
  }
  if (vars['mm_dedicated_search_maxping'] !== undefined) {
    settings['Network']['Max Ping'] = vars['mm_dedicated_search_maxping'] + ' ms';
  }
  if (vars['cl_timeout'] !== undefined) {
    settings['Network']['Timeout'] = vars['cl_timeout'] + ' s';
  }

  return settings;
}

/**
 * Render parsed settings into the settings grid
 */
function renderSettings(grid, settings) {
  grid.innerHTML = '';

  for (const [category, items] of Object.entries(settings)) {
    if (Object.keys(items).length === 0) continue;

    const card = document.createElement('div');
    card.className = 'settings-card';

    const title = document.createElement('h3');
    title.className = 'settings-card-title';
    title.textContent = category;
    card.appendChild(title);

    for (const [label, value] of Object.entries(items)) {
      const row = document.createElement('div');
      row.className = 'setting-row';

      const labelEl = document.createElement('span');
      labelEl.className = 'setting-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.className = 'setting-value';

      // Special rendering for crosshair color
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

    grid.appendChild(card);
  }
}

// ── Helpers ──
function round4(n) {
  return parseFloat(n.toFixed(4)).toString();
}

function capitalize(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}
