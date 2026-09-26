const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

for(const file of [
  'src/WorldEngine/domains/WorldTaskAwarenessFeature.part.js',
  'src/WorldEngine/domains/WorldChronologyFeature.part.js',
  'src/WorldEngine/domains/WorldRumorRequestFeature.part.js',
]) assert.ok(fs.existsSync(path.join(root,file)),file+' must exist');

const migrated=[
  'script/world-engine-src/57-task-awareness.part.js',
  'script/world-engine-src/58-chronology-guard.part.js',
  'script/world-engine-src/56-rumor-liveliness.part.js',
  'script/world-engine-src/59-rumor-throttle.part.js',
  'script/world-engine-src/59-rumor-world-request.part.js',
  'script/world-engine-src/59-rumor-world-system.part.js',
].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
assert.doesNotMatch(migrated,/SamsaraWorldEngine\s*=\s*class/,'phase4 request modules must not extend SamsaraWorldEngine');

const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const stat={
  世界:{名称:'Phase4测试',时间:'2026年-09月-26日-晚上',地点:'中央区',稳定:100,后台:emptyState(),势力:{},探索:{},历法:{},法则:[],货币:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{护送任务:{委托方:'商会',目标:'护送车队',状态:'进行中'}}},资产:{},关系列表:{},
  传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
function hostFor(){
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'phase4',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'中央区夜间仍在运转。'}],
    Mvu:{getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async()=>{}},
    Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
  };
  return host;
}

(async()=>{
  const engine=new Engine(hostFor());
  engine.config.requireMacroBackbone=false;
  engine.worldbook=async()=>[];
  for(const key of ['taskAwareness','chronology','rumorRequest']){
    assert.ok(engine.services?.[key],key+' feature missing');
    assert.equal(typeof engine.services[key].afterBuildRequest,'function');
  }
  const request=await engine.buildRequest(engine.snapshot());
  const payload=JSON.parse(request.input);
  assert.equal(request.manifest?.任务感知?.只读,true);
  assert.equal(request.manifest?.原著时间轴?.强制校准,true);
  assert.equal(request.manifest?.传闻节流?.正文直接取材,false);
  assert.ok(payload.时间线基准,'chronology feature must decorate input');
  assert.ok(payload.传闻维护,'rumor feature must decorate input');
  assert.equal(payload.传闻维护.取材边界,engine.services.prompts.value('rumorSourceBoundary'));
  assert.equal(payload.时间线基准.原著时间资料,engine.services.prompts.value('chronologyNoEvidenceGuidance'));
  const inputSemantics=JSON.parse(engine.services.prompts.value('inputSemantics'));
  assert.equal(inputSemantics.任务列表,'只读因果账本。事件可通过关联任务引用已存在任务；不得创建、删除、改状态、交付或结算任务。');

  console.log('PASS task chronology rumor request layers use composed feature classes');
})().catch(error=>{console.error(error);process.exitCode=1;});
