const assert = require('assert');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'script', '世界推进系统.js');
const source = fs.readFileSync(file, 'utf8');
const { WORLD_UI_THEMES, WORLD_FONT_SCALES } = require(file);

const expectedThemes = ['night', 'crimson', 'indigo', 'parchment', 'sakura', 'matcha'];
assert.deepEqual(Object.keys(WORLD_UI_THEMES).sort(), expectedThemes.slice().sort(), 'six UI themes must share one theme registry');
assert.deepEqual(Object.keys(WORLD_FONT_SCALES), ['standard', 'large', 'xlarge'], 'font scale registry must stay stable');

const required = ['scheme','shell','main','surface','card','cardHover','input','line','ink','sub','accent','accentSoft','gold','mint','head','nav','notice','action','actionInk'];
for (const [name, theme] of Object.entries(WORLD_UI_THEMES)) {
  for (const key of required) assert.ok(theme[key], `${name} missing theme token ${key}`);
}

function channel(value) {
  value /= 255;
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, `contrast token must be six-digit hex: ${hex}`);
  const h = hex.slice(1);
  const [r,g,b] = [0,2,4].map(i => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x,y) + 0.05) / (Math.min(x,y) + 0.05);
}
function checkContrast(themeName, foreground, background, label) {
  const ratio = contrast(foreground, background);
  assert.ok(ratio >= 4.5, `${themeName} ${label} contrast ${ratio.toFixed(2)} < 4.5`);
}

for (const [name, t] of Object.entries(WORLD_UI_THEMES)) {
  checkContrast(name, t.ink, t.surface, 'ink/surface');
  checkContrast(name, t.sub, t.card, 'sub/card');
  checkContrast(name, t.accent, t.surface, 'accent/surface');
  checkContrast(name, t.gold, t.surface, 'gold/surface');
  checkContrast(name, t.gold, t.card, 'gold/card');
  checkContrast(name, t.mint, t.card, 'mint/card');
  checkContrast(name, t.actionInk, t.action, 'action text');
  checkContrast(name, '#f7fbff', t.head, 'header text');
  checkContrast(name, '#d6dee7', t.nav, 'nav text');
  checkContrast(name, '#c9d3dd', t.nav, 'chrome secondary/nav');
}

assert.match(source, /const WORLD_TONE_KEYS = new Set\(Object\.keys\(WORLD_UI_THEMES\)\);/, 'tone keys must derive from the theme registry');
assert.match(source, /\$\{WORLD_UI_THEME_CSS\}/, 'theme CSS must be generated from the registry');
assert.doesNotMatch(source, /data-tone=\\?"(?:parchment|sakura|matcha)\\?"\]\s+(?:header|nav)/, 'light themes must not use one-off header/nav patches');
assert.doesNotMatch(source, /可读性：旧版 9\/10px 文本整体提升/, 'obsolete fixed-size readability patch must be removed');
assert.doesNotMatch(source, /var\(--text\)/, 'world engine CSS must not depend on undefined --text');
assert.match(source, /header button\.we-primary\{background:var\(--we-action\)!important;border-color:var\(--we-action\)!important;color:var\(--we-action-ink\)!important\}/, 'header primary action must use theme action tokens');
assert.match(source, /nav button\[aria-selected=true\]\{background:var\(--we-action\)!important;border-color:var\(--we-action\)!important;color:var\(--we-action-ink\)!important\}/, 'active navigation must use the same action tokens');
assert.match(source, /\.we-next-node>span\{background:var\(--we-action\)!important;color:var\(--we-action-ink\)!important\}/, 'next macro action must use the same accessible action token pair');
assert.match(source, /footer\{background:var\(--we-nav\)!important;color:var\(--we-chrome-sub\)!important\}/, 'footer on chrome must use chrome secondary text');
assert.match(source, /\.we-next-node small,[\s\S]*\.we-rep b\{color:var\(--we-gold\)!important\}/, 'accent-like secondary labels must share gold semantics');
assert.match(source, /\.we-timeline-group-title,[\s\S]*\.we-area-progress>div>span\{color:var\(--we-sub\)!important\}/, 'secondary informational labels must share sub semantics');
assert.match(source, /\.we-preset-toolbar b\{color:var\(--we-ink\)!important\}/, 'prompt toolbar heading must follow themed ink');
assert.match(source, /summary:hover\{color:var\(--we-accent\)!important\}/, 'summary hover must use theme accent rather than old parchment brown');
assert.match(source, /\.we-card\.is-jump\{outline-color:var\(--we-action\)!important;background:var\(--we-accent-soft\)!important\}/, 'jump highlight must follow theme tokens');
assert.match(source, /\.we-area-note\{\s*background:var\(--we-input\)!important;color:var\(--we-ink\)!important;border:1px solid var\(--we-line\)!important;/, 'area archive note must follow semantic theme tokens');
assert.match(source, /\.we-brand\{font-size:var\(--we-fs-h3\)!important/, 'font scale must include the panel brand');
assert.match(source, /\.we-hero \.we-date\{font-size:var\(--we-fs-h3\)!important/, 'font scale must include the hero date');

const mobileStart = source.indexOf('@media(max-width:760px){');
const shortStart = source.indexOf('@media(max-height:400px){');
assert.ok(mobileStart >= 0 && shortStart > mobileStart, 'responsive blocks must remain ordered');
const mobileBlock = source.slice(mobileStart, shortStart);
assert.ok(mobileBlock.includes('#sam-world-engine .we-setting-row{grid-template-columns:1fr}'), 'settings single-column rule must stay inside mobile media query');
assert.equal((source.match(/#sam-world-engine \.we-setting-row\{grid-template-columns:1fr\}/g) || []).length, 1, 'settings single-column override must have one source');

assert.match(source, /standard:\{name:'标准',size:'16px',desc:'正文约15px，辅助字不低于13px'\}/, 'standard typography description must match actual token floor');
assert.match(source, /--we-fs-root:16px;--we-fs-body:15px;--we-fs-small:13px;--we-fs-tiny:13px;/, 'standard typography tokens must be readable');
assert.match(source, /--we-fs-root:18px;--we-fs-body:17px;--we-fs-small:15px;--we-fs-tiny:14px;/, 'large typography tokens must scale content');
assert.match(source, /--we-fs-root:20px;--we-fs-body:19px;--we-fs-small:17px;--we-fs-tiny:15px;/, 'xlarge typography tokens must scale content');

console.log('world-engine UI theme acceptance passed');
