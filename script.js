/* ========================================
   nIcO v99 — script.js  v5.0 (SPA)
   Routing, page inits, and shared UI
   ======================================== */

import { initHeroAffiliates, stopHeroAffiliates } from './js/affiliates.js';
import {
  DPI,
  buildSettings,
  getOrLoadConfig,
} from './js/config.js';
import { renderKeyboard, stopKeyboardTooltips } from './js/keyboard.js';

const CS_START_DATE_UTC = Date.UTC(2014, 11, 22, 15, 44, 9);
const ROUTE_CACHE_TTL_MS = 30000;

let csElapsedInterval = null;
let activeNavigationController = null;
const routeCache = new Map();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
  initApp();
}

function initApp() {
  attachGlobalListeners();
  handleRoute();
  warmRouteCache();

  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.origin === window.location.origin && !link.hasAttribute('target') && !link.hasAttribute('download')) {
      e.preventDefault();
      navigateTo(link.getAttribute('href'));
    }
  });

  document.body.addEventListener('pointerenter', handleLinkPrefetch, true);
  document.body.addEventListener('focusin', handleLinkPrefetch);

  window.addEventListener('popstate', () => {
    loadPage(window.location.pathname, false);
  });
}

function attachGlobalListeners() {
  document.addEventListener('mousemove', handleGlobalTilt);
  window.addEventListener('scroll', handleScrollIndicator);
  document.addEventListener('click', handleNavigationMenuClick);
  document.addEventListener('keydown', handleNavigationMenuKeydown);
  window.addEventListener('resize', closeNavigationMenu);
}

function setNavigationMenuOpen(isOpen) {
  const navInner = document.querySelector('.nav-inner');
  const toggle = document.querySelector('.nav-toggle');
  if (!navInner || !toggle) return;

  navInner.classList.toggle('nav-open', isOpen);
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
}

function closeNavigationMenu() {
  setNavigationMenuOpen(false);
}

function handleNavigationMenuClick(event) {
  const toggle = event.target.closest('.nav-toggle');
  if (toggle) {
    setNavigationMenuOpen(toggle.getAttribute('aria-expanded') !== 'true');
    return;
  }

  if (event.target.closest('.nav-link') || !event.target.closest('.nav-inner')) {
    closeNavigationMenu();
  }
}

function handleNavigationMenuKeydown(event) {
  if (event.key === 'Escape') {
    closeNavigationMenu();
    document.querySelector('.nav-toggle')?.focus();
  }
}

async function navigateTo(url) {
  const pathname = normalizePath(url);
  if (pathname === normalizePath(window.location.pathname)) return;
  await loadPage(url, true);
}

async function loadPage(url, pushState = true) {
  const pathname = normalizePath(url);

  if (activeNavigationController) {
    activeNavigationController.abort();
  }

  const controller = new AbortController();
  activeNavigationController = controller;

  try {
    const html = await fetchRouteHtml(pathname, { signal: controller.signal });
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const newContent = doc.getElementById('swappable-content');
    const currentContent = document.getElementById('swappable-content');

    if (newContent && currentContent) {
      currentContent.replaceWith(newContent);
    } else {
      if (pushState) window.location.href = url;
      return;
    }

    document.title = doc.title;

    if (pushState) {
      window.history.pushState({}, '', pathname);
    }

    updateNavbarActiveState(pathname);
    handleRoute();
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (pushState) window.location.href = url;
  } finally {
    if (activeNavigationController === controller) {
      activeNavigationController = null;
    }
  }
}

function updateNavbarActiveState(url) {
  const normUrl = normalizePath(url);

  const links = document.querySelectorAll('.nav-link');
  links.forEach((link) => {
    const href = link.getAttribute('href') || '/';
    const normHref = normalizePath(href);

    if (normUrl === normHref) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

function normalizePath(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    const pathname = parsed.pathname || '/';
    return (pathname.length > 1 && pathname.endsWith('/')) ? pathname.slice(0, -1) : pathname;
  } catch {
    return url;
  }
}

function getCachedRoute(pathname) {
  const cached = routeCache.get(pathname);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > ROUTE_CACHE_TTL_MS) {
    routeCache.delete(pathname);
    return null;
  }
  return cached.html;
}

function setCachedRoute(pathname, html) {
  routeCache.set(pathname, { html, timestamp: Date.now() });
}

async function fetchRouteHtml(pathname, options = {}) {
  const cached = getCachedRoute(pathname);
  if (cached) return cached;

  const res = await fetch(pathname, {
    signal: options.signal,
    headers: { 'X-Requested-With': 'spa-navigation' }
  });
  if (!res.ok) throw new Error(`Failed to load route: ${pathname}`);
  const html = await res.text();
  setCachedRoute(pathname, html);
  return html;
}

function prefetchRoute(pathname) {
  if (document.visibilityState === 'hidden' || getCachedRoute(pathname)) return;

  fetchRouteHtml(pathname).catch(() => {
    // Ignore prefetch failures and fall back to normal navigation.
  });
}

function handleLinkPrefetch(event) {
  const link = event.target.closest('a');
  if (!link || link.origin !== window.location.origin) return;
  if (link.hasAttribute('target') || link.hasAttribute('download')) return;

  const pathname = normalizePath(link.getAttribute('href') || '/');
  if (!pathname || pathname === normalizePath(window.location.pathname)) return;
  prefetchRoute(pathname);
}

function warmRouteCache() {
  const warm = () => {
    document.querySelectorAll('.nav-link').forEach((link) => {
      const pathname = normalizePath(link.getAttribute('href') || '/');
      if (pathname !== normalizePath(window.location.pathname)) {
        prefetchRoute(pathname);
      }
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, { timeout: 1200 });
  } else {
    window.setTimeout(warm, 300);
  }
}

function handleRoute() {
  const path = window.location.pathname;

  initAge();
  updateCopyrightYear();
  stopKeyboardTooltips();
  stopHeroAffiliates();

  if (csElapsedInterval) {
    clearInterval(csElapsedInterval);
    csElapsedInterval = null;
  }

  if (path === '/' || path.endsWith('index.html')) {
    initHome();
  } else if (path.includes('settings')) {
    initSettings();
  } else if (path.includes('faq')) {
    initFaq();
  }
}

function updateCopyrightYear() {
  const startYear = 2025;
  const currentYear = new Date().getFullYear();
  const label = currentYear > startYear ? `${startYear}–${currentYear}` : String(startYear);
  document.querySelectorAll('[data-copyright-year]').forEach((el) => {
    el.textContent = label;
  });
}

async function initHome() {
  initHeroAffiliates();

  const el = document.getElementById('settingsOverview');
  if (el) {
    const v = await getOrLoadConfig();
    if (v) renderHomeOverview(el, v);
    else el.innerHTML = '<p class="settings-error">Could not load settings.</p>';
  }
}

async function initSettings() {
  const grid = document.getElementById('settingsGrid');
  const kbWrap = document.getElementById('keyboardWrap');
  const existingAffiliateSlot = document.getElementById('settingsAffiliateSlot');

  if (existingAffiliateSlot) {
    existingAffiliateSlot.remove();
  }

  if (grid) {
    grid.innerHTML = `
            <div class="settings-loading">
                <div class="spinner"></div>
                <span>Loading settings from config.cfg…</span>
            </div>`;
  }

  const v = await getOrLoadConfig();

  if (grid) {
    if (!v) {
      grid.innerHTML = '<p class="settings-error settings-error--grid">Could not load config.cfg</p>';
    } else {
      renderSettings(grid, buildSettings(v), v);

      const affiliateSlot = document.createElement('section');
      affiliateSlot.className = 'hero-affiliates hero-affiliates--settings hero-affiliates--settings-flat';
      affiliateSlot.id = 'settingsAffiliateSlot';
      affiliateSlot.setAttribute('aria-label', 'Partner links');
      affiliateSlot.innerHTML = `
        <div class="hero-affiliates__viewport" id="settingsHeroAffiliatesViewport" aria-live="polite"></div>
        <div class="hero-affiliates__pagination" id="settingsHeroAffiliatesPagination" aria-hidden="true"></div>
      `;
      grid.appendChild(affiliateSlot);
      initHeroAffiliates({
        rootId: 'settingsAffiliateSlot',
        viewportId: 'settingsHeroAffiliatesViewport',
        paginationId: 'settingsHeroAffiliatesPagination'
      });
    }
  }

  if (kbWrap && v && v.__binds) {
    renderKeyboard(kbWrap, v);
  }

  const indicator = document.getElementById('scrollIndicator');
  if (indicator) {
    indicator.classList.remove('hidden');
    handleScrollIndicator();
  }
}

function initAge() {
  const ageTargets = document.querySelectorAll('#userAge, #faqAge');
  if (!ageTargets.length) return;

  // Deliberate proxy switch date (01.08) to avoid exposing exact DOB in client code.
  const bd = new Date('2001-08-01');
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) {
    age--;
  }

  ageTargets.forEach((el) => {
    el.textContent = age;
  });
}

function handleScrollIndicator() {
  const indicator = document.getElementById('scrollIndicator');
  if (!indicator) return;

  if (window.scrollY > 50) {
    indicator.classList.add('hidden');
  } else {
    indicator.classList.remove('hidden');
  }
}

function initFaq() {
  const elapsedEl = document.getElementById('csStartElapsed');
  if (!elapsedEl) return;

  const renderElapsed = () => {
    const now = Date.now();
    const diff = Math.max(0, now - CS_START_DATE_UTC);
    elapsedEl.textContent = formatElapsed(diff);
  };

  renderElapsed();
  csElapsedInterval = setInterval(renderElapsed, 1000);
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const years = Math.floor(totalSeconds / (365.2425 * 24 * 60 * 60));
  const secondsAfterYears = totalSeconds - Math.floor(years * 365.2425 * 24 * 60 * 60);
  const hours = Math.floor(secondsAfterYears / 3600);
  const minutes = Math.floor((secondsAfterYears % 3600) / 60);
  const seconds = secondsAfterYears % 60;

  return `${years} years, ${hours} hours, ${minutes} minutes, ${seconds} seconds`;
}

function handleGlobalTilt(e) {
  const container = document.getElementById('tiltContainer');
  const card = document.getElementById('profileCard');
  const glow = document.getElementById('cardGlow');

  if (!container || !card) return;

  const layerAvatar = document.getElementById('layerAvatar');
  const layerName = document.getElementById('layerName');
  const layerTag = document.getElementById('layerTag');

  const MAX_TILT = 8;
  const DEPTH_TAG = 8;
  const DEPTH_NAME = 22;
  const DEPTH_AVATAR = 45;

  const rect = container.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const normX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (window.innerWidth / 2)));
  const normY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (window.innerHeight / 2)));

  card.style.transform = `rotateX(${-normY * MAX_TILT}deg) rotateY(${normX * MAX_TILT}deg)`;

  if (layerTag) layerTag.style.transform = `translateZ(20px) translateX(${normX * DEPTH_TAG}px) translateY(${normY * DEPTH_TAG}px)`;
  if (layerName) layerName.style.transform = `translateZ(50px) translateX(${normX * DEPTH_NAME}px) translateY(${normY * DEPTH_NAME}px)`;
  if (layerAvatar) layerAvatar.style.transform = `translateZ(80px) translateX(${normX * DEPTH_AVATAR}px) translateY(${normY * DEPTH_AVATAR}px)`;

  if (glow) {
    glow.style.left = `${e.clientX - rect.left}px`;
    glow.style.top = `${e.clientY - rect.top}px`;
    const dist = Math.sqrt((e.clientX - centerX) ** 2 + (e.clientY - centerY) ** 2);
    glow.classList.toggle('active', dist < 600);
  }
}

function renderHomeOverview(el, v) {
  const sens = parseFloat(v.sensitivity || '0');
  const edpi = Math.round(DPI * sens);

  const stats = [
    { value: DPI, label: 'DPI' },
    { value: sens, label: 'Sensitivity' },
    { value: edpi, label: 'eDPI' },
    { value: parseFloat(parseFloat(v.zoom_sensitivity_ratio || '1').toFixed(4)), label: 'Zoom Sens' },
    { value: '1000 Hz', label: 'Polling Rate' },
    { value: '1920x1080', label: 'Resolution' },
    { value: '16:9', label: 'Aspect Ratio' },
    { value: 'Fullscreen', label: 'Mode' },
  ];

  const renderRow = (items) => items.map((s) =>
    `<div class="stat-item"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`
  ).join('');

  el.innerHTML = `
      <div class="settings-overview-row">
        ${renderRow(stats.slice(0, 5))}
      </div>
      <div class="settings-overview-row">
        ${renderRow(stats.slice(5))}
      </div>
    `;
}

function renderSettings(grid, settings) {
  grid.innerHTML = '';

  for (const [category, items] of Object.entries(settings)) {
    const realItems = Object.entries(items).filter(([k]) => !k.startsWith('__'));
    if (realItems.length === 0) continue;

    const card = document.createElement('div');
    card.className = 'settings-card';
    if (realItems.length <= 4) card.className += ' settings-card--compact';
    if (category === 'Crosshair') card.classList.add('settings-card--crosshair');

    const title = document.createElement('h3');
    title.className = 'settings-card-title';
    title.textContent = category;
    card.appendChild(title);

    for (const [label, value] of realItems) {
      const row = document.createElement('div');
      row.className = 'setting-row';

      const labelEl = document.createElement('span');
      labelEl.className = 'setting-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.className = 'setting-value';

      if (label === 'Color' && value.startsWith('rgb')) {
        valueEl.innerHTML = `<span class="color-swatch-wrap">
          <span class="color-swatch" style="background:${value}"></span>
          ${value}
        </span>`;
      } else {
        valueEl.textContent = value;
      }

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      card.appendChild(row);
    }

    if (items.__sharecode) {
      const row = document.createElement('div');
      row.className = 'setting-row';
      const labelEl = document.createElement('span');
      labelEl.className = 'setting-label';
      labelEl.textContent = 'Share Code';
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.innerHTML = `<svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        <span>${items.__sharecode}</span>`;
      btn.title = 'Click to copy';
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(items.__sharecode).then(() => {
          btn.querySelector('span').textContent = 'Copied!';
          setTimeout(() => { btn.querySelector('span').textContent = items.__sharecode; }, 1500);
        });
      });
      row.appendChild(labelEl);
      row.appendChild(btn);
      card.appendChild(row);
    }

    grid.appendChild(card);
  }
}
