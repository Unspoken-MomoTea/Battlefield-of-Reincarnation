const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../script/世界推进系统.js'),'utf8');
const context={module:{exports:{}},console,setTimeout,clearTimeout,AbortController};
vm.runInNewContext(source.replace('module.exports = {','module.exports = {unscheduledEvents,ensureEventTimeAnchors,ensureRumorLiveliness,rumorMaintenanceRequirements,eventHasUsableSchedule,softRumorMaintenanceIssues,SOFT_MAINTENANCE_RULES,'),context);
const {unscheduledEvents,ensureEventTimeAnchors,ensureRumorLiveliness,rumorMaintenanceRequirements,eventHasUsableSchedule,SOFT_MAINTENANCE_RULES,emptyState}=context.module.exports;
const clone=x=>JSON.parse(JSON.stringify(x));

const state={
  世界:{名称:'测试世界',时间:'2026年9月13日上午',后台:emptyState(),因果轨道:{偏移记录:{}},势力:{},探索:{}},
  设置:{},系统状态:{是否在主神空间:false},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
state.世界.后台.事件={
  条件节点:{状态:'待发生',分类:'近期节点',时间:'待定',条件:'守军集结完成',前因:[]},
  前因节点:{状态:'待发生',分类:'近期节点',时间:'',条件:'',前因:['条件节点']},
  真缺失:{状态:'待发生',分类:'近期节点',时间:'未知',条件:'',前因:[]}
};
assert.equal(eventHasUsableSchedule(state.世界.后台.事件.条件节点),true,'有效条件应视为合法因果时间锚点');
assert.equal(eventHasUsableSchedule(state.世界.后台.事件.前因节点),true,'明确前因应视为合法因果时间锚点');
assert.equal(eventHasUsableSchedule(state.世界.后台.事件.真缺失),false,'没有日期/条件/前因的事件仍需维护');
assert.equal(JSON.stringify(unscheduledEvents(state).map(item=>item.名称)),JSON.stringify(['真缺失']),'扫描器不应把已有条件或前因的事件反复判成缺时');
assert.equal(JSON.stringify(ensureEventTimeAnchors(state,[{名称:'条件节点'},{名称:'前因节点'},{名称:'真缺失'}])),JSON.stringify(['真缺失']),'软验收只返回真正未排期事件，不应抛错');

const rumorRequired=rumorMaintenanceRequirements(state);
for(const category of ['街头巷议','情报交易','布告与檄文'])assert.equal(rumorRequired.公开传闻[category].为空补足,1,'空传闻分类只要求优先补1条');
let rumorIssues;
assert.doesNotThrow(()=>{rumorIssues=ensureRumorLiveliness(clone(state),rumorRequired);},'传闻未补齐不得再拒绝整轮结果');
assert.equal(rumorIssues.公开传闻.length,3,'未补齐分类仍应作为软维护项返回');
assert.match(SOFT_MAINTENANCE_RULES,/软维护不拒绝整轮/);
assert.match(SOFT_MAINTENANCE_RULES,/已经通过的片段沿用/);
console.log('PASS soft maintenance: causal event anchors accepted and rumor completeness no longer blocks the round');
