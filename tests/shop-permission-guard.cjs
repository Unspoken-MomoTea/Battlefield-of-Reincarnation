const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script', '悬浮球状态栏.js'), 'utf8');
const match = source.match(/\/\/ SHOP_PERMISSION_GUARD_START([\s\S]*?)\/\/ SHOP_PERMISSION_GUARD_END/);
assert(match, 'permission guard block must exist');

const sandbox = {};
vm.runInNewContext(`${match[0]}\nthis.guard = { shopPermissionCapRank, shopPermissionDecision };`, sandbox);
const { shopPermissionCapRank, shopPermissionDecision } = sandbox.guard;
const grade = rank => ['F','E','D','C','B','A','S','SS','SSS'][rank];

const reported = { 层级: 'Ⅲ' };
const eCredential = { E: 1 };
assert.equal(grade(shopPermissionCapRank(reported, eCredential)), 'C');
assert.equal(shopPermissionDecision(reported, { name: 'SSS升级', rating: 'SSS' }, eCredential).allowed, false);
assert.equal(shopPermissionDecision(reported, { name: 'C升级', rating: 'C' }, eCredential).allowed, true);

const sCredential = { S: 1 };
assert.equal(grade(shopPermissionCapRank(reported, sCredential)), 'S');
assert.equal(shopPermissionDecision(reported, { rating: 'S' }, sCredential).allowed, true);
assert.equal(shopPermissionDecision(reported, { rating: 'SS' }, sCredential).allowed, false);

assert.equal(grade(shopPermissionCapRank(reported, { SSS: 0 })), 'C');
assert.equal(shopPermissionDecision(reported, { tier: 'Ⅳ' }, eCredential).allowed, true);
assert.equal(shopPermissionDecision(reported, { tier: 'Ⅸ' }, eCredential).allowed, false);

const topTier = { 层级: 'Ⅸ' };
assert.equal(grade(shopPermissionCapRank(topTier, {})), 'SSS');
assert.equal(shopPermissionDecision(topTier, { rating: 'SSS' }, {}).allowed, true);

assert(source.includes("var permissionLocked = (!isSelected && !permission.allowed);"));
assert(source.includes("if (!gate.allowed) throw new Error(shopPermissionMessage(gate, gateItem));"));
assert(source.includes("if (reason === 'permission')"));
assert(source.includes('权限凭证(角色账户)'));
assert(source.includes('coinOwner.权限凭证'));
assert(!source.includes('scan(character && character.道具, true)'));
assert(!source.includes('商品一旦生成即可直接购买'));

console.log('shop permission guard regression passed');
