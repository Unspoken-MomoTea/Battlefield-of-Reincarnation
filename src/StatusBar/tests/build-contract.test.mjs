import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const generated = fs.readFileSync(path.join(root, 'script/悬浮球状态栏.js'), 'utf8');
const parts = [
  'core/StatusBarFoundation.part.js',
  'ui/StatusBarStyles.part.js',
  'ui/StatusBarShell.part.js',
  'domains/StatusBarBloodFusion.part.js',
  'domains/StatusBarTransferLoot.part.js',
  'ui/StatusBarEventBindings.part.js',
  'settings/StatusBarSettings.part.js',
  'ui/StatusBarRenderer.part.js',
  'ui/StatusBarDetailsEditor.part.js',
  'shop/StatusBarShopCatalog.part.js',
  'shop/StatusBarShopView.part.js',
  'shop/StatusBarShopTransaction.part.js',
  'shop/StatusBarShopAi.part.js',
  'domains/StatusBarActions.part.js',
  'core/StatusBarBootstrap.part.js',
];

test('status bar delivery is assembled exactly from modular source parts', () => {
  const assembled = parts
    .map(part => fs.readFileSync(path.join(root, 'src/StatusBar', part), 'utf8'))
    .join('');
  assert.equal(generated, assembled);
});

test('status bar exposes an independent version and reload-safe event lifecycle', () => {
  assert.match(generated, /STATUS_BAR_VERSION = '1\.0\.1'/u);
  assert.match(generated, /class StatusBarRuntimeLifecycle/u);
  assert.match(generated, /SamsaraStatusBarRuntime/u);
  assert.match(generated, /Samsara\.StatusBarInfo/u);
  assert.match(generated, /trackStatusBarSubscription\(eventOn\(/u);
  assert.match(generated, /stopSubscriptions\(\)/u);
});


test('status bar left tab rail keeps workshop extension entries scrollable and visibly discoverable', () => {
  assert.match(generated, /\.sam-main \{ position:relative;/u);
  assert.match(generated, /\.sam-main::before \{[^}]*width:58px;[^}]*pointer-events:none;[^}]*linear-gradient/u);
  assert.match(generated, /\.sam-main::after \{[^}]*content:"⌄";[^}]*width:58px;[^}]*pointer-events:none;/u);
  assert.match(generated, /\.sam-tab-rail \{[^}]*overflow-x:hidden;[^}]*overflow-y:scroll;[^}]*overscroll-behavior-y:contain;[^}]*scrollbar-gutter:stable;[^}]*scrollbar-width:thin;[^}]*touch-action:pan-y;/u);
  assert.match(generated, /\.sam-tab-rail > \* \{ flex-shrink:0; \}/u);
  assert.match(generated, /\.sam-tab-rail::-webkit-scrollbar-track \{ background:rgba\(255,255,255,\.04\); \}/u);
  assert.match(generated, /\.sam-tab-rail:hover::-webkit-scrollbar-thumb \{ background:var\(--sam-accent\); \}/u);
  assert.match(generated, /\.sam-tab-btn \{ flex:0 0 auto;/u);
});
