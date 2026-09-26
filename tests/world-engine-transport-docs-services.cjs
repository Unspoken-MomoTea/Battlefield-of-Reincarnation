const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const {SamsaraWorldEngine:Engine,emptyState}=require(path.join(root,'script','世界推进系统.js'));

const store={};
const host={
  localStorage:{getItem:key=>store[key]||null,setItem:(key,value)=>{store[key]=value;}},
  SillyTavern:{name1:'测试玩家'},
  Samsara:{terminal:{apiReady:()=>true,request:async()=> 'terminal-ok'}},
  getCurrentChatId:()=> 'transport-docs',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'世界正常运转。'}],
  document:{addEventListener:()=>{},removeEventListener:()=>{},createElement:()=>({style:{},click(){},remove(){}}),body:{appendChild:()=>{}}},
  Blob:globalThis.Blob,
  URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}}
};
const stat={世界:{名称:'测试世界',时间:'2026年09月27日-上午',地点:'测试地',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},货币:{},历法:{},法则:[]},系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}};
host.Mvu={getMvuData:()=>({stat_data:JSON.parse(JSON.stringify(stat))}),replaceMvuData:async()=>{}};

const engine=new Engine(host);
assert.equal(engine.services.transport?.constructor?.name,'WorldApiTransportService');
assert.equal(engine.services.promptDocuments?.constructor?.name,'WorldPromptDocumentService');

engine.setDedicatedApi({enabled:true,apiUrl:'https://example.invalid/v1',apiKey:'k',model:'m'});
assert.equal(engine.usesDedicatedApi(),true);
assert.equal(engine.dedicatedApiReady(),true);
assert.equal(engine.dedicatedEndpoint('chat'),'https://example.invalid/v1/chat/completions');
assert.equal(engine.dedicatedEndpoint('models'),'https://example.invalid/v1/models');
engine.saveDedicatedApiPreset('测试API');
engine.setDedicatedApi({apiUrl:'https://other.invalid/v1',model:'other'});
engine.applyDedicatedApiPreset('测试API');
assert.equal(engine.config.dedicatedApi.apiUrl,'https://example.invalid/v1');
assert.equal(engine.config.dedicatedApi.model,'m');

engine.config.promptDocuments=[];
const prepared=engine.services.prompts.prepareSettings({
  preset:engine.config.preset,
  corePrompt:engine.config.corePrompt,
  macroPrompt:engine.config.macroPrompt,
  stabilityPromptTemplate:engine.config.stabilityPromptTemplate,
  npcAuditPrompt:engine.config.npcAuditPrompt,
  structurePrompt:engine.config.structurePrompt,
  contextTurns:1,activationMode:'respect_activation',selectedEntries:[]
});
const doc=engine.savePromptDocument('运行时服务测试',prepared,false);
assert.equal(doc.name,'运行时服务测试');
assert.ok(doc.settings.promptRegistry,'prompt document service must persist full prompt registry');
assert.equal(engine.getPromptDocuments().some(item=>item.id===doc.id),true);
assert.equal(engine.deletePromptDocument(doc.id),true);

for(const file of [
  'src/WorldEngine/domains/WorldApiTransportService.part.js',
  'src/WorldEngine/domains/WorldPromptDocumentService.part.js'
])assert.ok(fs.existsSync(path.join(root,file)),file+' must exist');

const runtime=fs.readFileSync(path.join(root,'script','world-engine-src','40-engine-runtime.part.js'),'utf8');
assert.match(runtime,/WorldApiTransportService/,'runtime must initialize/delegate API transport service');
const container=fs.readFileSync(path.join(root,'src','WorldEngine','core','WorldEngineServiceContainer.part.js'),'utf8');
assert.match(container,/this\.transport=/);
assert.match(container,/this\.promptDocuments=/);

console.log('PASS dedicated API transport and prompt document persistence use class services');
