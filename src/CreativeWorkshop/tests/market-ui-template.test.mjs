import assert from 'node:assert/strict';
import test from 'node:test';

import { workshopTemplate } from '../ui/template.js';
import { WORKSHOP_CSS } from '../ui/styles.js';
import { MARKET_CSS } from '../ui/market-styles.js';

test('market labels no longer expose an obsolete TEST badge', () => {
  const html = workshopTemplate('2.0.50');
  assert.match(html, /data-tab="market"[^>]*>空间集市<\/button>/u);
  assert.match(html, /rw-ah-kicker">SPACE BAZAAR<\/div>/u);
  assert.doesNotMatch(html, /rw-market-test-badge/u);
  assert.doesNotMatch(MARKET_CSS, /rw-market-test-badge/u);
});

test('mobile bottom navigation scrolls fixed-width tabs instead of squeezing all of them', () => {
  const mobile = WORKSHOP_CSS.match(/@media\(max-width:760px\)\{[\s\S]*?\.rw-tab\.is-active::before/u)?.[0] || '';
  assert.match(mobile, /\.rw-tabs\s*\{[^}]*display:flex[^}]*flex-direction:row/u);
  assert.match(mobile, /overflow-x:auto;overflow-y:hidden/u);
  assert.match(mobile, /touch-action:pan-x/u);
  assert.match(mobile, /\.rw-tabs>\.rw-tab\s*\{[^}]*flex:0 0 auto/u);
  assert.match(mobile, /white-space:nowrap/u);
});
