import {
  buildBindMap,
  getActionName,
  getBindCategory,
  getTooltipContent,
} from './config.js';

let keyboardTooltipController = null;

export function stopKeyboardTooltips() {
  if (keyboardTooltipController) {
    keyboardTooltipController.abort();
    keyboardTooltipController = null;
  }

  const tooltip = document.getElementById('keyboard-tooltip') || document.querySelector('.kb-tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
    tooltip.replaceChildren();
  }
}

export function renderKeyboard(container, config) {
  const aliases = config.__aliases || {};
  const bindMap = buildBindMap(config.__binds || []);

  const U = 44;
  const k = (id, label, x, y, w = 1, h = 1) => ({ id, label, x, y, w, h });

  const keys = [
    k('escape', 'Esc', 0, 0),
    k('f1', 'F1', 1.5, 0), k('f2', 'F2', 2.5, 0), k('f3', 'F3', 3.5, 0), k('f4', 'F4', 4.5, 0),
    k('f5', 'F5', 6, 0), k('f6', 'F6', 7, 0), k('f7', 'F7', 8, 0), k('f8', 'F8', 9, 0),
    k('f9', 'F9', 10.5, 0), k('f10', 'F10', 11.5, 0), k('f11', 'F11', 12.5, 0), k('f12', 'F12', 13.5, 0),
    k('del', 'Del', 15, 0), k('ins', 'Ins', 16, 0), k('pgup', 'PgUp', 17, 0), k('pgdn', 'PgDn', 18, 0),

    k('^', '^', 0, 1.25), k('1', '1', 1, 1.25), k('2', '2', 2, 1.25), k('3', '3', 3, 1.25),
    k('4', '4', 4, 1.25), k('5', '5', 5, 1.25), k('6', '6', 6, 1.25), k('7', '7', 7, 1.25),
    k('8', '8', 8, 1.25), k('9', '9', 9, 1.25), k('0', '0', 10, 1.25), k('ss', 'ß', 11, 1.25),
    k('acute', '´', 12, 1.25), k('backspace', '⌫', 13, 1.25, 2),
    k('numlock', 'Num', 15.5, 1.25), k('kp_divide', '/', 16.5, 1.25), k('kp_multiply', '*', 17.5, 1.25), k('kp_minus', '-', 18.5, 1.25),

    k('tab', 'Tab', 0, 2.25, 1.5),
    k('q', 'Q', 1.5, 2.25), k('w', 'W', 2.5, 2.25), k('e', 'E', 3.5, 2.25), k('r', 'R', 4.5, 2.25),
    k('t', 'T', 5.5, 2.25), k('z', 'Z', 6.5, 2.25), k('u', 'U', 7.5, 2.25), k('i', 'I', 8.5, 2.25),
    k('o', 'O', 9.5, 2.25), k('p', 'P', 10.5, 2.25), k('ue', 'Ü', 11.5, 2.25), k('plus', '+', 12.5, 2.25),
    k('kp_7', '7', 15.5, 2.25), k('kp_8', '8', 16.5, 2.25), k('kp_9', '9', 17.5, 2.25), k('kp_plus', '+', 18.5, 2.25, 1, 2),

    k('capslock', 'Caps', 0, 3.25, 1.75),
    k('a', 'A', 1.75, 3.25), k('s', 'S', 2.75, 3.25), k('d', 'D', 3.75, 3.25), k('f', 'F', 4.75, 3.25),
    k('g', 'G', 5.75, 3.25), k('h', 'H', 6.75, 3.25), k('j', 'J', 7.75, 3.25), k('k', 'K', 8.75, 3.25),
    k('l', 'L', 9.75, 3.25), k('oe', 'Ö', 10.75, 3.25), k('ae', 'Ä', 11.75, 3.25), k('hash', '#', 12.75, 3.25),
    k('enter', '', 13.5, 2.25, 1.5, 1),
    k('enter', 'Enter', 13.75, 3.25, 1.25),

    k('kp_4', '4', 15.5, 3.25), k('kp_5', '5', 16.5, 3.25), k('kp_6', '6', 17.5, 3.25),

    k('shift', 'Shift', 0, 4.25, 1.25), k('less', '<', 1.25, 4.25),
    k('y', 'Y', 2.25, 4.25), k('x', 'X', 3.25, 4.25), k('c', 'C', 4.25, 4.25), k('v', 'V', 5.25, 4.25),
    k('b', 'B', 6.25, 4.25), k('n', 'N', 7.25, 4.25), k('m', 'M', 8.25, 4.25),
    k('comma', ',', 9.25, 4.25), k('period', '.', 10.25, 4.25), k('minus', '-', 11.25, 4.25),
    k('rshift', 'Shift', 12.25, 4.25, 1.75),
    k('uparrow', '↑', 14.25, 4.25),
    k('kp_1', '1', 15.5, 4.25), k('kp_2', '2', 16.5, 4.25), k('kp_3', '3', 17.5, 4.25), k('kp_enter', '⏎', 18.5, 4.25, 1, 2),

    k('ctrl', 'Ctrl', 0, 5.25, 1.25), k('win', 'Win', 1.25, 5.25, 1.25), k('alt', 'Alt', 2.5, 5.25, 1.25),
    k('space', 'Space', 3.75, 5.25, 6.25),
    k('ralt', 'AltGr', 10, 5.25, 1), k('fn', 'Fn', 11, 5.25, 1), k('rctrl', 'Ctrl', 12, 5.25, 1),
    k('leftarrow', '←', 13.25, 5.25), k('downarrow', '↓', 14.25, 5.25), k('rightarrow', '→', 15.25, 5.25),
    k('kp_0', '0', 16.5, 5.25, 1), k('kp_del', '.', 17.5, 5.25, 1),
  ];

  const keyboard = document.createElement('div');
  keyboard.className = 'keyboard';
  keyboard.style.width = `${19.5 * U}px`;
  keyboard.style.height = `${6.25 * U}px`;

  let tooltip = document.querySelector('.kb-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'kb-tooltip';
    document.body.appendChild(tooltip);
  } else {
    tooltip.style.display = 'none';
  }
  tooltip.id = 'keyboard-tooltip';
  tooltip.setAttribute('role', 'tooltip');

  const enterKeys = [];
  let pinnedTooltipTarget = null;

  stopKeyboardTooltips();
  keyboardTooltipController = new AbortController();
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.kb-key--bound')) {
      pinnedTooltipTarget = null;
      tooltip.style.display = 'none';
      enterKeys.forEach((el) => el.classList.remove('kb-key--hover'));
    }
  }, { signal: keyboardTooltipController.signal });

  function showTooltip(target, content) {
    tooltip.innerHTML = `<div class="kb-tooltip__title">${content.title}</div>${content.detail ? `<div class="kb-tooltip__detail">${content.detail}</div>` : ''}`;
    tooltip.style.display = 'block';
    const rect = target.getBoundingClientRect();
    const tooltipHalfWidth = tooltip.getBoundingClientRect().width / 2;
    const unclampedLeft = rect.left + rect.width / 2;
    const left = Math.max(tooltipHalfWidth + 8, Math.min(window.innerWidth - tooltipHalfWidth - 8, unclampedLeft));
    const top = rect.top + window.scrollY - 8;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.position = 'absolute';
    tooltip.style.transform = 'translate(-50%, -100%)';
    tooltip.style.zIndex = '9999';
  }

  function attachTooltip(keyEl, keyId, content) {
    const setEnterHighlight = (active) => {
      if (keyId === 'enter') {
        enterKeys.forEach((el) => el.classList.toggle('kb-key--hover', active));
      }
    };
    const open = (pin = false) => {
      if (pin) {
        if (pinnedTooltipTarget !== keyEl) {
          enterKeys.forEach((el) => el.classList.remove('kb-key--hover'));
        }
        pinnedTooltipTarget = keyEl;
      }
      showTooltip(keyEl, content);
      setEnterHighlight(true);
    };
    const close = () => {
      if (pinnedTooltipTarget === keyEl) pinnedTooltipTarget = null;
      tooltip.style.display = 'none';
      setEnterHighlight(false);
    };
    const togglePinned = () => {
      if (pinnedTooltipTarget === keyEl) close();
      else open(true);
    };

    keyEl.tabIndex = 0;
    keyEl.setAttribute('role', 'button');
    keyEl.setAttribute('aria-describedby', tooltip.id);
    keyEl.setAttribute('aria-label', `${keyEl.textContent}: ${content.title}`);
    keyEl.addEventListener('mouseenter', () => open());
    keyEl.addEventListener('mouseleave', () => {
      if (pinnedTooltipTarget !== keyEl) close();
    });
    keyEl.addEventListener('pointerup', (event) => {
      if (event.pointerType !== 'mouse') togglePinned();
    });
    keyEl.addEventListener('focus', () => open());
    keyEl.addEventListener('blur', () => {
      if (pinnedTooltipTarget !== keyEl) close();
    });
    keyEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        togglePinned();
      }
    });
  }

  keys.forEach((key) => {
    const keyEl = document.createElement('div');
    keyEl.className = 'kb-key';
    keyEl.textContent = key.label;
    keyEl.style.position = 'absolute';
    keyEl.style.left = `${key.x * U}px`;
    keyEl.style.top = `${key.y * U}px`;
    keyEl.style.width = `${key.w * U - 4}px`;
    keyEl.style.height = `${key.h * U - 4}px`;

    if (key.id === 'escape') keyEl.classList.add('kb-key--accent');
    if (key.id === 'enter') enterKeys.push(keyEl);

    const bound = bindMap[key.id];
    if (bound) {
      const actionText = getActionName(bound, aliases);
      keyEl.classList.add('kb-key--bound', `kb-key--${getBindCategory(actionText)}`);
      attachTooltip(keyEl, key.id, getTooltipContent(key.id, actionText, bound, aliases));
    }
    keyboard.appendChild(keyEl);
  });

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

  mouseKeys.forEach((mk) => {
    const keyEl = document.createElement('div');
    keyEl.className = 'kb-key kb-key--mouse';
    keyEl.textContent = mk.label;
    keyEl.style.position = 'relative';
    keyEl.style.width = '50px';
    keyEl.style.height = '40px';
    const bound = bindMap[mk.id];
    if (bound) {
      const actionText = getActionName(bound, aliases);
      keyEl.classList.add('kb-key--bound', `kb-key--${getBindCategory(actionText)}`);
      attachTooltip(keyEl, mk.id, getTooltipContent(mk.id, actionText, bound, aliases));
    }
    mouseGrid.appendChild(keyEl);
  });
  mouseSection.appendChild(mouseGrid);

  const legend = document.createElement('div');
  legend.className = 'kb-legend';
  const cats = [
    { label: 'Movement', cls: 'move' }, { label: 'Combat', cls: 'combat' },
    { label: 'Communication', cls: 'comm' }, { label: 'Miscellaneous', cls: 'utility' },
    { label: 'Buy', cls: 'buy' },
  ];
  legend.innerHTML = cats.map((c) =>
    `<div class="kb-legend-item"><span class="kb-dot kb-dot--${c.cls}"></span>${c.label}</div>`
  ).join('');

  container.innerHTML = '';
  container.appendChild(keyboard);
  container.appendChild(mouseSection);
  container.appendChild(legend);
}
