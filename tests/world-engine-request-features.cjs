const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

for(const file of [
  'src/WorldEngine/domains/WorldRequestFeature.part.js',
  'src/WorldEngine/domains/WorldSoftMaintenanceFeature.part.js',
  'src/WorldEngine/domains/WorldIntegrityRequestFeature.part.js',
  'src/WorldEngine/domains/WorldActivityRequestFeature.part.js',
  'src/WorldEngine/domains/WorldDueEventFeature.part.js',
]) assert.ok(fs.existsSync(path.join(root,file)),file+' must exist');

const migrated=[
  'script/world-engine-src/59-soft-maintenance.part.js',
  'script/world-engine-src/59-world-integrity-guard.part.js',
  'script/world-engine-src/59-world-activity-delivery.part.js',
  'script/world-engine-src/59-due-event-relaxation.part.js',
].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
assert.doesNotMatch(migrated,/SamsaraWorldEngine\s*=\s*class/,'request-feature modules must not add engine inheritance layers');

const {SamsaraWorldEngine:Engine,emptyState,RECORDS}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const backend=emptyState();
backend.事件.到期节点={...clone(RECORDS.事件),分类:'近期节点',状态:'待发生',时间:'2026年-09月-26日-上午',下次检查:'',条件:'仍需观察',前因:[]};
const stat={
  世界:{名称:'请求类化测试',时间:'2026年-09月-26日-晚上',地点:'中央区',稳定:100,后台:backend,势力:{},探索:{},历法:{},法则:[],货币:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  getCurrentChatId:()=> 'request-features',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'中央区仍在运行。'}],
  Mvu:{getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async()=>{}},
  Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
};
(async()=>{
  const engine=new Engine(host);
  engine.config.requireMacroBackbone=false;
  engine.worldbook=async()=>[];
  for(const key of ['softMaintenance','integrityRequest','worldActivityRequest','dueEvent']){
    assert.ok(engine.services?.[key],key+' request feature missing');
    assert.equal(typeof engine.services[key].afterBuildRequest,'function');
  }
  const request=await engine.buildRequest(engine.snapshot());
  const payload=JSON.parse(request.input);
  assert.equal(payload.验收策略?.模式,'分级验收','soft maintenance feature must still decorate request payload');
  assert.ok(plainObject(payload.本轮世界活动交付),'world activity feature must still provide delivery requirements');
  assert.ok(Array.isArray(payload.本轮必须复核的到期事件),'due-event feature must still provide review list');
  assert.ok(payload.本轮必须复核的到期事件.some(item=>item.名称==='到期节点'),'due event must survive class migration');
  assert.equal(request.manifest?.因果与时间约束?.启用,true,'integrity feature must keep request manifest metadata');
  assert.equal(request.manifest?.验收策略?.模式,'分级验收');
  assert.ok(request.timeline?.世界活动要求,'world activity requirement must remain attached to timeline');
  console.log('PASS request decorators use composed feature classes without engine inheritance');
})().catch(error=>{console.error(error);process.exitCode=1;});

function plainObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
