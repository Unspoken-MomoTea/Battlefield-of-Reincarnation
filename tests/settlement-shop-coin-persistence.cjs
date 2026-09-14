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
assert.match(source, /resolveSettlementMessageTarget\(win, rawText\)/, 'MVU write path must resolve the current settlement target safely');
assert.match(source, /panelTextBelongsToMessage\(panelText, latest\)/, 'latest fallback must verify that this panel belongs to the latest chat message');
assert.doesNotMatch(source, /if \(panelMessageId === null\) return;/, 'missing getCurrentMessageId must not abort a genuine current settlement');
assert.doesNotMatch(source, /panelMessageId === null\s*\?\s*['"]latest['"]/, 'unknown settlement panels must never blindly fall back to mutating the latest message');
assert.match(source, /settlementCoinWriteTarget\(currentCoin, spaceCoinSettlement\)/, 'MVU write path must use the guarded settlement target');
assert.match(source, /SETTLEMENT_COIN_MESSAGE_MARKER_START/, 'settlement writes must use a message-scoped one-shot marker');
assert.match(source, /readSettlementCoinMessageMarker\(win, targetMessageId\)/, 'settlement must read its message-scoped marker');
assert.match(source, /writeSettlementCoinMessageMarker\(win, targetMessageId, settlementCoinMarkerPending\)/, 'settlement must persist its marker outside stat_data');
assert.doesNotMatch(source, /sys\.结算空间币记录|系统状态\.结算空间币记录/, 'program marker must not live in game variables');
assert.doesNotMatch(zod, /结算空间币记录/, 'schema must not contain program-only settlement state');
assert.doesNotMatch(init, /结算空间币记录/, 'new saves must not initialize program-only settlement state');
assert.doesNotMatch(vars, /结算空间币记录/, 'AI projection must not know about program-only settlement state');

console.log('settlement shop coin persistence regression: OK');
