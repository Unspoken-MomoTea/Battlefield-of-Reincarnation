const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../script/世界推进系统.js'),'utf8');
const context={module:{exports:{}},console,setTimeout,clearTimeout,AbortController};
vm.runInNewContext(source.replace('module.exports = {','module.exports = {causalOffsetEntries,latestCausalOffsets,CAUSAL_OVERVIEW_LIMIT,'),context);
const {causalOffsetEntries,latestCausalOffsets,CAUSAL_OVERVIEW_LIMIT}=context.module.exports;

const offset=(影响程度)=>({描述:'测试偏移',引发者:'测试者',影响程度});
const stat={世界:{因果轨道:{偏移记录:{
  '旧一':offset(-1),
  '旧二':offset(-2),
  '中间':offset(3),
  '新二':offset(-4),
  '最新':offset(5)
}}}};
const names=list=>JSON.parse(JSON.stringify(list.map(([name])=>name)));
assert.equal(CAUSAL_OVERVIEW_LIMIT,3,'主面板因果摘要只显示最新3条');
assert.deepEqual(names(causalOffsetEntries(stat)),['最新','新二','中间','旧二','旧一'],'完整因果档案应按最新记录在前显示');
assert.deepEqual(names(latestCausalOffsets(stat)),['最新','新二','中间'],'主面板只取最新3条，不再展开全部偏移');
assert.deepEqual(names(latestCausalOffsets(stat,2)),['最新','新二'],'摘要 helper 应支持更小显示窗口');
console.log('PASS causal overview keeps full history but exposes newest records first with a compact main-panel window');
