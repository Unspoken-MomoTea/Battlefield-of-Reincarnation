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


// The wallet amount comes directly from an MVU save and can exceed a trillion.
// A huge value must wrap inside a bounded status card, not grow the whole mobile
// Bazaar header and hide the four trading modes.
test('mobile Bazaar uses bounded two-column status cards and uncompressed navigation', () => {
  const css = MARKET_CSS;
  const mobile = css.slice(css.indexOf('@media (max-width:650px){'));
  assert.ok(mobile.startsWith('@media (max-width:650px){'), 'mobile Bazaar breakpoint exists');
  assert.match(css, /\.rw-ah-account-strip\{[^}]*min-width:0;max-width:100%/u);
  assert.match(css, /\.rw-ah-account-cell strong\{[^}]*overflow-wrap:anywhere/u);
  assert.match(mobile, /\.rw-ah-account-strip\{[^}]*display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/u);
  assert.match(mobile, /\.rw-ah-account-cell\{[^}]*min-width:0;width:100%;max-width:100%/u);
  assert.match(mobile, /\.rw-ah-account-cell strong\{[^}]*overflow-wrap:anywhere/u);
  assert.match(mobile, /\.rw-ah-tabs\{[^}]*flex:0 0 auto;min-width:0;width:100%/u);
  assert.match(mobile, /\.rw-ah-tabs \.rw-ah-tab\{[^}]*flex:0 0 auto;min-width:0;min-height:44px/u);
  const html = workshopTemplate('2.0.65');
  assert.deepEqual(
    [...html.matchAll(/data-market-mode="([^"]+)"/gu)].map(match => match[1]),
    ['browse', 'sell', 'orders', 'mine'],
  );
});
