const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const status = fs.readFileSync(path.join(root, 'script', '悬浮球状态栏.js'), 'utf8');
const settlement = fs.readFileSync(path.join(root, 'Regular', '结算任务美化.html'), 'utf8');
const currentVars = fs.readFileSync(path.join(root, 'World Book', '[variables]当前变量.txt'), 'utf8');

const helperMatch = status.match(/\/\/ SOURCE_INFUSION_CREDENTIAL_START([\s\S]*?)\/\/ SOURCE_INFUSION_CREDENTIAL_END/);
assert(helperMatch, 'source infusion credential helper block must exist');
const sandbox = { safeNum: (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d };
vm.runInNewContext(`${helperMatch[0]}\nthis.helpers = { sourceInfusionCredentialQty, sourceInfusionConsumeCredential };`, sandbox);
const { sourceInfusionCredentialQty, sourceInfusionConsumeCredential } = sandbox.helpers;
const role = { 权限凭证: { C: 2 } };
assert.equal(sourceInfusionCredentialQty(role, 'C'), 2);
assert.equal(sourceInfusionConsumeCredential(role, 'C'), true);
assert.equal(role.权限凭证.C, 1);
assert.equal(sourceInfusionConsumeCredential(role, 'D'), false);
assert.equal(role.权限凭证.C, 1);

assert(settlement.includes("const key = 'stat_data.角色.权限凭证.' + credentialGrant.grade;"));
assert(!settlement.includes("const key = 'stat_data.角色.道具.' + credentialGrant.name;"));
assert(currentVars.includes('current.角色.空间币 = data.角色.空间币;'));
assert(currentVars.includes('current.角色.权限凭证 = credentialLedger;'));
assert(currentVars.includes('if (!isCombat) {'));
assert(status.includes('sam-shop-credential-mini'));
assert(status.includes("parts.push('权限凭证(角色账户): '"));
assert(status.includes('权限凭证不在道具/状态中查找'));

console.log('credential ledger integration regression passed');
