const assert=require('node:assert/strict');
const {SamsaraWorldEngine:Engine}=require('../script/世界推进系统.js');

const stored={
  enabled:true,
  tone:'legacy-parchment',
  preset:'自定义旧预设',
  presetEditorVersion:2,
  retryAttempts:3,
  retryDefaultFiveMigrated:false,
  requireMacroBackbone:false,
  fontScale:'oversized',
  sendHistoryToProse:'yes',
  builtinDefaultPromptVersionApplied:999,
  activePromptDocumentId:'custom-doc',
  promptDocuments:[
    {id:'custom-doc',type:'samsara-world-prompt-document',version:1,builtin:false,name:'自定义',settings:{preset:'自定义旧预设'}},
    {id:'broken',name:'坏文档',settings:{}}
  ],
  userDefaultPromptSettings:{
    preset:'个人旧默认',
    contextTurns:999,
    activationMode:'force_selected',
    selectedEntries:['["测试世界书","1"]']
  },
  dedicatedApi:{
    enabled:false,
    apiUrl:'  https://example.com/v1  ',
    apiKey:123,
    model:'  model-x  ',
    apiPresets:[{name:' P ',apiUrl:' url ',apiKey:'k',model:' m '}],
    fetchedModels:[1,'x']
  }
};
let persisted='',enableCalls=0;
const host={
  localStorage:{
    getItem:()=>JSON.stringify(stored),
    setItem:(_key,value)=>{persisted=String(value||'');}
  },
  Samsara:{terminal:{enableApi:()=>{enableCalls++;},apiReady:()=>true}},
  getCurrentChatId:()=> 'config-service-test',
  getChatMessages:()=>[],
  Mvu:{getMvuData:()=>({stat_data:{}}),replaceMvuData:async()=>{}},
  document:{addEventListener:()=>{},removeEventListener:()=>{}}
};

const engine=new Engine(host);

assert.equal(Object.hasOwn(engine.config,'tone'),false,'legacy tone must be removed during construction');
assert.equal(engine.config.retryAttempts,5,'legacy retry default 3 must migrate to 5');
assert.equal(engine.config.retryDefaultFiveMigrated,true,'retry migration marker must be persisted');
assert.equal(engine.config.requireMacroBackbone,false,'explicit macro-backbone preference must be preserved');
assert.equal(engine.config.fontScale,'standard','invalid font scale must normalize to standard');
assert.equal(engine.config.sendHistoryToProse,false,'history-to-prose must only accept literal true');
assert.deepEqual(engine.config.dedicatedApi,{
  enabled:false,
  apiUrl:'https://example.com/v1',
  apiKey:'123',
  model:'model-x',
  apiPresets:[{name:'P',apiUrl:'url',apiKey:'k',model:'m'}],
  fetchedModels:['1','x']
},'dedicated API settings must preserve the existing normalization contract');

assert.equal(engine.config.promptDocuments[0]?.builtin,true,'built-in prompt document must remain first');
assert.equal(engine.config.promptDocuments.some(doc=>doc.id==='broken'),false,'invalid prompt documents must be dropped');
assert.equal(engine.config.promptDocuments.some(doc=>doc.id==='custom-doc'),true,'valid custom prompt documents must survive migration');
const personal=engine.config.promptDocuments.find(doc=>doc.id==='user-default');
assert.ok(personal,'legacy user default settings must migrate to a personal prompt document');
assert.equal(personal.settings.contextTurns,100,'legacy context turns must retain the 1..100 clamp');
assert.equal(personal.settings.activationMode,'force_selected');
assert.deepEqual(personal.settings.selectedEntries,['["测试世界书","1"]']);

assert.equal(enableCalls,1,'enabled engine without dedicated API must still enable the terminal API');
assert.ok(persisted,'config migration must persist normalized state');
const saved=JSON.parse(persisted);
assert.equal(Object.hasOwn(saved,'tone'),false);
assert.equal(saved.retryAttempts,5);
assert.equal(saved.fontScale,'standard');

assert.equal(engine.configService?.constructor?.name,'WorldEngineConfigService');
assert.equal(engine.services?.configuration,engine.configService,'service container must expose the constructor-owned configuration service');

console.log('world-engine configuration migration regression tests passed');
