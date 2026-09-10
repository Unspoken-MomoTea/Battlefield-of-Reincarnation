const fs = require('node:fs');
const assert = require('node:assert/strict');
const {
  emptyState,
  compileWorldResult,
  applyPatches,
  WORLD_RESULT_SCHEMA,
  projectWorldContext,
} = require('../script/世界推进系统.js');

const ownerSchema = WORLD_RESULT_SCHEMA.properties.资产.items.properties.所属对象;
assert.equal(ownerSchema.type, 'array', 'WorldResult.资产.所属对象 必须使用数组');
assert.equal(ownerSchema.items.type, 'string');
assert.equal(ownerSchema.minItems, undefined, '空数组必须合法，用于无主资产');

const base = {
  世界: {
    名称: '艾泽拉斯', 时间: '黑暗之门历84年7月12日', 地点: '西瘟疫之地',
    后台: emptyState(), 因果轨道: { 当前阶段:'', 故事线:'', 下一节点:'', 偏移记录:{} },
    势力:{}, 探索:{}, 货币:{}, 历法:{}, 异端雷达:{名单:{}},
  },
  角色:{}, 关系列表:{}, 传闻:{}, 设置:{}, 系统状态:{是否战斗中:false,是否在主神空间:false},
  资产:{
    联军前哨站:{所属对象:['<user>','白银之手'],类型:'固定地产',主体规模:3,完整度:90,状态:'联防',建设序列:{},驻扎人员:{},待办事件:[]},
    无主遗迹:{所属对象:[],类型:'固定地产',主体规模:2,完整度:35,状态:'废弃',建设序列:{},驻扎人员:{},待办事件:[]},
  },
};

let compiled = compileWorldResult(base, {
  摘要:'银色黎明加入联防。',
  资产:[{名称:'联军前哨站',所属对象:['<user>','白银之手','银色黎明']}],
});
let next = applyPatches(base, compiled.patches);
assert.deepEqual(next.资产.联军前哨站.所属对象, ['<user>','白银之手','银色黎明'], '资产应支持多主体共同归属');

compiled = compileWorldResult(next, {
  摘要:'发现一处无主废墟。',
  资产:[{名称:'东部废区',所属对象:[],类型:'固定地产',状态:'无人控制'}],
});
next = applyPatches(next, compiled.patches);
assert.deepEqual(next.资产.东部废区.所属对象, [], '新资产允许显式无主');

compiled = compileWorldResult(next, {
  摘要:'兼容非严格接口的旧写法。',
  资产:[{名称:'东部废区',所属对象:'无主'}],
});
next = applyPatches(next, compiled.patches);
assert.deepEqual(next.资产.东部废区.所属对象, [], '“无主”兼容输入必须归一为空数组');

const projected = projectWorldContext(next);
assert.deepEqual(projected.资产.联军前哨站.所属对象, ['<user>','白银之手','银色黎明']);
assert.deepEqual(projected.资产.东部废区.所属对象, []);

// 程序墓碑：玩家/MVU手动删除后，旧剧情记忆不能让世界引擎把同名资产诈尸回来。
const deleted = JSON.parse(JSON.stringify(next));
delete deleted.资产.无主遗迹;
deleted.世界.后台.资产墓碑 = { 无主遗迹: '黑暗之门历84年7月12日' };
assert.throws(() => compileWorldResult(deleted, {
  摘要:'错误地复活旧遗迹。',
  资产:[{名称:'无主遗迹',所属对象:[],类型:'固定地产'}],
}), /已被.*删除|删除保护|不得重建/, '被手动删除的资产不能由世界引擎自动重建');

// 若用户/MVU之后明确重新建立同名资产，则它已经存在，世界引擎可以继续维护。
deleted.资产.无主遗迹 = {所属对象:[],类型:'固定地产',主体规模:1,完整度:20,状态:'重新发现',建设序列:{},驻扎人员:{},待办事件:[]};
compiled = compileWorldResult(deleted, {摘要:'继续维护重新建立的遗迹。',资产:[{名称:'无主遗迹',完整度:25}]});
assert.equal(compiled.patches.length, 1);

const zod = fs.readFileSync('script/ZOD脚本.js','utf8');
const helper = fs.readFileSync('script/辅助计算脚本.js','utf8');
const status = fs.readFileSync('script/悬浮球状态栏.js','utf8');
const vars = fs.readFileSync('World Book/[variables]当前变量.txt','utf8');
const rules = fs.readFileSync('World Book/⚙️资产与载具规则.txt','utf8');
const source = fs.readFileSync('script/世界推进系统.js','utf8');

// 直接执行辅助脚本中的两个纯函数，锁定“只有字面 <user> 才收菜”与删除墓碑行为。
const ownerStart = helper.indexOf('function isPlayerOwnedAsset(');
const ownerEnd = helper.indexOf('/** 记录资产显式删除', ownerStart);
assert.ok(ownerStart >= 0 && ownerEnd > ownerStart, '必须能提取资产归属判定函数');
const isPlayerOwnedAsset = new Function(helper.slice(ownerStart, ownerEnd) + ';return isPlayerOwnedAsset;')();
assert.equal(isPlayerOwnedAsset({所属对象:['<user>','白银之手']}), true);
assert.equal(isPlayerOwnedAsset({所属对象:['玩家']}), false);
assert.equal(isPlayerOwnedAsset({所属对象:['{{user}}']}), false);
assert.equal(isPlayerOwnedAsset({所属对象:[]}), false);
assert.equal(isPlayerOwnedAsset({}), false, '新语义下缺失归属不能直接触发自动收菜；旧数据由 ZOD 迁移为 [<user>]');

const syncStart = helper.indexOf('function syncRemovedAssets(');
const syncEnd = helper.indexOf('/** 资产全自动收菜系统', syncStart);
assert.ok(syncStart >= 0 && syncEnd > syncStart, '必须能提取资产删除同步函数');
const syncRemovedAssets = new Function(helper.slice(syncStart, syncEnd) + ';return syncRemovedAssets;')();
const beforeManualDelete = {世界:{时间:'第10日',后台:{}},资产:{旧塔:{所属对象:[]}}};
const afterManualDelete = {世界:{时间:'第10日',后台:{}},资产:{}};
assert.deepEqual(syncRemovedAssets(afterManualDelete, beforeManualDelete), ['旧塔']);
assert.equal(afterManualDelete.世界.后台.资产墓碑.旧塔, '第10日');
const beforeRebuild = JSON.parse(JSON.stringify(afterManualDelete));
afterManualDelete.资产.旧塔 = {所属对象:[],类型:'固定地产'};
syncRemovedAssets(afterManualDelete, beforeRebuild);
assert.equal(afterManualDelete.世界.后台.资产墓碑.旧塔, undefined, '明确重建同名资产后必须解除删除保护');

assert.match(zod, /const assetOwners[\s\S]{0,220}z\.array\(z\.string\(\)\)/, 'ZOD 必须定义所属对象字符串数组规范器');
assert.match(zod, /所属对象:\s*assetOwners/, '资产字段必须使用统一 owner 数组规范器');
assert.match(zod, /资产墓碑/, '后台 Schema 必须允许程序保存资产删除墓碑');
assert.match(helper, /function isPlayerOwnedAsset[\s\S]{0,420}Array\.isArray\(asset\?\.所属对象\)[\s\S]{0,420}=== '<user>'/, '自动收菜必须只认所属对象数组里的 <user>');
const harvestHelper = helper.slice(helper.indexOf('function isPlayerOwnedAsset'), helper.indexOf('/** 资产全自动收菜系统'));
assert.doesNotMatch(harvestHelper, /playerName|SillyTavern|\{\{user\}\}|玩家/, '自动收菜不得再把玩家名或别名当成收菜权限');
assert.match(status, /assetOwnerChips|sam-asset-owner/, '状态栏资产卡必须展示所属对象');
assert.match(status, /所属对象/, '状态栏经营页必须有所属对象字段');
assert.match(status, /无主/, '空所属对象在 UI 中必须显示“无主”');
assert.match(status, /var assets = sd\.资产 \|\| \{\}/, '状态栏经营页仍应读取并显示全部资产，而不是只过滤玩家资产');
assert.match(vars, /Array\.isArray\(asset\?\.所属对象\)[\s\S]{0,260}=== '<user>'/, '正文玩家资产投影必须支持所属对象数组并只认 <user>');
assert.match(rules, /空数组[^\n]*无主|\[\][^\n]*无主/, '资产规则必须明确空数组表示无主');
assert.match(source, /version:13,\n        builtin:true,\n        name:'默认设置'/, '多主体归属语义应升级内置 Prompt 到 v13');
assert.match(source, /资产墓碑|删除保护/, '世界引擎必须明确处理手动删除资产的防诈尸语义');

console.log('world-engine multi-owner asset lifecycle acceptance passed');
