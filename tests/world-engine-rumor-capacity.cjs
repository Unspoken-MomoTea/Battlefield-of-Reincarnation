const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../script/世界推进系统.js'),'utf8');
const context={module:{exports:{}},console,setTimeout,clearTimeout,AbortController};
vm.runInNewContext(source.replace('module.exports = {','module.exports = {stageWorldResult,'),context);
const {stageWorldResult,emptyState,normalizeWorldResult,compileWorldResult,applyPatches,SamsaraWorldEngine:Engine}=context.module.exports;
for(const schema of Object.values(context.module.exports.WORLD_RESULT_SCHEMA.properties.传闻.properties))assert.ok(schema.maxItems>=6,'structured output must allow three additions and three removals');
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
assert.equal(normalizeWorldResult(result).传闻.街头巷议.length,6,'must preserve removals after three additions');
const staged=stageWorldResult(stat,null,result,clone);
assert.equal(staged.rejected.length,0,JSON.stringify(staged.rejected));
const next=applyPatches(stat,compileWorldResult(stat,staged.accepted).patches);
for(const category of categories)assert.deepEqual(Object.keys(next.传闻[category]),['新1','新2','新3']);
assert.deepEqual(Object.keys(stat.传闻.街头巷议),['旧1','旧2','旧3'],'no in-place mutation');
const overflow=stageWorldResult(stat,null,{传闻:{街头巷议:[{名称:'第四条',操作:'更新',...records.街头巷议}]}},clone);
assert.equal(overflow.rejected.length,1);
assert.match(overflow.rejected[0].原因,/街头巷议合并后有4条/);
assert.match(overflow.rejected[0].原因,/移除至少1条/);
const repair=stageWorldResult(stat,overflow.accepted,{传闻:{街头巷议:[{名称:'第四条',操作:'更新',...records.街头巷议},{名称:'旧1',操作:'移除'}]}},clone);
assert.equal(repair.rejected.length,0);
function engine(config){let saved;const host={localStorage:{getItem:()=>JSON.stringify(config),setItem:(_,value)=>{saved=JSON.parse(value);}}};return {value:new Engine(host),saved:()=>saved};}
assert.equal(engine({}).value.config.retryAttempts,5);
const migrated=engine({retryAttempts:3});assert.equal(migrated.value.config.retryAttempts,5);assert.equal(migrated.saved().retryDefaultFiveMigrated,true);
assert.equal(engine({retryAttempts:2}).value.config.retryAttempts,2);
assert.equal(engine({retryAttempts:3,retryDefaultFiveMigrated:true}).value.config.retryAttempts,3);
console.log('PASS rumor replacement across all categories, removal retention, capacity rejection/repair and default retry migration');
