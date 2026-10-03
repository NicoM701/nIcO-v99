import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { it } from 'node:test';
import assert from 'node:assert/strict';

function carousel() {
  const source = readFileSync(new URL('../js/affiliates.js', import.meta.url), 'utf8');
  const element = () => Object.assign(new EventTarget(), {
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute(name, value) { this[name] = value; },
  });
  const root = element(), viewport = element(), pagination = element();
  const slides = [1, 0, 1, 0].map((realIndex, i) => Object.assign(element(), {
    dataset: { realIndex }, offsetLeft: 300 * i, getBoundingClientRect: () => ({ width: 300 }),
  }));
  const dots = [element(), element()];
  viewport.querySelectorAll = () => slides; pagination.querySelectorAll = () => dots;
  viewport.scrollLeft = 0; viewport.clientWidth = 300;
  viewport.scrollTo = ({ left }) => { viewport.scrollLeft = left; };
  let capture = null;
  viewport.setPointerCapture = id => { capture = id; };
  viewport.releasePointerCapture = () => { capture = null; };
  const win = { matchMedia: () => ({ matches: true }), setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1 };
  const context = vm.createContext({
    window: win, document: { getElementById: id => ({ heroAffiliates: root, heroAffiliatesViewport: viewport, heroAffiliatesPagination: pagination })[id] },
    AbortController, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, clearTimeout() {}, clearInterval() {},
  });
  vm.runInContext(source.replaceAll('export function ', 'function ') + '\ninitHeroAffiliates();', context);
  const pointer = (type, x) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: 50,
    });
    viewport.dispatchEvent(event);
  };
  const click = detail => {
    const event = Object.assign(new Event('click', { cancelable: true }), { detail });
    viewport.dispatchEvent(event); return event.defaultPrevented;
  };
  return { pointer, click, capture: () => capture, stop: () => vm.runInContext('stopHeroAffiliates();', context) };
}

it('retains swipe suppression through pointerup and consumes only its pointer click', () => {
  const h = carousel();
  h.pointer('pointerdown', 250); h.pointer('pointermove', 150);
  assert.equal(h.capture(), 1);
  h.pointer('pointerup', 150); assert.equal(h.capture(), null);
  assert.equal(h.click(1), true); assert.equal(h.click(1), false); h.stop();
});

it('preserves normal taps, keyboard activation, and taps after canceled drags', () => {
  const h = carousel();
  h.pointer('pointerdown', 250); h.pointer('pointerup', 250);
  assert.equal(h.click(1), false);
  h.pointer('pointerdown', 250); h.pointer('pointermove', 150); h.pointer('pointerup', 150);
  assert.equal(h.click(0), false);
  h.pointer('pointerdown', 250); h.pointer('pointerup', 250);
  assert.equal(h.click(1), false);
  h.pointer('pointerdown', 250); h.pointer('pointermove', 150); h.pointer('pointercancel', 150);
  h.pointer('pointerdown', 250); h.pointer('pointerup', 250);
  assert.equal(h.click(1), false); h.stop();
});
