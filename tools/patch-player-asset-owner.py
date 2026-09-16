from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETTLEMENT = ROOT / 'Regular' / '结算任务美化.html'
HELPER = ROOT / 'script' / '辅助计算脚本.js'
HELPER_DIST = ROOT / 'dist' / 'V20260916' / '辅助计算脚本.js'
VARIABLES = ROOT / 'World Book' / '[variables]当前变量.txt'
ASSET_TEST = ROOT / 'tests' / 'world-engine-asset-writeback.cjs'


def replace_once(path: Path, old: str, new: str, label: str) -> bool:
    text = path.read_text(encoding='utf-8')
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one legacy block, got {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    return True


# 1. 结算：<user> 是提示词宏，不是 JS 可依赖的运行时身份。
#    正式判定读取 Tavern 当前 name1；旧标记只作为历史存档兼容。
settlement_old = """              // 普通副本结束时只保留玩家拥有/共管的资产；纯NPC、势力或无主资产随副本清理。
              const assets = ensureObject(stat, '资产');
              Object.keys(assets).forEach(function(assetName) {
                const asset = assets[assetName];
                const rawOwners = asset && typeof asset === 'object' ? asset.所属对象 : null;
                // 兼容旧存档：缺失所属对象的历史资产仍按既有迁移语义视为玩家资产，避免误删。
                const owners = Array.isArray(rawOwners)
                  ? rawOwners
                  : (rawOwners == null ? ['<user>'] : [String(rawOwners)]);
                if (owners.indexOf('<user>') >= 0) return;
                delete assets[assetName];
                changed = true;
              });"""
settlement_new = """              // 普通副本结束时只保留玩家拥有/共管的资产；纯NPC、势力或无主资产随副本清理。
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
settlement_changed = replace_once(SETTLEMENT, settlement_old, settlement_new, 'settlement player asset owner')


# 2. 自动收菜：与结算使用同一身份语义，不能再把字面 <user> 当唯一玩家 ID。
helper_old = """    function isPlayerOwnedAsset(asset) {
        const owners = Array.isArray(asset?.所属对象)
            ? asset.所属对象
            : (typeof asset?.所属对象 === 'string' ? [asset.所属对象] : []);
        return owners.some(owner => String(owner || '').trim() === '<user>');
    }"""
helper_new = """    function isPlayerOwnedAsset(asset) {
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
helper_changed = replace_once(HELPER, helper_old, helper_new, 'helper player asset owner')
if helper_changed or HELPER_DIST.read_text(encoding='utf-8') != HELPER.read_text(encoding='utf-8'):
    shutil.copyfile(HELPER, HELPER_DIST)


# 3. 正文变量投影：只把当前 Tavern Persona 实际拥有/共管的资产投影给正文。
variables_old = """const projectionNameKey = value => String(value || '').toLowerCase().replace(/[\\/／·・._\\-\\s]+/g, '');
const isPlayerOwnedAsset = asset => {
  const owners = Array.isArray(asset?.所属对象)
    ? asset.所属对象
    : (typeof asset?.所属对象 === 'string' ? [asset.所属对象] : []);
  return owners.some(owner => String(owner || '').trim() === '<user>');
};"""
variables_new = """const projectionNameKey = value => String(value || '').toLowerCase().replace(/[\\/／·・._\\-\\s]+/g, '');
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
variables_changed = replace_once(VARIABLES, variables_old, variables_new, 'variable projection player asset owner')

# 场外人物投影原本另算了一遍玩家名，改为复用统一身份集合，避免同一文件双重身份来源。
variables_text = VARIABLES.read_text(encoding='utf-8')
legacy_people_start = variables_text.find("    const playerName = (() => {", variables_text.find("const personNameKey"))
legacy_people_end_marker = "    const playerKeys = new Set([playerName, '{{user}}', '<user>', '玩家'].filter(Boolean).map(personNameKey));"
legacy_people_end = variables_text.find(legacy_people_end_marker, legacy_people_start)
if legacy_people_start >= 0 and legacy_people_end >= 0:
    legacy_people_end += len(legacy_people_end_marker)
    variables_text = variables_text[:legacy_people_start] + "    const playerKeys = playerIdentityKeys;" + variables_text[legacy_people_end:]
    VARIABLES.write_text(variables_text, encoding='utf-8')
elif "    const playerKeys = playerIdentityKeys;" not in variables_text:
    raise SystemExit('variable projection offstage player identity anchor not found')


# 4. 回归：通过实际结算函数与自动收菜函数验证“运行时 Persona 名”这一外部行为。
asset_test_text = ASSET_TEST.read_text(encoding='utf-8')
asset_test_anchor = "const source = fs.readFileSync('script/世界推进系统.js', 'utf8');"
asset_test_read = "const settlementUi = fs.readFileSync('Regular/结算任务美化.html', 'utf8');"
if asset_test_read not in asset_test_text:
    if asset_test_anchor not in asset_test_text:
        raise SystemExit('asset writeback test source anchor not found')
    asset_test_text = asset_test_text.replace(asset_test_anchor, asset_test_anchor + "\n" + asset_test_read, 1)

behavior_block = r'''

// Tavern 运行时 Persona 名才是程序身份来源；<user>/{{user}}/玩家仅用于旧存档兼容。
const helperOwnerStart = helper.indexOf('function isPlayerOwnedAsset(');
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
else global.window = previousOwnerWindow;

const finalizationMatch = settlementUi.match(/          function applySettlementFinalization\(c, isLatestPanel\) \{([\s\S]*?)\n          \}\n\n          async function writeSettlementToMvu/);
assert.ok(finalizationMatch, '必须能提取普通副本结算最终清理函数');
const applySettlementFinalization = new Function(
  'rawText', 'hasSettlementHeader', 'isFullSettlement', 'isTrialPassed', 'trialTasks', 'readReincarnatorTier', 'settlementBaselineTier', 'settlementTaskKeys',
  `return function applySettlementFinalization(c, isLatestPanel) {${finalizationMatch[1]}\n  };`
)(
  '轮回清算协议',
  () => true,
  () => true,
  () => false,
  [],
  () => 'Ⅰ',
  'Ⅰ',
  []
);
const settlementFixture = {
  stat_data: {
    设置: { 单一世界: false },
    角色: { 层级: 'Ⅰ' },
    世界: { 名称: '测试副本', 后台: {}, 异端雷达: {} },
    系统状态: { 是否在主神空间: false, 游玩天数: 1 },
    任务: { 击杀: {}, 列表: {}, 副本成就: {} },
    传闻: { 街头巷议: {}, 情报交易: {}, 布告与檄文: {} },
    关系列表: {},
    资产: {
      玩家庄园: { 所属对象: ['测试玩家'], 类型: '固定地产' },
      共管基地: { 所属对象: ['盟友', '测试玩家'], 类型: '要塞' },
      旧宏资产: { 所属对象: ['<user>'], 类型: '固定地产' },
      旧版缺失归属: { 类型: '固定地产' },
      敌军据点: { 所属对象: ['敌军'], 类型: '要塞' },
      无主遗迹: { 所属对象: [], 类型: '固定地产' },
    },
  },
};
const previousSettlementWindow = global.window;
global.window = { parent: { SillyTavern: { name1: '测试玩家' } } };
assert.equal(applySettlementFinalization(settlementFixture, true), true);
assert.deepEqual(
  Object.keys(settlementFixture.stat_data.资产).sort(),
  ['玩家庄园', '共管基地', '旧宏资产', '旧版缺失归属'].sort(),
  '普通副本结算必须保留 Tavern 当前 Persona 拥有/共管资产，并清理纯 NPC/无主资产'
);
if (previousSettlementWindow === undefined) delete global.window;
else global.window = previousSettlementWindow;
'''.strip('\n')
behavior_marker = '// Tavern 运行时 Persona 名才是程序身份来源；<user>/{{user}}/玩家仅用于旧存档兼容。'
if behavior_marker not in asset_test_text:
    log_anchor = "console.log('world-engine asset ownership/writeback acceptance passed');"
    if log_anchor not in asset_test_text:
        raise SystemExit('asset writeback test log anchor not found')
    asset_test_text = asset_test_text.replace(log_anchor, behavior_block + "\n\n" + log_anchor, 1)

# 静态约束也锁定三个执行环境都读取 Tavern 身份，不允许以后又退回字面宏比较。
static_old = """assert.match(variables, /isPlayerOwnedAsset/, '正文变量投影必须区分玩家资产与世界资产');
assert.match(helper, /isPlayerOwnedAsset/, '自动收菜必须区分玩家资产与世界资产');"""
static_new = """assert.match(variables, /tavernPlayerName[\\s\\S]{0,1800}playerIdentityKeys/, '正文玩家资产投影必须读取 Tavern Persona 身份');
assert.match(helper, /function isPlayerOwnedAsset[\\s\\S]{0,2200}SillyTavern[\\s\\S]{0,2200}playerOwnerKeys/, '自动收菜必须读取 Tavern Persona 身份');
assert.match(settlementUi, /playerOwnerName[\\s\\S]{0,2400}SillyTavern[\\s\\S]{0,2400}playerOwnerKeys/, '结算清理必须读取 Tavern Persona 身份');"""
if static_new not in asset_test_text:
    if static_old not in asset_test_text:
        raise SystemExit('asset writeback ownership assertion anchor not found')
    asset_test_text = asset_test_text.replace(static_old, static_new, 1)

ASSET_TEST.write_text(asset_test_text, encoding='utf-8')

changed = settlement_changed or helper_changed or variables_changed
print('player asset owner runtime identity synchronized' + (' (updated)' if changed else ''))
