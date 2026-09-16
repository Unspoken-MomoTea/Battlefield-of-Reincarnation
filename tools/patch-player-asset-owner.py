from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETTLEMENT = ROOT / 'Regular' / '结算任务美化.html'
HELPER = ROOT / 'script' / '辅助计算脚本.js'
HELPER_DIST = ROOT / 'dist' / 'V20260916' / '辅助计算脚本.js'
VARIABLES = ROOT / 'World Book' / '[variables]当前变量.txt'
WRITEBACK_TEST = ROOT / 'tests' / 'world-engine-asset-writeback.cjs'
MULTI_OWNER_TEST = ROOT / 'tests' / 'world-engine-asset-multi-owner.cjs'
LIFECYCLE_PATCH = ROOT / 'tools' / 'patch-settlement-character-lifecycle.py'
SELF = Path(__file__).resolve()


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one block, got {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


# 1) 辅助脚本：实测该执行环境可直接读取 SillyTavern 当前 Persona。
#    玩家归属采用精确名称比较；不再做去空格/符号/大小写归一，避免不同名字被误判为同一人。
helper_old = """    function isPlayerOwnedAsset(asset) {
        const owners = Array.isArray(asset?.所属对象)
            ? asset.所属对象
            : (typeof asset?.所属对象 === 'string' ? [asset.所属对象] : []);
        if (!owners.length) return false;

        let playerName = '';
        try {
            let host = null;
            try { if (typeof GS_PARENT !== 'undefined' && GS_PARENT) host = GS_PARENT; } catch (e) {}
            if (!host && typeof window !== 'undefined') {
                try { if (window.parent && window.parent !== window) host = window.parent; } catch (e) {}
                if (!host) host = window;
            }
            const tavern = host?.SillyTavern || (typeof SillyTavern !== 'undefined' ? SillyTavern : null);
            playerName = String(tavern?.name1 || tavern?.getContext?.()?.name1 || host?.name1 || '').trim();
        } catch (e) {}

        const ownerKey = value => String(value || '').toLowerCase().replace(/[\\/／·・._\\-\\s]+/g, '');
        const legacyTemplateUser = '{{' + 'user}}';
        const playerOwnerKeys = new Set([playerName, '<user>', legacyTemplateUser, '玩家'].filter(Boolean).map(ownerKey));
        return owners.some(owner => playerOwnerKeys.has(ownerKey(owner)));
    }"""
helper_new = """    function getPlayerName() {
        try {
            if (typeof SillyTavern === 'undefined') return '';
            return String(SillyTavern.getContext?.()?.name1 || SillyTavern.name1 || '').trim();
        } catch (e) {
            return '';
        }
    }

    function isPlayerOwner(owner, playerName = getPlayerName()) {
        const value = String(owner || '').trim();
        if (!value) return false;
        return (!!playerName && value === playerName)
            || value === '<user>'
            || value === '{{user}}'
            || value === '玩家';
    }

    function isPlayerOwnedAsset(asset) {
        const owners = Array.isArray(asset?.所属对象)
            ? asset.所属对象
            : (typeof asset?.所属对象 === 'string' ? [asset.所属对象] : []);
        const playerName = getPlayerName();
        return owners.some(owner => isPlayerOwner(owner, playerName));
    }"""
replace_once(HELPER, helper_old, helper_new, 'helper identity simplification')
shutil.copyfile(HELPER, HELPER_DIST)


# 2) 结算 iframe：只保留一层 parent/window 取宿主；归属仍做精确比较。
settlement_old = """              // 普通副本结束时只保留玩家拥有/共管的资产；纯NPC、势力或无主资产随副本清理。
              // <user> 是提示词宏，进入数据库后可能已展开为真实 Persona 名；程序侧以 Tavern 运行时 name1 为准。
              const assets = ensureObject(stat, '资产');
              const playerOwnerName = (() => {
                try {
                  const ctx = typeof getMvuContext === 'function' ? getMvuContext() : null;
                  const win = ctx && ctx.win ? ctx.win : null;
                  const host = win || ((typeof window !== 'undefined' && window.parent && window.parent !== window)
                    ? window.parent
                    : (typeof window !== 'undefined' ? window : null));
                  const tavern = host?.SillyTavern || (typeof SillyTavern !== 'undefined' ? SillyTavern : null);
                  return String(tavern?.name1 || tavern?.getContext?.()?.name1 || host?.name1 || '').trim();
                } catch (e) { return ''; }
              })();
              const ownerKey = value => String(value || '').toLowerCase().replace(/[\\/／·・._\\-\\s]+/g, '');
              const legacyTemplateUser = '{{' + 'user}}';
              const playerOwnerKeys = new Set([playerOwnerName, '<user>', legacyTemplateUser, '玩家'].filter(Boolean).map(ownerKey));
              Object.keys(assets).forEach(function(assetName) {
                const asset = assets[assetName];
                const rawOwners = asset && typeof asset === 'object' ? asset.所属对象 : null;
                // 旧存档缺失所属对象时沿用既有迁移语义：视为玩家资产，避免误删。
                if (rawOwners == null) return;
                const owners = Array.isArray(rawOwners) ? rawOwners : [rawOwners];
                if (owners.some(owner => playerOwnerKeys.has(ownerKey(owner)))) return;
                delete assets[assetName];
                changed = true;
              });"""
settlement_new = """              // 普通副本结束时只保留玩家拥有/共管的资产；纯NPC、势力或无主资产随副本清理。
              // <user> 是提示词宏；程序侧以 Tavern 当前 Persona 名为正式玩家身份，旧标记只做兼容。
              const assets = ensureObject(stat, '资产');
              const playerOwnerName = (() => {
                try {
                  const host = (window.parent && window.parent !== window) ? window.parent : window;
                  const tavern = host?.SillyTavern;
                  return String(tavern?.getContext?.()?.name1 || tavern?.name1 || '').trim();
                } catch (e) { return ''; }
              })();
              const isPlayerAssetOwner = owner => {
                const value = String(owner || '').trim();
                if (!value) return false;
                return (!!playerOwnerName && value === playerOwnerName)
                  || value === '<user>'
                  || value === '{{user}}'
                  || value === '玩家';
              };
              Object.keys(assets).forEach(function(assetName) {
                const asset = assets[assetName];
                const rawOwners = asset && typeof asset === 'object' ? asset.所属对象 : null;
                // 旧存档缺失所属对象时沿用既有迁移语义：视为玩家资产，避免误删。
                if (rawOwners == null) return;
                const owners = Array.isArray(rawOwners) ? rawOwners : [rawOwners];
                if (owners.some(isPlayerAssetOwner)) return;
                delete assets[assetName];
                changed = true;
              });"""
replace_once(SETTLEMENT, settlement_old, settlement_new, 'settlement identity simplification')


# 3) 当前变量投影：资产归属精确比较；场外人物仍可按 personNameKey 做名称归一，仅复用身份原始值。
variables_old = """const projectionNameKey = value => String(value || '').toLowerCase().replace(/[\\/／·・._\\-\\s]+/g, '');
const tavernPlayerName = (() => {
  try {
    const host = (typeof window !== 'undefined' && window.parent && window.parent !== window)
      ? window.parent
      : (typeof window !== 'undefined' ? window : null);
    const tavern = host?.SillyTavern || (typeof SillyTavern !== 'undefined' ? SillyTavern : null);
    return String(tavern?.name1 || tavern?.getContext?.()?.name1 || host?.name1 || '').trim();
  } catch (_) { return ''; }
})();
const legacyTemplateUser = '{{' + 'user}}';
const playerIdentityKeys = new Set([tavernPlayerName, '<user>', legacyTemplateUser, '玩家'].filter(Boolean).map(projectionNameKey));
const isPlayerOwnedAsset = asset => {
  const owners = Array.isArray(asset?.所属对象)
    ? asset.所属对象
    : (typeof asset?.所属对象 === 'string' ? [asset.所属对象] : []);
  return owners.some(owner => playerIdentityKeys.has(projectionNameKey(owner)));
};"""
variables_new = """const projectionNameKey = value => String(value || '').toLowerCase().replace(/[\\/／·・._\\-\\s]+/g, '');
const tavernPlayerName = (() => {
  try {
    const host = (window.parent && window.parent !== window) ? window.parent : window;
    const tavern = host?.SillyTavern;
    return String(tavern?.getContext?.()?.name1 || tavern?.name1 || '').trim();
  } catch (_) { return ''; }
})();
const playerIdentityNames = [tavernPlayerName, '<user>', '{{user}}', '玩家'].filter(Boolean);
const isPlayerIdentity = value => playerIdentityNames.includes(String(value || '').trim());
const isPlayerOwnedAsset = asset => {
  const owners = Array.isArray(asset?.所属对象)
    ? asset.所属对象
    : (typeof asset?.所属对象 === 'string' ? [asset.所属对象] : []);
  return owners.some(isPlayerIdentity);
};"""
replace_once(VARIABLES, variables_old, variables_new, 'variable identity simplification')
replace_once(
    VARIABLES,
    '    const playerKeys = playerIdentityKeys;',
    '    const playerKeys = new Set(playerIdentityNames.map(personNameKey));',
    'offstage player key reuse',
)


# 4) 回归测试：以行为锁定“运行时 Persona + 精确匹配”，并明确 A-B != AB。
writeback = WRITEBACK_TEST.read_text(encoding='utf-8')
writeback = writeback.replace(
    "assert.match(variables, /tavernPlayerName[\\s\\S]{0,1800}playerIdentityKeys/, '正文玩家资产投影必须读取 Tavern Persona 身份');\nassert.match(helper, /function isPlayerOwnedAsset[\\s\\S]{0,2200}SillyTavern[\\s\\S]{0,2200}playerOwnerKeys/, '自动收菜必须读取 Tavern Persona 身份');\nassert.match(settlementUi, /playerOwnerName[\\s\\S]{0,2400}SillyTavern[\\s\\S]{0,2400}playerOwnerKeys/, '结算清理必须读取 Tavern Persona 身份');",
    "assert.match(variables, /tavernPlayerName[\\s\\S]{0,1200}playerIdentityNames/, '正文玩家资产投影必须读取 Tavern Persona 身份');\nassert.match(helper, /function getPlayerName[\\s\\S]{0,1200}function isPlayerOwnedAsset/, '自动收菜必须直接读取 Tavern Persona 身份');\nassert.match(settlementUi, /playerOwnerName[\\s\\S]{0,1800}isPlayerAssetOwner/, '结算清理必须读取 Tavern Persona 身份');",
    1,
)
old_behavior = """const helperOwnerStart = helper.indexOf('function isPlayerOwnedAsset(');
const helperOwnerEnd = helper.indexOf('/** 记录资产显式删除', helperOwnerStart);
assert.ok(helperOwnerStart >= 0 && helperOwnerEnd > helperOwnerStart, '必须能提取自动收菜资产归属判定');
const runtimePlayerOwnsAsset = new Function(helper.slice(helperOwnerStart, helperOwnerEnd) + ';return isPlayerOwnedAsset;')();
const previousOwnerWindow = global.window;
global.window = { parent: { SillyTavern: { name1: '测试玩家' } } };
assert.equal(runtimePlayerOwnsAsset({所属对象:['测试玩家']}), true, '自动收菜必须识别 Tavern 当前 Persona 名');
assert.equal(runtimePlayerOwnsAsset({所属对象:['盟友', '测试玩家']}), true, '共管资产包含当前 Persona 时仍属于玩家资产');
assert.equal(runtimePlayerOwnsAsset({所属对象:['<user>']}), true, '旧 <user> 标记仍需兼容');
assert.equal(runtimePlayerOwnsAsset({所属对象:['{{user}}']}), true, '旧 {{user}} 标记仍需兼容');
assert.equal(runtimePlayerOwnsAsset({所属对象:['敌军']}), false);
if (previousOwnerWindow === undefined) delete global.window;
else global.window = previousOwnerWindow;"""
new_behavior = """const helperOwnerStart = helper.indexOf('function getPlayerName(');
const helperOwnerEnd = helper.indexOf('/** 记录资产显式删除', helperOwnerStart);
assert.ok(helperOwnerStart >= 0 && helperOwnerEnd > helperOwnerStart, '必须能提取自动收菜资产归属判定');
const runtimePlayerOwnsAsset = new Function(helper.slice(helperOwnerStart, helperOwnerEnd) + ';return isPlayerOwnedAsset;')();
const previousSillyTavern = global.SillyTavern;
global.SillyTavern = { getContext: () => ({ name1: '测试玩家' }) };
assert.equal(runtimePlayerOwnsAsset({所属对象:['测试玩家']}), true, '自动收菜必须识别 Tavern 当前 Persona 名');
assert.equal(runtimePlayerOwnsAsset({所属对象:['盟友', '测试玩家']}), true, '共管资产包含当前 Persona 时仍属于玩家资产');
assert.equal(runtimePlayerOwnsAsset({所属对象:['<user>']}), true, '旧 <user> 标记仍需兼容');
assert.equal(runtimePlayerOwnsAsset({所属对象:['{{user}}']}), true, '旧 {{user}} 标记仍需兼容');
assert.equal(runtimePlayerOwnsAsset({所属对象:['玩家']}), true, '旧 玩家 标记仍需兼容');
assert.equal(runtimePlayerOwnsAsset({所属对象:['测试 玩家']}), false, '玩家名必须精确匹配，不能删除空格后误认');
global.SillyTavern = { getContext: () => ({ name1: 'AB' }) };
assert.equal(runtimePlayerOwnsAsset({所属对象:['A-B']}), false, '玩家名必须精确匹配，不能删除符号后误认');
if (previousSillyTavern === undefined) delete global.SillyTavern;
else global.SillyTavern = previousSillyTavern;"""
if old_behavior not in writeback:
    raise SystemExit('writeback behavior block not found')
writeback = writeback.replace(old_behavior, new_behavior, 1)
writeback = writeback.replace(
    "      无主遗迹: { 所属对象: [], 类型: '固定地产' },",
    "      无主遗迹: { 所属对象: [], 类型: '固定地产' },\n      相似名资产: { 所属对象: ['测试 玩家'], 类型: '固定地产' },",
    1,
)
writeback = writeback.replace(
    "global.window = { parent: { SillyTavern: { name1: '测试玩家' } } };",
    "global.window = { parent: { SillyTavern: { getContext: () => ({ name1: '测试玩家' }) } } };",
    1,
)
WRITEBACK_TEST.write_text(writeback, encoding='utf-8')

multi = MULTI_OWNER_TEST.read_text(encoding='utf-8')
old_multi_behavior = """// 直接执行辅助脚本中的两个纯函数，锁定“只有字面 <user> 才收菜”与删除墓碑行为。
const ownerStart = helper.indexOf('function isPlayerOwnedAsset(');
const ownerEnd = helper.indexOf('/** 记录资产显式删除', ownerStart);
assert.ok(ownerStart >= 0 && ownerEnd > ownerStart, '必须能提取资产归属判定函数');
const isPlayerOwnedAsset = new Function(helper.slice(ownerStart, ownerEnd) + ';return isPlayerOwnedAsset;')();
assert.equal(isPlayerOwnedAsset({所属对象:['<user>','白银之手']}), true);
assert.equal(isPlayerOwnedAsset({所属对象:['玩家']}), false);
assert.equal(isPlayerOwnedAsset({所属对象:['{{user}}']}), false);
assert.equal(isPlayerOwnedAsset({所属对象:[]}), false);
assert.equal(isPlayerOwnedAsset({}), false, '新语义下缺失归属不能直接触发自动收菜；旧数据由 ZOD 迁移为 [<user>]');"""
new_multi_behavior = """// 直接执行辅助脚本中的资产归属函数：当前 Tavern Persona 是正式身份，旧标记只作兼容。
const ownerStart = helper.indexOf('function getPlayerName(');
const ownerEnd = helper.indexOf('/** 记录资产显式删除', ownerStart);
assert.ok(ownerStart >= 0 && ownerEnd > ownerStart, '必须能提取资产归属判定函数');
const isPlayerOwnedAsset = new Function(helper.slice(ownerStart, ownerEnd) + ';return isPlayerOwnedAsset;')();
const previousSillyTavern = global.SillyTavern;
global.SillyTavern = { getContext: () => ({ name1: '测试玩家' }) };
assert.equal(isPlayerOwnedAsset({所属对象:['测试玩家','白银之手']}), true);
assert.equal(isPlayerOwnedAsset({所属对象:['<user>','白银之手']}), true);
assert.equal(isPlayerOwnedAsset({所属对象:['玩家']}), true);
assert.equal(isPlayerOwnedAsset({所属对象:['{{user}}']}), true);
assert.equal(isPlayerOwnedAsset({所属对象:['测试 玩家']}), false, '玩家名必须精确匹配');
assert.equal(isPlayerOwnedAsset({所属对象:[]}), false);
assert.equal(isPlayerOwnedAsset({}), false, '缺失归属不能触发自动收菜');
if (previousSillyTavern === undefined) delete global.SillyTavern;
else global.SillyTavern = previousSillyTavern;"""
if old_multi_behavior not in multi:
    raise SystemExit('multi-owner behavior block not found')
multi = multi.replace(old_multi_behavior, new_multi_behavior, 1)
multi = multi.replace(
    "assert.match(helper, /function isPlayerOwnedAsset[\\s\\S]{0,420}Array\\.isArray\\(asset\\?\\.所属对象\\)[\\s\\S]{0,420}=== '<user>'/, '自动收菜必须只认所属对象数组里的 <user>');\nconst harvestHelper = helper.slice(helper.indexOf('function isPlayerOwnedAsset'), helper.indexOf('/** 资产全自动收菜系统'));\nassert.doesNotMatch(harvestHelper, /playerName|SillyTavern|\\{\\{user\\}\\}|玩家/, '自动收菜不得再把玩家名或别名当成收菜权限');",
    "assert.match(helper, /function getPlayerName[\\s\\S]{0,1200}function isPlayerOwnedAsset/, '自动收菜必须读取 Tavern Persona 身份');\nconst harvestHelper = helper.slice(helper.indexOf('function getPlayerName'), helper.indexOf('/** 资产全自动收菜系统'));\nassert.match(harvestHelper, /SillyTavern/, '自动收菜必须直接读取运行时玩家身份');",
    1,
)
multi = multi.replace(
    "assert.match(vars, /Array\\.isArray\\(asset\\?\\.所属对象\\)[\\s\\S]{0,260}=== '<user>'/, '正文玩家资产投影必须支持所属对象数组并只认 <user>');",
    "assert.match(vars, /playerIdentityNames[\\s\\S]{0,900}isPlayerOwnedAsset/, '正文玩家资产投影必须使用 Tavern Persona 与旧标记兼容');",
    1,
)
MULTI_OWNER_TEST.write_text(multi, encoding='utf-8')


# 5) 资产身份迁移完成后立即退役本 patch，不再让 CI 反复改业务源码。
lifecycle = LIFECYCLE_PATCH.read_text(encoding='utf-8')
lifecycle = lifecycle.replace('import runpy\n', '', 1)
lifecycle = lifecycle.replace(
    "\n# 同步资产归属身份语义：程序读取 Tavern 当前 Persona 名，<user> 仅作为旧存档兼容。\nrunpy.run_path(str(ROOT / 'tools' / 'patch-player-asset-owner.py'), run_name='__main__')\n",
    '\n',
    1,
)
LIFECYCLE_PATCH.write_text(lifecycle, encoding='utf-8')
SELF.unlink()

print('simplified Tavern player identity; retired player-owner patch tool')
