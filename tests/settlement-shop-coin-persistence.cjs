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
const guard = new Function(guardMatch[1] + '\nreturn { settlementCoinWriteTarget, rebaseSettlementCoinBalance, settlementCoinLegacyRepairTarget };')();

const settlement = { balanceBefore: 1260, balanceAfter: 7760, totalReward: 6500 };
assert.equal(guard.settlementCoinWriteTarget(1260, settlement), 7760, 'fresh settlement may credit from the exact pre-settlement balance');
assert.equal(guard.settlementCoinWriteTarget(7760, settlement), null, 'already-settled balance must not be credited again');
assert.equal(guard.settlementCoinWriteTarget(260, settlement), null, 'post-settlement shop spending must remain authoritative');
assert.equal(guard.settlementCoinWriteTarget(5260, settlement), null, 'partial shop spending must never be refunded by settlement rerender');

// 玩家可见回归：任务快照可能比真实余额旧。收益仍按成熟任务快照计算，
// 但结算前余额必须取结算消息之前最近的真实 MVU 余额。
const staleTaskPlan = { balanceBefore: 0, balanceAfter: 740, totalReward: 740 };
const rebased = guard.rebaseSettlementCoinBalance(staleTaskPlan, 190);
assert.equal(rebased.balanceBefore, 190, 'stale task snapshot balance must not become the settlement account baseline');
assert.equal(rebased.balanceAfter, 930, '190 current coins + 740 settlement reward must end at 930');
assert.equal(guard.settlementCoinWriteTarget(190, rebased), 930, 'fresh settlement must credit from the authoritative pre-settlement balance');
assert.equal(guard.settlementCoinWriteTarget(930, rebased), null, 'refresh after successful credit must not double-pay');
assert.equal(guard.settlementCoinWriteTarget(500, rebased), null, 'shop spending after settlement must not be refunded on rerender');

// 兼容已经被旧逻辑写了 message marker、但因 190 !== 0 而实际没加币的存档。
assert.equal(guard.settlementCoinLegacyRepairTarget(190, staleTaskPlan, rebased), 930, 'legacy stale-balance suppression may be repaired exactly once');
assert.equal(guard.settlementCoinLegacyRepairTarget(930, staleTaskPlan, rebased), null, 'already credited legacy settlement must not be paid again');
assert.equal(guard.settlementCoinLegacyRepairTarget(190, { balanceBefore:190, balanceAfter:930, totalReward:740 }, rebased), null, 'legacy repair must only target the old stale-baseline mismatch bug');

assert.match(source, /function readSettlementCoinBalanceBefore\(/, 'settlement must read a dedicated pre-settlement coin baseline');
assert.match(source, /rebaseSettlementCoinBalance\(spaceCoinSettlement, settlementCoinBalanceBefore\)/, 'display/write plan must rebase onto the authoritative coin baseline');
assert.match(source, /let settlementCoinWriteDone = false;/, 'one panel lifecycle must settle coins at most once');
assert.match(source, /resolveSettlementMessageTarget\(win, rawText\)/, 'MVU write path must resolve the current settlement target safely');
assert.match(source, /panelTextBelongsToMessage\(panelText, latest\)/, 'latest fallback must verify that this panel belongs to the latest chat message');
assert.doesNotMatch(source, /if \(panelMessageId === null\) return;/, 'missing getCurrentMessageId must not abort a genuine current settlement');
assert.doesNotMatch(source, /panelMessageId === null\s*\?\s*['"]latest['"]/, 'unknown settlement panels must never blindly fall back to mutating the latest message');
assert.match(source, /settlementCoinWriteTarget\(currentCoin, spaceCoinSettlement\)/, 'MVU write path must use the guarded settlement target');
assert.match(source, /settlementCoinLegacyRepairTarget\(currentCoin, rawSpaceCoinSettlement, spaceCoinSettlement\)/, 'legacy stale-balance marker path must be repairable without broad re-crediting');
assert.match(source, /SETTLEMENT_COIN_MESSAGE_MARKER_START/, 'settlement writes must use a message-scoped one-shot marker');
assert.match(source, /readSettlementCoinMessageMarker\(win, targetMessageId\)/, 'settlement must read its message-scoped marker');
assert.match(source, /writeSettlementCoinMessageMarker\(win, targetMessageId, settlementCoinMarkerPending\)/, 'settlement must persist its marker outside stat_data');
assert.doesNotMatch(source, /sys\.结算空间币记录|系统状态\.结算空间币记录/, 'program marker must not live in game variables');
assert.doesNotMatch(zod, /结算空间币记录/, 'schema must not contain program-only settlement state');
assert.doesNotMatch(init, /结算空间币记录/, 'new saves must not initialize program-only settlement state');
assert.doesNotMatch(vars, /结算空间币记录/, 'AI projection must not know about program-only settlement state');

console.log('settlement shop coin persistence regression: OK');
