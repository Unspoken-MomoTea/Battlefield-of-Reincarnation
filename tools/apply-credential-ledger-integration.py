from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read_text(path):
    data = (ROOT / path).read_bytes().decode('utf-8')
    nl = '\r\n' if '\r\n' in data else '\n'
    return data, nl


def write_text(path, text):
    (ROOT / path).write_bytes(text.encode('utf-8'))


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label):
    out, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 regex match, got {count}')
    return out


def nl_block(s, nl):
    return s.strip('\n').replace('\n', nl)


# 1) 主终端：商城权限、源力灌注、商城UI、商城AI上下文
path = 'script/悬浮球状态栏.js'
text, nl = read_text(path)

source_helpers = nl_block(r'''
    // SOURCE_INFUSION_CREDENTIAL_START
    /* 权限凭证持有数：只读取角色.权限凭证.<品质>。 */
    function sourceInfusionCredentialQty(reincarnator, credentialGrade) {
        if (!reincarnator || !credentialGrade) return 0;
        var ledger = reincarnator.权限凭证 || {};
        return Math.max(0, Math.floor(safeNum(ledger[credentialGrade], 0)));
    }

    /* 消耗恰好1枚指定品质凭证；凭证为独立数值账本，不再从道具/状态中查找。 */
    function sourceInfusionConsumeCredential(reincarnator, credentialGrade) {
        if (!reincarnator || !credentialGrade) return false;
        reincarnator.权限凭证 = reincarnator.权限凭证 || {};
        var q = Math.max(0, Math.floor(safeNum(reincarnator.权限凭证[credentialGrade], 0)));
        if (q < 1) return false;
        reincarnator.权限凭证[credentialGrade] = q - 1;
        return true;
    }
    // SOURCE_INFUSION_CREDENTIAL_END

''', nl)
text = regex_once(
    text,
    r'    /\* 权限凭证持有数：新格式读取道具数量；兼容旧存档中同名状态凭证。 \*/.*?(?=    /\* 统一生成一次“当前层级→下一层级”的源力灌注计划；绝不按凭证品质跳级。 \*/)',
    source_helpers,
    'source infusion credential helpers'
)

old = nl_block('''
            credentialName: credentialName,
            coin: safeNum(sd.角色.空间币, 0),
            credentialQty: sourceInfusionCredentialQty(sd.角色, credentialName)
''', nl)
new = nl_block('''
            credentialName: credentialName,
            credentialGrade: nextGrade,
            coin: safeNum(sd.角色.空间币, 0),
            credentialQty: sourceInfusionCredentialQty(sd.角色, nextGrade)
''', nl)
text = replace_once(text, old, new, 'source infusion plan ledger')
text = replace_once(
    text,
    'if (!sourceInfusionConsumeCredential(payer, check.credentialName)) return;',
    'if (!sourceInfusionConsumeCredential(payer, check.credentialGrade)) return;',
    'source infusion consume ledger'
)

permission_guard = nl_block(r'''
function shopPermissionCredentialRank(credentials) {
    var best = -1;
    var ledger = credentials && typeof credentials === 'object' ? credentials : {};
    for (var i = 0; i < SHOP_PERMISSION_QUALITY_ORDER.length; i++) {
        var grade = SHOP_PERMISSION_QUALITY_ORDER[i];
        if (Number(ledger[grade] || 0) > 0) best = i;
    }
    return best;
}
function shopPermissionCapRank(character, credentials) {
    var tierRank = shopPermissionRank(character && character.层级);
    if (tierRank < 0) tierRank = 0;
    var baseRank = Math.min(SHOP_PERMISSION_QUALITY_ORDER.length - 1, tierRank + 1);
    var credentialRank = shopPermissionCredentialRank(credentials || {});
    return Math.max(baseRank, credentialRank);
}
''', nl)
text = regex_once(
    text,
    r'function shopPermissionCredentialRank\(character\) \{.*?\n\}\r?\nfunction shopPermissionCapRank\(character\) \{.*?\n\}\r?\n(?=function shopPermissionItemRank)',
    permission_guard,
    'shop permission credential ledger'
)
text = replace_once(
    text,
    'function shopPermissionDecision(character, item) {' + nl + '    var capRank = shopPermissionCapRank(character || {});',
    'function shopPermissionDecision(character, item, credentials) {' + nl + '    var capRank = shopPermissionCapRank(character || {}, credentials || {});',
    'shop permission decision signature'
)

old = nl_block('''
            var permissionCtx = shopResolveCharacter(getStatData() || {}, shopCurrentActor);
            var permission = shopPermissionDecision(permissionCtx.character || {}, item);
''', nl)
new = nl_block('''
            var permissionSd = getStatData() || {};
            var permissionCtx = shopResolveCharacter(permissionSd, shopCurrentActor);
            var permission = shopPermissionDecision(permissionCtx.character || {}, item, permissionSd.角色 && permissionSd.角色.权限凭证);
''', nl)
text = replace_once(text, old, new, 'shop select permission ledger')

text = replace_once(
    text,
    'var permission = shopPermissionDecision(permissionCharacter || {}, item);',
    'var permissionSd = getStatData() || {};' + nl + '        var permission = shopPermissionDecision(permissionCharacter || {}, item, permissionSd.角色 && permissionSd.角色.权限凭证);',
    'shop card permission ledger'
)
text = replace_once(
    text,
    'var gate = shopPermissionDecision(character, gateItem);',
    'var gate = shopPermissionDecision(character, gateItem, coinOwner.权限凭证);',
    'shop transaction permission ledger'
)

old = nl_block('''
        var p = ctx.character || {};
        var reincarnatorCoin = (sd.角色 && sd.角色.空间币 != null) ? sd.角色.空间币 : null;
        var parts = [];
''', nl)
new = nl_block('''
        var p = ctx.character || {};
        var reincarnatorCoin = (sd.角色 && sd.角色.空间币 != null) ? sd.角色.空间币 : null;
        var reincarnatorCredentials = (sd.角色 && sd.角色.权限凭证 && typeof sd.角色.权限凭证 === 'object') ? sd.角色.权限凭证 : {};
        var parts = [];
''', nl)
text = replace_once(text, old, new, 'shop context credential source')

old = nl_block('''
        // 空间币(支付池)始终以角色余额为准
        if (reincarnatorCoin != null) parts.push('空间币: ' + reincarnatorCoin);
''', nl)
new = nl_block('''
        // 空间币与权限凭证都属于角色账户；即使当前为NPC购买，也使用角色账户支付/授权。
        if (reincarnatorCoin != null) parts.push('空间币: ' + reincarnatorCoin);
        var credentialParts = [];
        for (var _ci = 0; _ci < SHOP_PERMISSION_QUALITY_ORDER.length; _ci++) {
            var _cg = SHOP_PERMISSION_QUALITY_ORDER[_ci];
            var _cq = Math.max(0, Math.floor(safeNum(reincarnatorCredentials[_cg], 0)));
            if (_cq > 0) credentialParts.push(_cg + '×' + _cq);
        }
        parts.push('权限凭证(角色账户): ' + (credentialParts.length ? credentialParts.join(' / ') : '无'));
''', nl)
text = replace_once(text, old, new, 'shop AI credential context')

text = replace_once(
    text,
    '【前置扫描】: 生成商品前，必须严格检索【当前角色数据】中的道具/状态，确认玩家当前层级以及是否持有【高阶权限凭证】。',
    '【前置扫描】: 生成商品前，必须读取【当前角色数据】中的购买对象层级，以及独立字段【权限凭证(角色账户)】。权限凭证不在道具/状态中查找。',
    'shop prompt credential source'
)
text = replace_once(
    text,
    '【基础视野】: 若无特殊凭证，商城视野 =【玩家当前层级+1阶】，最高封顶SSS（Ⅰ=F，Ⅱ=E……Ⅸ=SSS）。',
    '【基础视野】: 若无更高权限凭证，商城视野 =【购买对象当前层级+1阶】，最高封顶SSS（Ⅰ=F，Ⅱ=E……Ⅸ=SSS）。',
    'shop prompt base view'
)
text = replace_once(
    text,
    '【凭证覆盖】: 若玩家持有高于【玩家当前层级+1阶】的【X级权限凭证】（例:D级凭证），则本条直接覆盖【基础视野】，商城视野固定为【X级】。若存在多个有效权限凭证，只读取其中最高品质者。',
    '【凭证覆盖】: 若【权限凭证(角色账户)】中存在数量>0且高于【购买对象当前层级+1阶】的X级凭证，则商城视野提升至X级；多个有效凭证只取最高品质。凭证数量不会叠加品质。',
    'shop prompt credential override'
)

css_anchor = nl_block('''
        .sam-shop-coin-mini .lbl { font-weight:normal; color:var(--sam-sub); opacity:0.85; }
        .sam-shop-coin-mini .val { font-weight:900; text-shadow:0 0 6px rgba(229,193,102,0.5); }
''', nl)
css_new = css_anchor + nl + nl_block('''
        .sam-shop-credential-mini { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:5px; padding:5px 8px; margin-bottom:6px; background:rgba(143,159,255,0.06); border:1px solid var(--sam-border); border-radius:8px; font-size:11px; line-height:1.25; }
        .sam-shop-credential-mini .lbl { color:var(--sam-sub); margin-right:2px; }
        .sam-shop-credential-chip { display:inline-flex; align-items:center; gap:3px; padding:2px 7px; border:1px solid var(--sam-border); border-radius:10px; color:var(--sam-accent); background:var(--sam-card); font-weight:800; }
        .sam-shop-credential-empty { color:var(--sam-sub); opacity:0.75; }
''', nl)
text = replace_once(text, css_anchor, css_new, 'shop credential UI css')

ui_anchor = "        html += '<div class=\"sam-shop-coin-mini\"><span class=\"lbl\">💰 余额</span><span class=\"val\">' + coinDisplay + '</span><span class=\"lbl\">空间币</span></div>';"
ui_new = ui_anchor + nl + nl_block('''
        var credentialLedger = p.权限凭证 || {};
        var credentialChips = [];
        for (var _uiCi = 0; _uiCi < SHOP_PERMISSION_QUALITY_ORDER.length; _uiCi++) {
            var _uiGrade = SHOP_PERMISSION_QUALITY_ORDER[_uiCi];
            var _uiQty = Math.max(0, Math.floor(safeNum(credentialLedger[_uiGrade], 0)));
            if (_uiQty > 0) credentialChips.push('<span class="sam-shop-credential-chip">'+esc(_uiGrade)+' ×'+_uiQty+'</span>');
        }
        html += '<div class="sam-shop-credential-mini"><span class="lbl">🎫 权限凭证</span>'
            + (credentialChips.length ? credentialChips.join('') : '<span class="sam-shop-credential-empty">无</span>')
            + '</div>';
''', nl)
text = replace_once(text, ui_anchor, ui_new, 'shop credential UI')
write_text(path, text)


# 2) 结算美化：权限凭证写入独立数值账本
path = 'Regular/结算任务美化.html'
text, nl = read_text(path)
replacement = nl_block('''
              if (credentialGrant) {
                const key = 'stat_data.角色.权限凭证.' + credentialGrant.grade;
                const currentQty = Math.max(0, Number(win._.get(c, key)) || 0);
                const baselineQty = settlementBaselineData
                  ? Math.max(0, Number(win._.get(settlementBaselineData, key)) || 0)
                  : currentQty;
                const requiredQty = baselineQty + 1;
                if (currentQty < requiredQty) {
                  win._.set(c, key, requiredQty);
                  changed = true;
                }
              }
''', nl)
text = regex_once(
    text,
    r'              if \(credentialGrant\) \{\r?\n                const key = \'stat_data\.角色\.道具\.\' \+ credentialGrant\.name;.*?\r?\n              \}',
    replacement,
    'settlement credential ledger write'
)
write_text(path, text)


# 3) 当前变量：非战斗显示空间币+非零凭证，战斗同时隐藏
path = 'World Book/[variables]当前变量.txt'
text, nl = read_text(path)
old = nl_block('''
current.角色 = {
  种族: data.角色.种族,
  身份: data.角色.身份,
  职业: data.角色.职业,
  空间币: data.角色.空间币,
  HP: data.角色.HP,
  THP: data.角色.THP || 0,
  EP: data.角色.EP
};
''', nl)
new = nl_block('''
current.角色 = {
  种族: data.角色.种族,
  身份: data.角色.身份,
  职业: data.角色.职业,
  HP: data.角色.HP,
  THP: data.角色.THP || 0,
  EP: data.角色.EP
};
if (!isCombat) {
  current.角色.空间币 = data.角色.空间币;
  const credentialLedger = _.pickBy(_.cloneDeep(data.角色.权限凭证 || {}), value => Number(value) > 0);
  if (!_.isEmpty(credentialLedger)) current.角色.权限凭证 = credentialLedger;
}
''', nl)
text = replace_once(text, old, new, 'current variables credential visibility')
write_text(path, text)


# 4) 回归测试：商城权限改用独立凭证账本
shop_test = r'''const assert = require('node:assert/strict');
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
'''
(ROOT / 'tests/shop-permission-guard.cjs').write_text(shop_test, encoding='utf-8')

integration_test = r'''const assert = require('node:assert/strict');
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
'''
(ROOT / 'tests/credential-ledger-integration.cjs').write_text(integration_test, encoding='utf-8')

print('credential ledger integration patch applied')
