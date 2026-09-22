import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { bindWorkshopLauncher } from '../app/launcher.js';
import { WORKSHOP_CSS } from '../ui/styles.js';
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


test('resource tabs use plain labels and host toasts stay above the workshop', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../ui/resource-state-editor.js', import.meta.url)),
    'utf8',
  );
  assert.match(source, /button\.textContent = meta\.label;/u);
  assert.doesNotMatch(source, /icon:\s*['"]/u);
  assert.match(WORKSHOP_CSS, /#toast-container\{z-index:2147483647!important\}/u);
});


test('workshop self update never reloads the whole tavern and does not loop on runtime sha', () => {
  const updateNotice = fs.readFileSync(
    fileURLToPath(new URL('../views/update-notice.js', import.meta.url)),
    'utf8',
  );
  const maintenance = fs.readFileSync(
    fileURLToPath(new URL('../views/maintenance.js', import.meta.url)),
    'utf8',
  );

  assert.doesNotMatch(updateNotice, /location\?\.reload|location\.reload/u);
  assert.doesNotMatch(maintenance, /location\?\.reload|location\.reload/u);
  assert.doesNotMatch(updateNotice, /runtimeOutdated/u);
  assert.doesNotMatch(maintenance, /runtimeOutdated/u);
});


test('first project creation exposes a local-only test path', () => {
  const html = workshopTemplate('test');
  assert.match(html, /data-action="create-project-local-test">保存到本地测试<\/button>/u);

  const source = fs.readFileSync(
    fileURLToPath(new URL('../views/author/create-project.js', import.meta.url)),
    'utf8',
  );
  assert.match(source, /projectService\.saveLocalTest\(/u);
  assert.match(source, /不会上传服务器，也不会进入审核队列/u);
});


test('worldbook detail mirrors reference D-depth metadata without redundant groups', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../views/discover/content-preview.js', import.meta.url)),
    'utf8',
  );
  assert.equal(source.includes('return `D${Number.isFinite(Number(entry?.depth)) ? Number(entry.depth) : 4}`;'), true);
  assert.equal(source.includes('`顺序 ${textValue(entry.order)}`'), true);
  assert.match(source, /\['system', 'user', 'assistant'\]/u);
  assert.doesNotMatch(source, /rw-content-nav-group/u);
  assert.doesNotMatch(source, /positionGroupRank/u);
  assert.doesNotMatch(source, /位置 在深度/u);
  assert.doesNotMatch(source, /makeChip\(doc, `深度 /u);
  assert.doesNotMatch(source, /列表顺序/u);
  assert.doesNotMatch(source, /插入顺序/u);
  assert.doesNotMatch(source, /makeChip\(doc, `UID /u);
  assert.doesNotMatch(source, /makeChip\(doc, `概率 /u);
});

test('worldbook navigation orders entries by SillyTavern display index internally', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../views/discover/content-preview.js', import.meta.url)),
    'utf8',
  );
  assert.match(source, /entry\.display_index/u);
  assert.match(source, /Number\(a\.entry\.uid\)/u);
});
