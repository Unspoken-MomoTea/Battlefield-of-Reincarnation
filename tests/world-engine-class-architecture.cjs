const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
for(const file of [
  'src/WorldEngine/README.md',
  'src/WorldEngine/ARCHITECTURE.md',
  'src/WorldEngine/core/WorldEngineServiceContainer.part.js',
  'src/WorldEngine/domains/WorldMutationService.part.js',
  'src/WorldEngine/domains/WorldEventService.part.js',
  'src/WorldEngine/domains/WorldPersonActivityService.part.js',
  'src/WorldEngine/prompts/WorldPromptRegistry.part.js',
]){
  assert.ok(fs.existsSync(path.join(root,file)),file+' must exist in the dedicated src/WorldEngine source tree');
}

const delivery=require('../script/世界推进系统.js');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS}=delivery;
const clone=value=>JSON.parse(JSON.stringify(value));

let current={
  stat_data:{
    世界:{名称:'测试世界',时间:'2026年09月26日-下午',地点:'北门',稳定:100,后台:emptyState(),势力:{},探索:{},历法:{},法则:[],货币:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
    系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  }
};
current.stat_data.世界.后台.事件.巡逻={
  ...clone(RECORDS.事件),分类:'当前事件',状态:'进行中',描述:'旧描述',时间:'2026年09月26日-下午',开始时间:'2026年09月26日-下午',更新时间:'2026年09月26日-下午',参与者:[],前因:[],关联任务:[],可见影响:[]
};
current.stat_data.世界.后台.人物.卫兵={
  ...clone(RECORDS.人物),所属世界:'测试世界',状态:'活跃',地点:'北门',目标:'巡逻',行动:'巡逻',认知:[],认知来源:[],关联事件:['巡逻'],公开动态:'巡逻中',更新时间:'2026年09月26日-下午',开始时间:'2026年09月26日-下午',行程:[],背景关联:[]
};

const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  getCurrentChatId:()=> 'class-architecture-test',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'北门仍在巡逻。'}],
  Mvu:{
    getMvuData:()=>clone(current),
    replaceMvuData:async data=>{current=clone(data);}
  },
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
  toastr:{error:()=>{}}
};
const engine=new Engine(host);

assert.ok(engine.services,'engine must expose a composed service container');
for(const name of ['mutations','events','people','history','exploration','rumor','requests','views','prompts']){
  assert.ok(engine.services[name],`service container must expose ${name}`);
}
assert.equal(engine.services.constructor.name,'WorldEngineServiceContainer');
assert.equal(engine.services.mutations.constructor.name,'WorldMutationService');
assert.equal(engine.services.events.constructor.name,'WorldEventService');
assert.equal(engine.services.people.constructor.name,'WorldPersonActivityService');
assert.equal(engine.services.prompts.constructor.name,'WorldPromptRegistry');
assert.equal(engine.services.views.constructor.name,'WorldEngineViewRegistry');

const expectedPromptKeys=[
  'preset','core','macro','stability','npcAudit','outputProtocol',
  'task','chronology','maintenance','exploration','integrity','worldTime','rumor',
  'worldActivity','historyMemory'
];
const promptKeys=engine.services.prompts.list().map(item=>item.key);
for(const key of expectedPromptKeys)assert.ok(promptKeys.includes(key),'prompt registry must expose '+key);
assert.equal(new Set(promptKeys).size,promptKeys.length,'prompt registry keys must be unique');

const promptUi=[
  'script/world-engine-src/ui/60-prompt-tab.part.js',
  'src/WorldEngine/prompts/WorldPromptRegistry.part.js',
].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
assert.match(promptUi,/data-prompt-registry/,'prompt workspace must render registry-backed prompt fields');
assert.match(promptUi,/全部实际提示词/,'prompt workspace must present one discoverable all-prompts section');

const registrySource=fs.readFileSync(path.join(root,'src/WorldEngine/prompts/WorldPromptRegistry.part.js'),'utf8');
for(const promptSource of [
  'TASK_AWARENESS_RULES','CHRONOLOGY_GUARD_RULES','SOFT_MAINTENANCE_RULES','EXPLORATION_PROJECTION_RULES',
  'WORLD_INTEGRITY_GUARD_RULES','WORLD_TIME_RULES','RUMOR_LIVELINESS_RULES','RUMOR_THROTTLE_RULES',
  'RUMOR_WORLD_SOURCE_RULES','WORLD_ACTIVITY_DELIVERY_RULES','NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT','HISTORY_MEMORY_SYSTEM'
]){
  assert.ok(registrySource.includes(promptSource),`every file-level AI prompt must be discoverable from the registry: ${promptSource}`);
}

(async()=>{
  await engine.services.events.save('巡逻','修正巡逻',{
    ...clone(current.stat_data.世界.后台.事件.巡逻),
    描述:'已由领域服务修正'
  });
  assert.equal(current.stat_data.世界.后台.事件.巡逻,undefined);
  assert.equal(current.stat_data.世界.后台.事件.修正巡逻.描述,'已由领域服务修正');
  assert.deepEqual(current.stat_data.世界.后台.人物.卫兵.关联事件,['修正巡逻']);

  await engine.services.people.save('卫兵',{
    ...clone(current.stat_data.世界.后台.人物.卫兵),
    地点:'南门',行动:'转移到南门继续巡逻'
  });
  assert.equal(current.stat_data.世界.后台.人物.卫兵.地点,'南门');

  const values=engine.services.prompts.values();
  values.worldActivity='【自定义世界活动】\n只用于测试注册表覆盖。';
  values.historyMemory='【自定义历史压缩】\n只压缩既有事实。';
  engine.applyPromptSettings({promptRegistry:values});
  assert.equal(engine.services.prompts.value('worldActivity'),'【自定义世界活动】\n只用于测试注册表覆盖。');
  assert.equal(engine.services.prompts.value('historyMemory'),'【自定义历史压缩】\n只压缩既有事实。');

  console.log('PASS world engine uses composed domain classes and exposes every system prompt through one registry');
})().catch(error=>{console.error(error);process.exitCode=1;});
