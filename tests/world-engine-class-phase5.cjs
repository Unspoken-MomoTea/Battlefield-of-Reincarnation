const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

for(const file of [
  'src/WorldEngine/runtime/WorldAutoProgressFeature.part.js',
  'src/WorldEngine/runtime/WorldReplayService.part.js',
  'src/WorldEngine/runtime/WorldTimeOwnershipFeature.part.js',
  'src/WorldEngine/runtime/WorldNpcAuditPolicyFeature.part.js',
  'src/WorldEngine/runtime/WorldHistoryMemoryFeature.part.js',
]) assert.ok(fs.existsSync(path.join(root,file)),file+' must exist');

const migrated=[
  'script/world-engine-src/59-auto-progress.part.js',
  'script/world-engine-src/59-auto-trigger-rebuild.part.js',
  'script/world-engine-src/59-world-replay-persistence.part.js',
  'script/world-engine-src/59-reprocess-immediate-retry.part.js',
  'script/world-engine-src/59-world-time-ownership.part.js',
  'script/world-engine-src/55-policy-compat.part.js',
  'script/world-engine-src/59-history-memory.part.js',
].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');

assert.doesNotMatch(migrated,/SamsaraWorldEngine\s*=\s*class/,'phase5 runtime modules must not extend SamsaraWorldEngine');

const delivery=require('../script/世界推进系统.js');
const {SamsaraWorldEngine:Engine,emptyState}=delivery;
const clone=value=>JSON.parse(JSON.stringify(value));
const stat={
  世界:{名称:'Phase5测试',时间:'2026年-09月-26日-晚上',地点:'中央区',稳定:100,后台:emptyState(),势力:{},探索:{},历法:{},法则:[],货币:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
  系统状态:{是否在主神空间:false,是否战斗中:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
function hostFor(){
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'phase5',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'中央区夜间仍在运转。'}],
    Mvu:{getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async()=>{}},
    Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
  };
  return host;
}

const engine=new Engine(hostFor());
for(const key of ['autoProgress','replay','worldTimeOwnership','npcAuditPolicy','historyMemory']){
  assert.ok(engine.services?.[key],key+' service missing');
}
assert.equal(engine.services.autoProgress.constructor.name,'WorldAutoProgressFeature');
assert.equal(engine.services.replay.constructor.name,'WorldReplayService');
assert.equal(engine.services.worldTimeOwnership.constructor.name,'WorldTimeOwnershipFeature');
assert.equal(engine.services.npcAuditPolicy.constructor.name,'WorldNpcAuditPolicyFeature');
assert.equal(engine.services.historyMemory.constructor.name,'WorldHistoryMemoryFeature');

const featureClasses=new Set(engine.services.features.describe().map(item=>item.className));
for(const className of [
  'WorldAutoProgressFeature',
  'WorldReplayService',
  'WorldTimeOwnershipFeature',
  'WorldNpcAuditPolicyFeature',
  'WorldHistoryMemoryFeature'
]) assert.ok(featureClasses.has(className),className+' must be registered in FeatureRegistry');

assert.equal(engine.blocked({...engine.snapshot(),stat:{...clone(stat),系统状态:{是否战斗中:true}}}),'战斗中，世界推进暂停');
assert.equal(typeof engine.worldReplayCurrentMessage,'function');
assert.equal(typeof engine.requestHistoryMemorySummary,'function');
assert.equal(typeof engine.maintainHistoryMemory,'function');
assert.equal(typeof engine.autoProgressShouldSchedule,'function');

console.log('PASS phase5 high-state runtime capabilities use composed classes');
