const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'Regular', '结算任务美化.html'), 'utf8');

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

console.log('settlement shop coin persistence regression: OK');
