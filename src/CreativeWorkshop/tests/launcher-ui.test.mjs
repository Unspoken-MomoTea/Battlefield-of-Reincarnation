import assert from 'node:assert/strict';
import test from 'node:test';

import { bindWorkshopLauncher } from '../app/launcher.js';
import { workshopTemplate } from '../ui/template.js';

function target() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener(event);
    },
  };
}

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    contains: value => values.has(value),
  };
}

test('launcher click toggles the workshop and drag does not trigger a click', () => {
  const launcher = {
    ...target(),
    style: {},
    classList: classList(),
    ownerDocument: { documentElement: { clientWidth: 800, clientHeight: 600 } },
    getBoundingClientRect() {
      return {
        left: Number.parseFloat(this.style.left) || 100,
        top: Number.parseFloat(this.style.top) || 200,
        width: 50,
        height: 50,
      };
    },
    setPointerCapture() {},
    hasPointerCapture() { return false; },
  };

  const overlay = { classList: classList() };
  const host = {
    ...target(),
    innerWidth: 800,
    innerHeight: 600,
    localStorage: {
      values: new Map(),
      getItem(key) { return this.values.get(key) ?? null; },
      setItem(key, value) { this.values.set(key, value); },
    },
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback) { callback(); },
  };

  let opens = 0;
  let closes = 0;
  const open = () => { opens += 1; overlay.classList.add('is-open'); };
  const close = () => { closes += 1; overlay.classList.remove('is-open'); };

  const cleanup = bindWorkshopLauncher({ launcher, overlay, host, open, close });

  launcher.dispatch('click', { preventDefault() {}, stopPropagation() {} });
  assert.equal(opens, 1);
  assert.equal(overlay.classList.contains('is-open'), true);

  launcher.dispatch('click', { preventDefault() {}, stopPropagation() {} });
  assert.equal(closes, 1);
  assert.equal(overlay.classList.contains('is-open'), false);

  launcher.dispatch('pointerdown', {
    button: 0,
    isPrimary: true,
    pointerId: 7,
    clientX: 110,
    clientY: 210,
  });
  launcher.dispatch('pointermove', {
    pointerId: 7,
    clientX: 150,
    clientY: 250,
    preventDefault() {},
  });
  launcher.dispatch('pointerup', { pointerId: 7 });

  assert.equal(launcher.style.left, '140px');
  assert.equal(launcher.style.top, '240px');
  assert.match(host.localStorage.getItem('reincarnation-workshop:launcher-position'), /"left":140/u);

  launcher.dispatch('click', { preventDefault() {}, stopPropagation() {} });
  assert.equal(opens, 1);
  assert.equal(closes, 1);

  cleanup();
  launcher.dispatch('click', { preventDefault() {}, stopPropagation() {} });
  assert.equal(opens, 1);
  assert.equal(closes, 1);
});

test('workshop copy uses the simplified repair label and neutral project placeholder', () => {
  const html = workshopTemplate('test');
  assert.match(html, /data-action="maintenance">修复<\/button>/u);
  assert.match(html, /placeholder="请输入作品名称"/u);
  assert.doesNotMatch(html, /DLC 修复/u);
  assert.doesNotMatch(html, /命定之诗与黄昏之歌/u);
});
