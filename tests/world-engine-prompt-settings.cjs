const assert=require('node:assert/strict');

const {SamsaraWorldEngine:Engine}=require('../script/世界推进系统.js');

const store={};
const host={
  localStorage:{getItem:key=>store[key]||null,setItem:(key,value)=>{store[key]=String(value);}},
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
  Samsara:{terminal:{apiReady:()=>false}}
};
const engine=new Engine(host);

engine.setPreset('【测试预设】\n只保留这段');
assert.equal(engine.config.preset,'【测试预设】\n只保留这段');
assert.equal(engine.config.presetEditorVersion,2);
assert.equal(JSON.parse(store['samsara_world_engine_v1']||'{}').preset,'【测试预设】\n只保留这段');

const result=engine.applyPromptSettings({
  preset:'【应用设置】\n正文',
  corePrompt:'核心',
  macroPrompt:'宏观',
  stabilityPromptTemplate:'稳定',
  npcAuditPrompt:'审计',
  structurePrompt:'结构',
  contextTurns:999,
  activationMode:'force_selected',
  selectedEntries:['a',7,'b']
});
assert.equal(result,engine.config);
assert.equal(engine.config.preset,'【应用设置】\n正文');
assert.equal(engine.config.corePrompt,'核心');
assert.equal(engine.config.macroPrompt,'宏观');
assert.equal(engine.config.stabilityPromptTemplate,'稳定');
assert.equal(engine.config.npcAuditPrompt,'审计');
assert.equal(engine.config.structurePrompt,'结构');
assert.equal(engine.config.contextTurns,100);
assert.equal(engine.config.activationMode,'force_selected');
assert.deepEqual(engine.config.selectedEntries,['a','b']);

assert.throws(()=>engine.setPreset('x'.repeat(30001)),/预设限30000字/);
assert.throws(()=>engine.applyPromptSettings({preset:'x'.repeat(30001)}),/预设文档内容无效或超过30000字/);

const field=value=>({value});
engine.panel={
  querySelector(selector){
    const map={
      '[data-segment-list]':null,
      '[data-floors]':field('12'),
      '[data-activation]':field('respect_activation'),
      '[data-core-prompt]':field('面板核心'),
      '[data-macro-prompt]':field('面板宏观'),
      '[data-stability-prompt]':field('面板稳定'),
      '[data-npc-audit-prompt]':field('面板审计'),
      '[data-structure-prompt]':field('面板结构')
    };
    return map[selector]??null;
  },
  querySelectorAll(selector){
    if(selector==='[data-book]')return [
      {checked:true,disabled:false,value:'book-a'},
      {checked:false,disabled:false,value:'book-b'},
      {checked:true,disabled:true,value:'book-c'}
    ];
    if(selector==='[data-prompt-registry]')return [];
    return [];
  }
};
const settings=engine.readPromptEditor();
assert.equal(settings.preset,engine.config.preset);
assert.equal(settings.corePrompt,'面板核心');
assert.equal(settings.macroPrompt,'面板宏观');
assert.equal(settings.stabilityPromptTemplate,'面板稳定');
assert.equal(settings.npcAuditPrompt,'面板审计');
assert.equal(settings.structurePrompt,'面板结构');
assert.equal(settings.contextTurns,12);
assert.equal(settings.activationMode,'respect_activation');
assert.deepEqual(settings.selectedEntries,['book-a']);

assert.equal(engine.services.promptDocuments.constructor.name,'WorldPromptDocumentService');
assert.equal(engine.services.promptIntegration.constructor.name,'WorldPromptIntegrationService');
assert.equal(engine.services.promptIntegration.registry,engine.services.prompts);
assert.equal(engine.services.promptIntegration.workspace,engine.promptWorkspace);
assert.equal(engine.promptWorkspace.constructor.name,'WorldPromptWorkspaceController');

console.log('world-engine prompt settings regression tests passed');
