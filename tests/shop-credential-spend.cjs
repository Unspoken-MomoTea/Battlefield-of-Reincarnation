const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script', '悬浮球状态栏.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'World Book', '⚙️品质效果数值规则.txt'), 'utf8');
const match = source.match(/\/\/ SHOP_PERMISSION_GUARD_START([\s\S]*?)\/\/ SHOP_PERMISSION_GUARD_END/);
assert(match, 'permission guard block must exist');

const sandbox = {};
vm.runInNewContext(`${match[0]}\nthis.guard = { shopCredentialRequirement, shopCredentialCartRequirements, shopCredentialShortages, shopCredentialConsume, shopCredentialRefund };`, sandbox);
const {
  shopCredentialRequirement,
  shopCredentialCartRequirements,
  shopCredentialShortages,
  shopCredentialConsume,
  shopCredentialRefund,
} = sandbox.guard;

const D = { 层级: 'Ⅲ' };
const C = { 层级: 'Ⅳ' };
const B = { 层级: 'Ⅴ' };
const F = { 层级: 'Ⅰ' };

assert.equal(shopCredentialRequirement(F, { rating: 'D' }).required, false, 'F~D must not spend credentials');
assert.deepEqual(JSON.parse(JSON.stringify(shopCredentialRequirement(D, { rating: 'C' }))), {
  required: true, actorRank: 2, targetRank: 3, grade: 'C', quantity: 1,
});
assert.equal(shopCredentialRequirement(C, { rating: 'C' }).required, false, 'same grade must not spend');
assert.equal(shopCredentialRequirement(B, { rating: 'B' }).required, false, 'same B grade must not spend');
assert.equal(shopCredentialRequirement(B, { rating: 'A' }).grade, 'A', 'B -> A spends A credential');
assert.equal(shopCredentialRequirement(D, { rating: 'B' }).grade, 'B', 'crossing multiple grades only uses final target grade');
assert.equal(shopCredentialRequirement(D, { tier: 'Ⅳ' }).grade, 'C', 'form tier must map to C credential');

const cart = [
  { rating: 'C', _cat: '装备区', quantity: 1 },
  { rating: 'B', _cat: '升级区', quantity: 1 },
  { rating: 'C', _cat: '道具区', quantity: 3 },
];
const reqs = shopCredentialCartRequirements(D, cart);
assert.deepEqual(JSON.parse(JSON.stringify(reqs)), { C: 4, B: 1 });
assert.deepEqual(JSON.parse(JSON.stringify(shopCredentialShortages({ C: 3, B: 1 }, reqs))), [{ grade: 'C', need: 4, have: 3 }]);
const ledger = { C: 4, B: 2 };
assert.equal(shopCredentialConsume(ledger, reqs), true);
assert.deepEqual(ledger, { C: 0, B: 1 });
shopCredentialRefund(ledger, reqs);
assert.deepEqual(ledger, { C: 4, B: 2 });

assert(source.includes('所需凭证：'+"'+esc(req.grade)+'"+'级权限凭证 ×1'));
assert(source.includes('var credentialRequirements = shopCredentialCartRequirements(character, shopCart);'));
assert(source.includes('shopCredentialConsume(coinOwner.权限凭证, credentialRequirements)'));
assert(source.includes('credentialRequirements: preCredentialRequirements'));
assert(source.includes('shopCredentialRefund(statData.角色.权限凭证, bloodFusionSnap.credentialRequirements || {})'));
assert(source.includes('shopCredentialConsume(statData.角色.权限凭证, dpCredentialRequirements)'));
assert(source.includes('shopCredentialConsume(statData.角色.权限凭证, rpCredentialRequirements)'));
assert(rules.includes('凭证消耗仅从C级开始'));
assert(rules.includes('血统融合产生的品质变化不消耗权限凭证'));
assert(rules.includes('购买行为本身仍按上述规则消耗凭证'));

console.log('shop credential spend regression passed');
