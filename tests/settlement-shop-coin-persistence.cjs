const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const source = read('Regular/结算任务美化.html');
const zod = read('script/ZOD脚本.js');
const init = read('World Book/[InitVar]世界初始设定.yaml');
const vars = read('World Book/[variables]当前变量.txt');

const guardMatch = source.match(/\/\/ SETTLEMENT_COIN_WRITE_GUARD_START([\s\S]*?)\/\/ SETTLEMENT_COIN_WRITE_GUARD_END/);
assert(guardMatch, 'settlement coin write guard must exist');
const guard = new Function(guardMatch[1] + '\nreturn { settlementCoinWriteTarget };')();

const settlement = { balanceBefore: 1260, balanceAfter: 7760 };
assert.equal(guard.settlementCoinWriteTarget(1260, settlement), 7760, 'fresh settlement may credit from the exact pre-settlement balance');
assert.equal(guard.settlementCoinWriteTarget(7760, settlement), null, 'already-settled balance must not be credited again');
assert.equal(guard.settlementCoinWriteTarget(260, settlement), null, 'post-settlement shop spending must remain authoritative');
assert.equal(guard.settlementCoinWriteTarget(5260, settlement), null, 'partial shop spending must never be refunded by settlement rerender');

assert.match(source, /let settlementCoinWriteDone = false;/, 'one panel lifecycle must settle coins at most once');
assert.match(source, /if \(panelMessageId === null\) return;/, 'a panel without its own message id must be display-only');
assert.doesNotMatch(source, /panelMessageId === null\s*\?\s*['"]latest['"]/, 'unknown settlement panels must never fall back to mutating the latest message');
assert.match(source, /settlementCoinWriteTarget\(currentCoin, spaceCoinSettlement\)/, 'MVU write path must use the guarded settlement target');
assert.match(source, /recordedMarker !== settlementMarker[\s\S]*sys\.结算空间币记录 = settlementMarker/, 'settlement writes must persist a per-message one-shot marker');
assert.match(zod, /结算空间币记录:\s*safeStr\(''\)/, 'persistent settlement marker must survive schema parsing');
assert.match(init, /结算空间币记录:\s*''/, 'new saves must initialize the settlement marker');
assert.match(vars, /_.omit\(data\.系统状态 \|\| \{}, \[[^\]]*'结算空间币记录'[^\]]*\]\)/, 'settlement marker must stay hidden from variable AI');

console.log('settlement shop coin persistence regression: OK');
