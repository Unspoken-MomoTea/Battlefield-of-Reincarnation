const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

for(const file of [
  'src/WorldEngine/domains/WorldAutoProgressController.part.js',
  'src/WorldEngine/domains/WorldReplayService.part.js',
  'src/WorldEngine/domains/WorldTimeOwnershipFeature.part.js',
  'src/WorldEngine/domains/WorldNpcAuditPolicy.part.js',
  'src/WorldEngine/domains/WorldHistoryLifecycle.part.js',
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
assert.doesNotMatch(migrated,/SamsaraWorldEngine\s*=\s*class/,'phase5 stateful modules must not extend SamsaraWorldEngine');

const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));
let state={
  世界:{名称:'Phase5测试',时间:'2026年-09月-26日-晚上',地点:'中央区',稳定:100,后台:emptyState(),势力:{},探索:{},历法:{},法则:[],货币:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
  系统状态:{是否在主神空间:false,是否战斗中:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  getCurrentChatId:()=> 'phase5',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'中央区夜间仍在运转。'}],
  Mvu:{getMvuData:()=>({stat_data:clone(state)}),replaceMvuData:async data=>{state=clone(data.stat_data);}},
  Samsara:{terminal:{apiReady:()=>true,request:async()=>''},validateWorldState:x=>x},
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
};
const engine=new Engine(host);
for(const key of ['autoProgress','replay','timeOwnership','npcAuditPolicy','historyLifecycle']){
  assert.ok(engine.services?.[key],key+' service/feature missing');
}
assert.equal(engine.services.autoProgress.constructor.name,'WorldAutoProgressController');
assert.equal(engine.services.replay.constructor.name,'WorldReplayService');
assert.equal(engine.services.timeOwnership.constructor.name,'WorldTimeOwnershipFeature');
assert.equal(engine.services.npcAuditPolicy.constructor.name,'WorldNpcAuditPolicy');
assert.equal(engine.services.historyLifecycle.constructor.name,'WorldHistoryLifecycle');

engine.config.autoProgressInterval=99;
assert.equal(engine.services.autoProgress.interval(),20,'auto-progress class owns interval normalization');
engine.config.autoProgressInterval=0;
assert.equal(engine.services.autoProgress.interval(),1);

const before=clone(state),after=clone(state);
after.世界.地点='南门';
after.世界.后台.事件.测试事件={分类:'当前事件',状态:'进行中',描述:'测试',时间:'2026年-09月-26日-晚上',地点:'南门',参与者:[],前因:[],关联任务:[],可见影响:[]};
const replay=engine.services.replay.buildPackage(before,after,'fp');
assert.ok(replay&&Array.isArray(replay.operations)&&replay.operations.length>0,'replay service must build recovery package');
const restored=clone(before);
assert.equal(engine.services.replay.applyPackage(restored,replay),true);
assert.equal(restored.世界.地点,'南门');
assert.ok(restored.世界.后台.事件.测试事件);

const blockedBase=engine.blocked(engine.snapshot());
assert.equal(blockedBase,'');
state.系统状态.是否战斗中=true;
assert.match(engine.blocked(engine.snapshot()),/战斗中/,'auto-progress controller must own combat pause policy');
state.系统状态.是否战斗中=false;

assert.equal(typeof engine.syncNpcBuildAuditFeature,'function');
assert.equal(typeof engine.requestHistoryMemorySummary,'function');
assert.equal(typeof engine.handleWorldReplayVariableEvent,'function');

console.log('PASS phase5 stateful lifecycle and replay logic use composed classes');
