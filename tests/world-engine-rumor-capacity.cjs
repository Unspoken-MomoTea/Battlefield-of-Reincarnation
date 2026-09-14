const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../script/世界推进系统.js'),'utf8');
const context={module:{exports:{}},console,setTimeout,clearTimeout,AbortController};
vm.runInNewContext(source.replace('module.exports = {','module.exports = {stageWorldResult,validateState,rumorMaintenanceRequirements,RUMOR_THROTTLE_RULES,'),context);
const {stageWorldResult,validateState,rumorMaintenanceRequirements,RUMOR_THROTTLE_RULES,emptyState,normalizeWorldResult,compileWorldResult,applyPatches,SamsaraWorldEngine:Engine}=context.module.exports;
for(const schema of Object.values(context.module.exports.WORLD_RESULT_SCHEMA.properties.传闻.properties))assert.ok(schema.maxItems>=6,'structured output must allow multi-rumor updates in one round');
const clone=x=>JSON.parse(JSON.stringify(x));
const categories=['街头巷议','情报交易','布告与檄文'];
const records={街头巷议:{来源:'居民',内容:'旧消息',可信度:'可疑'},情报交易:{卖家:'商人',情报评级:'F',摘要:'旧情报',要价:'10铜币',真实内幕:'真实情况'},布告与檄文:{发布者:'市政厅',内容:'旧公告',张贴位置:'街口'}};
const stat={世界:{名称:'测试世界',时间:'2026年9月13日清晨',后台:emptyState(),势力:{},探索:{},因果轨道:{偏移记录:{}}},系统状态:{是否在主神空间:false},设置:{},传闻:{}};
for(const category of categories)stat.传闻[category]=Object.fromEntries([1,2,3].map(i=>['旧'+i,{...records[category],内容:'旧消息'+i}]));
const result={摘要:'全量换新',传闻:{}};
for(const category of categories)result.传闻[category]=[
    ...[1,2,3].map(i=>({名称:'新'+i,操作:'更新',...records[category],内容:'新消息'+i})),
    ...[1,2,3].map(i=>({名称:'旧'+i,操作:'移除'}))
];
assert.equal(normalizeWorldResult(result).传闻.街头巷议.length,6,'must preserve explicit removals after additions');
const staged=stageWorldResult(stat,null,result,clone);
assert.equal(staged.rejected.length,0,JSON.stringify(staged.rejected));
const next=applyPatches(stat,compileWorldResult(stat,staged.accepted).patches);
for(const category of categories)assert.deepEqual(Object.keys(next.传闻[category]),['新1','新2','新3']);
assert.deepEqual(Object.keys(stat.传闻.街头巷议),['旧1','旧2','旧3'],'no in-place mutation');

const overflow=stageWorldResult(stat,null,{传闻:{街头巷议:[{名称:'第四条',操作:'更新',...records.街头巷议,内容:'第四条新消息'}]}},clone);
assert.equal(overflow.rejected.length,0,JSON.stringify(overflow.rejected));
const overflowNext=applyPatches(stat,compileWorldResult(stat,overflow.accepted).patches);
assert.deepEqual(Object.keys(overflowNext.传闻.街头巷议),['旧2','旧3','第四条'],'fourth rumor must evict the oldest instead of being rejected');

const refreshed=stageWorldResult(stat,null,{传闻:{街头巷议:[
    {名称:'旧1',操作:'更新',...records.街头巷议,内容:'旧1得到新进展'},
    {名称:'第四条',操作:'更新',...records.街头巷议,内容:'第四条新消息'}
]}},clone);
assert.equal(refreshed.rejected.length,0,JSON.stringify(refreshed.rejected));
const refreshedNext=applyPatches(stat,compileWorldResult(stat,refreshed.accepted).patches);
assert.deepEqual(Object.keys(refreshedNext.传闻.街头巷议),['旧3','旧1','第四条'],'same-name update must refresh recency before rolling eviction');
assert.equal(refreshedNext.传闻.街头巷议.旧1.内容,'旧1得到新进展');

const emptyStat=clone(stat);emptyStat.传闻.街头巷议={};
const burst=stageWorldResult(emptyStat,null,{传闻:{街头巷议:[1,2,3,4].map(i=>({名称:'突发'+i,操作:'更新',...records.街头巷议,内容:'突发消息'+i}))}},clone);
assert.equal(burst.rejected.length,0,JSON.stringify(burst.rejected));
const burstNext=applyPatches(emptyStat,compileWorldResult(emptyStat,burst.accepted).patches);
assert.deepEqual(Object.keys(burstNext.传闻.街头巷议),['突发2','突发3','突发4'],'a burst over capacity keeps the latest three without retry');

const quietMaintenance=rumorMaintenanceRequirements(stat);
assert.equal(quietMaintenance.本轮公开传闻动作,'保持不变','已有传闻且没有新的公开事实时不得每轮主动刷新');
assert.deepEqual(JSON.parse(JSON.stringify(quietMaintenance.刷新原因)),[],'无触发时不应制造传闻刷新原因');
const emptyMaintenance=rumorMaintenanceRequirements(emptyStat);
assert.match(emptyMaintenance.本轮公开传闻动作,/按需更新/,'空分类才进入按需刷新');
assert.equal(emptyMaintenance.公开传闻.街头巷议.为空补足,1,'空分类只补1条，避免为了凑满反复调用');
assert.ok(emptyMaintenance.刷新原因.some(reason=>reason.includes('街头巷议')),'刷新原因应明确指出空分类');

const malformedRumor=stageWorldResult(stat,null,{传闻:{街头巷议:[{名称:'格式错误的传闻',操作:'更新',来源:'居民',内容:'一条格式错误的测试传闻',可信度:'完全可信'}]}},validateState);
assert.equal(malformedRumor.rejected.length,0,'单个传闻片段失败属于软失败，不得触发整轮重试');
assert.equal(malformedRumor.softRejected?.length,1,'被丢弃的传闻片段仍应保留诊断信息');
assert.match(malformedRumor.softRejected[0].片段,/^传闻\//);

const hardFailure=stageWorldResult(stat,null,{事件:[{名称:'缺失时间事件',操作:'更新',描述:'测试硬错误',状态:'进行中',分类:'当前事件'}]},validateState);
assert.equal(hardFailure.rejected.length,1,'真正的结构/业务硬错误仍必须保留为重试对象');
assert.match(hardFailure.rejected[0].片段,/^事件\//);
assert.match(RUMOR_THROTTLE_RULES,/公开传闻默认保持不变/);
assert.match(RUMOR_THROTTLE_RULES,/不得仅为传闻\/传播重新调用整轮世界推进/);

function engine(config){let saved;const host={localStorage:{getItem:()=>JSON.stringify(config),setItem:(_,value)=>{saved=JSON.parse(value);}}};return {value:new Engine(host),saved:()=>saved};}
assert.equal(engine({}).value.config.retryAttempts,5);
const migrated=engine({retryAttempts:3});assert.equal(migrated.value.config.retryAttempts,5);assert.equal(migrated.saved().retryDefaultFiveMigrated,true);
assert.equal(engine({retryAttempts:2}).value.config.retryAttempts,2);
assert.equal(engine({retryAttempts:3,retryDefaultFiveMigrated:true}).value.config.retryAttempts,3);
console.log('PASS rumor rolling, on-demand refresh throttling, soft rumor failures, hard-error retries and default retry migration');
