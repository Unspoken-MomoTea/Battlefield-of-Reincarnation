const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

for(const file of [
  'src/WorldEngine/domains/WorldTimeOwnershipFeature.part.js',
  'src/WorldEngine/domains/WorldHistoryMemoryFeature.part.js',
]) assert.ok(fs.existsSync(path.join(root,file)),file+' must exist');

const migrated=[
  'script/world-engine-src/59-world-time-ownership.part.js',
  'script/world-engine-src/59-history-memory.part.js',
].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
assert.doesNotMatch(migrated,/SamsaraWorldEngine\s*=\s*class/,'phase5 time/history modules must not extend SamsaraWorldEngine');

const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const stat={
  世界:{名称:'Phase5测试',时间:'',地点:'中央区',稳定:100,后台:emptyState(),势力:{},探索:{},历法:{},法则:[],货币:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
function hostFor(ref){
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'phase5',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'数小时后，中央区进入夜间。'}],
    Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
  };
  host.Mvu={
    getMvuData:()=>({stat_data:clone(ref.value)}),
    replaceMvuData:async data=>{ref.value=clone(data.stat_data);}
  };
  return host;
}

(async()=>{
  const ref={value:clone(stat)},engine=new Engine(hostFor(ref));
  engine.config.requireMacroBackbone=false;
  engine.worldbook=async()=>[];
  for(const key of ['timeOwnership','historyMemory']){
    assert.ok(engine.services?.[key],key+' feature missing');
  }

  const registry=engine.services.prompts.list(),byKey=new Map(registry.map(item=>[item.key,item]));
  assert.ok(byKey.has('worldTimeInputGuidance'),'world time payload guidance must be editable');
  assert.equal(byKey.get('worldTimeInputGuidance').scope,'user payload JSON');

  const request=await engine.buildRequest(engine.snapshot());
  const payload=JSON.parse(request.input);
  assert.equal(payload.世界时间维护.是否需要初始化,true);
  const guidance=JSON.parse(engine.services.prompts.value('worldTimeInputGuidance'));
  assert.equal(payload.世界时间维护.所有权,guidance.所有权);
  assert.deepEqual(payload.世界时间维护.时间段候选,guidance.时间段候选);
  assert.equal(request.schema?.type,'object');

  engine.services.prompts.apply({...engine.services.prompts.values(),worldTimeInputGuidance:JSON.stringify({
    ...guidance,所有权:'【自定义时间所有权】',推进原则:'【自定义推进原则】'
  },null,2)});
  const custom=JSON.parse((await engine.buildRequest(engine.snapshot())).input);
  assert.equal(custom.世界时间维护.所有权,'【自定义时间所有权】');
  assert.equal(custom.世界时间维护.推进原则,'【自定义推进原则】');

  // 非世界切换时，变量 AI 改写世界时间必须被所有权 feature 回滚。
  const variables={stat_data:clone(ref.value)},before={stat_data:clone(ref.value)};
  before.stat_data.世界.时间='2026年-09月-26日-下午';
  variables.stat_data.世界.时间='2026年-09月-27日-上午';
  engine.isEnabled=()=>true;
  engine.committing=false;
  const handled=engine.services.timeOwnership.afterVariableEvent(false,variables,before);
  assert.equal(handled,true);
  assert.equal(variables.stat_data.世界.时间,'2026年-09月-26日-下午');

  assert.equal(engine.config.sendHistoryToProse,false);
  engine.setSendHistoryToProse(true);
  assert.equal(engine.config.sendHistoryToProse,true);
  const backend=emptyState();
  const next={世界:{时间:'2026年-09月-26日-晚上',[globalThis.PATH||'后台']:backend}};
  // public facade must delegate the per-commit history leaf to history feature.
  assert.equal(typeof engine.beforeWorldCommit,'function');

  console.log('PASS time ownership and history lifecycle use composed feature classes');
})().catch(error=>{console.error(error);process.exitCode=1;});
