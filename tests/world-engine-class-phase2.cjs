const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const delivery=require(path.join(root,'script','世界推进系统.js'));
const {SamsaraWorldEngine:Engine,emptyState}=delivery;
const clone=value=>JSON.parse(JSON.stringify(value));

for(const file of [
  'src/WorldEngine/PROMPT-REGISTRY.md',
  'src/WorldEngine/REFACTOR-PLAN.md',
  'src/WorldEngine/ui/WorldEditorController.part.js',
  'src/WorldEngine/domains/WorldCausalService.part.js',
]){
  assert.ok(fs.existsSync(path.join(root,file)),file+' must exist');
}

const legacyEditors=[
  'script/world-engine-src/editor/00-world-mutations.part.js',
  'script/world-engine-src/editor/10-event-editor.part.js',
  'script/world-engine-src/editor/20-person-editor.part.js',
  'script/world-engine-src/59-causal-offset-editor.part.js',
  'script/world-engine-src/59-history-memory-editor.part.js',
].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
assert.doesNotMatch(legacyEditors,/SamsaraWorldEngine\s*=\s*class/,'manual editor modules must not create more SamsaraWorldEngine inheritance layers');

const stat={
  世界:{名称:'类化测试世界',时间:'2026年09月26日-晚上',地点:'中央区',稳定:100,后台:emptyState(),势力:{},探索:{},历法:{},法则:[],货币:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  getCurrentChatId:()=> 'class-phase2',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'中央区仍在运行。'}],
  Mvu:{getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async()=>{}},
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
};
const engine=new Engine(host);
for(const name of ['causal','editorController'])assert.ok(engine.services?.[name],name+' service/controller missing');
assert.equal(engine.services.causal.constructor.name,'WorldCausalService');
assert.equal(engine.services.editorController.constructor.name,'WorldEditorController');

const registry=engine.services.prompts.list();
const byKey=new Map(registry.map(item=>[item.key,item]));
for(const key of ['retryAcceptedWithPlan','retryAccepted','retryFresh']){
  assert.ok(byKey.has(key),'retry prompt must be editable through registry: '+key);
}
for(const item of registry){
  assert.equal(typeof item.condition,'string','prompt condition missing: '+item.key);
  assert.equal(typeof item.scope,'string','prompt scope missing: '+item.key);
  assert.equal(typeof item.value,'string','prompt value missing: '+item.key);
}

const workspace=fs.readFileSync(path.join(root,'src/WorldEngine/ui/WorldPromptWorkspaceController.part.js'),'utf8');
assert.match(workspace,/发送条件/,'prompt UI must show send condition');
assert.match(workspace,/作用范围/,'prompt UI must show prompt scope');

console.log('PASS world engine class phase2: editor controllers + complete prompt metadata');
