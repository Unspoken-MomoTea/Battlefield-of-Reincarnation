const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

for(const file of [
  'src/WorldEngine/core/WorldEngineFeatureRegistry.part.js',
  'src/WorldEngine/ui/WorldApiPresetController.part.js',
  'src/WorldEngine/ui/WorldCausalOverviewController.part.js',
]){
  assert.ok(fs.existsSync(path.join(root,file)),file+' must exist');
}

const migrated=[
  'script/world-engine-src/55-npc-narrative-audit.part.js',
  'script/world-engine-src/59-api-preset-selection.part.js',
  'script/world-engine-src/59-causal-overview-ui.part.js',
  'script/world-engine-src/59-editable-module-prompts.part.js',
].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
assert.doesNotMatch(migrated,/SamsaraWorldEngine\s*=\s*class/,'phase3 migrated features must not extend SamsaraWorldEngine');

const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const stat={
  世界:{名称:'Phase3测试',时间:'2026年09月26日-晚上',地点:'中央区',稳定:100,后台:emptyState(),势力:{},探索:{},历法:{},法则:[],货币:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  getCurrentChatId:()=> 'phase3',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'中央区仍在运行。'}],
  Mvu:{getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async()=>{}},
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
};
const engine=new Engine(host);
for(const key of ['features','apiPreset','causalOverview']){
  assert.ok(engine.services?.[key],key+' service/controller missing');
}
assert.equal(engine.services.features.constructor.name,'WorldEngineFeatureRegistry');
assert.equal(engine.services.apiPreset.constructor.name,'WorldApiPresetController');
assert.equal(engine.services.causalOverview.constructor.name,'WorldCausalOverviewController');

const legacyCount=fs.readdirSync(path.join(root,'script','world-engine-src'))
  .filter(name=>name.endsWith('.part.js'))
  .map(name=>fs.readFileSync(path.join(root,'script','world-engine-src',name),'utf8'))
  .join('\n').match(/SamsaraWorldEngine\s*=\s*class/g)?.length||0;
assert.ok(legacyCount<=17,'phase3 should remove at least four legacy inheritance layers; remaining='+legacyCount);

console.log('PASS world engine phase3 removes API/causal/NPC/prompt inheritance layers');
