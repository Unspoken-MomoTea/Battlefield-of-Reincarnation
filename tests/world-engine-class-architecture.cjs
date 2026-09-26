const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const delivery=path.join(root,'script','世界推进系统.js');
const {SamsaraWorldEngine:Engine,emptyState}=require(delivery);

for(const file of [
  'src/WorldEngine/docs/ARCHITECTURE.md',
  'src/WorldEngine/docs/PROMPT-REGISTRY.md',
  'src/WorldEngine/docs/REFACTOR-PLAN.md'
]){
  assert.ok(fs.existsSync(path.join(root,file)),file+' must exist as the world-engine refactor source of truth');
}

const classSources=[
  'script/world-engine-src/core/10-view-registry.part.js',
  'script/world-engine-src/editor/00-world-mutations.part.js',
  'script/world-engine-src/editor/10-event-editor.part.js',
  'script/world-engine-src/editor/20-person-editor.part.js',
  'script/world-engine-src/prompts/10-prompt-registry.part.js',
].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');

for(const name of [
  'WorldEngineViewRegistry',
  'WorldMutationService',
  'WorldEventEditor',
  'WorldPersonEditor',
  'WorldPromptRegistry'
]){
  assert.match(classSources,new RegExp('class\\s+'+name+'\\b'),name+' must be a real class');
}

const stat={
  世界:{名称:'测试世界',时间:'2026年09月26日-中午',地点:'中央区',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},货币:{},历法:{},法则:[]},
  系统状态:{是否在主神空间:false},设置:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}},资产:{},任务:{列表:{}}
};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  SillyTavern:{name1:'测试玩家'},
  Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
  getCurrentChatId:()=> 'class-architecture',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'世界仍在正常运转。'}],
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
};
host.Mvu={getMvuData:()=>({stat_data:JSON.parse(JSON.stringify(stat))}),replaceMvuData:async()=>{}};

const engine=new Engine(host);
assert.ok(engine.services&&typeof engine.services==='object','engine must expose composed services');
assert.equal(engine.services.views?.constructor?.name,'WorldEngineViewRegistry');
assert.equal(engine.services.mutations?.constructor?.name,'WorldMutationService');
assert.equal(engine.services.eventEditor?.constructor?.name,'WorldEventEditor');
assert.equal(engine.services.personEditor?.constructor?.name,'WorldPersonEditor');
assert.equal(engine.services.prompts?.constructor?.name,'WorldPromptRegistry');

assert.equal(typeof engine.setWorldEventRecord,'function','legacy/public event edit facade must remain');
assert.equal(typeof engine.setWorldPersonRecord,'function','legacy/public person edit facade must remain');
assert.equal(typeof engine.services.views.render,'function');
assert.equal(typeof engine.services.prompts.describe,'function');

console.log('PASS world engine uses composed class services and has refactor docs');
