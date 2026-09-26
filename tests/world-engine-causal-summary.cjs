const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../script/世界推进系统.js'),'utf8');
const context={module:{exports:{}},console,setTimeout,clearTimeout,AbortController};
vm.runInNewContext(source.replace('module.exports = {','module.exports = {causalOffsetEntries,latestCausalOffsets,CAUSAL_OVERVIEW_LIMIT,causalInterferenceMode,causalArchiveHtml,WORLD_ENGINE_HIDDEN_PLAYER_TABS,isWorldEnginePlayerTabHidden,'),context);
const {causalOffsetEntries,latestCausalOffsets,CAUSAL_OVERVIEW_LIMIT,causalInterferenceMode,causalArchiveHtml,WORLD_ENGINE_HIDDEN_PLAYER_TABS,isWorldEnginePlayerTabHidden}=context.module.exports;

const offset=(影响程度)=>({描述:'测试偏移',引发者:'测试者',影响程度});
const stat={世界:{稳定:96,因果轨道:{当前阶段:'局势已发生改变',故事线:'旧秩序 → 新秩序',下一节点:'关键决战',偏移记录:{
  '旧一':offset(-1),
  '旧二':offset(-2),
  '中间':offset(3),
  '新二':offset(-4),
  '最新':offset(5)
}},异端雷达:{当前模式:'多方势力围绕圣杯展开隐蔽博弈'},法则:['测试法则'],货币:{体系:'金币',购买力基准:'一餐1金币',经济波动:'稳定'}}};
const names=list=>JSON.parse(JSON.stringify(list.map(([name])=>name)));
assert.equal(CAUSAL_OVERVIEW_LIMIT,3,'主面板因果摘要只显示最新3条');
assert.deepEqual(names(causalOffsetEntries(stat)),['最新','新二','中间','旧二','旧一'],'完整因果档案应按最新记录在前显示');
assert.deepEqual(names(latestCausalOffsets(stat)),['最新','新二','中间'],'主面板只取最新3条，不再展开全部偏移');
assert.deepEqual(names(latestCausalOffsets(stat,2)),['最新','新二'],'摘要 helper 应支持更小显示窗口');
assert.equal(causalInterferenceMode(stat),'多方势力围绕圣杯展开隐蔽博弈','因果档案应读取当前干涉模式');
const archive=causalArchiveHtml(stat);
assert.match(archive,/<h2>干涉模式<\/h2>/,'有干涉模式时应在因果档案显示');
assert.match(archive,/多方势力围绕圣杯展开隐蔽博弈/,'因果档案应显示干涉模式正文');
const noMode=JSON.parse(JSON.stringify(stat));
noMode.世界.异端雷达.当前模式='';
assert.doesNotMatch(causalArchiveHtml(noMode),/<h2>干涉模式<\/h2>/,'没有干涉模式时因果档案必须隐藏该区块');
assert.equal(WORLD_ENGINE_HIDDEN_PLAYER_TABS.has('资产'),true,'世界推进玩家面板必须隐藏资产模块');
assert.equal(WORLD_ENGINE_HIDDEN_PLAYER_TABS.has('传闻'),true,'世界推进玩家面板必须隐藏传闻模块');
assert.equal(isWorldEnginePlayerTabHidden('资产'),true);
assert.equal(isWorldEnginePlayerTabHidden('传闻'),true);
assert.equal(isWorldEnginePlayerTabHidden('角色管理'),false,'角色管理等核心页仍应保留');
const causalLegacySource=fs.readFileSync(require.resolve('../script/world-engine-src/59-causal-overview-ui.part.js'),'utf8');
const causalControllerSource=fs.readFileSync(require.resolve('../src/WorldEngine/ui/WorldCausalOverviewController.part.js'),'utf8');
const causalSource=causalLegacySource+'\n'+causalControllerSource;
assert.match(causalSource,/querySelector\('\.we-kpi-grid\.we-kpi-compact'\)\?\.remove\(\)/,'主面板应删除低价值KPI数据栏');
assert.match(causalControllerSource,/removeRunRecordInterference[\s\S]*causalSectionByTitle\(main,'干涉模式'\)\?\.remove\(\)/,'运行记录应移除干涉模式区块');
assert.match(causalControllerSource,/hideRedundantPlayerModules[\s\S]*WORLD_ENGINE_HIDDEN_PLAYER_TABS[\s\S]*\?\.remove\(\)/,'资产与传闻导航应从世界推进玩家UI移除');
assert.match(causalControllerSource,/isWorldEnginePlayerTabHidden\(this\.engine\.tab\).*this\.engine\.tab='世界推进'/s,'隐藏页被旧状态或程序指定时应自动回到世界推进');
console.log('PASS causal overview keeps full history, moves interference mode into the causal archive, removes the KPI strip, and hides redundant asset/rumor player tabs');
