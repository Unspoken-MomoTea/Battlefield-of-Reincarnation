const assert=require('node:assert/strict');
const path=require('node:path');
const {SamsaraWorldEngine:Engine,emptyState}=require(path.join(__dirname,'../script/世界推进系统.js'));
const clone=value=>JSON.parse(JSON.stringify(value));

function fresh(){
  return {
    世界:{名称:'测试世界',时间:'2026年9月14日-18:00',地点:'灰港',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'',故事线:'',下一节点:'',偏移记录:{}},货币:{体系:'',购买力基准:'',经济波动:''},历法:{名称:'',月份天数:[],闰年规则:''},异端雷达:{名单:{}}},
    任务:{列表:{}},系统状态:{是否在主神空间:false},设置:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}},资产:{}
  };
}
function hostFor(statRef){
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    SillyTavern:{name1:'测试玩家'},
    Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
    getCurrentChatId:()=> 'module-prompts',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'灰港钟声响过，街面仍很安静。'}],
    document:{addEventListener:()=>{},removeEventListener:()=>{},createElement:()=>({style:{},click(){host.__exportClicked=true;},remove(){}}),body:{appendChild:()=>{}}},
    Blob:globalThis.Blob,
    URL:{createObjectURL(blob){host.__exportedBlob=blob;return 'blob:module-prompts-test';},revokeObjectURL:()=>{}}
  };
  host.Mvu={getMvuData:()=>({stat_data:clone(statRef.value)}),replaceMvuData:async data=>{statRef.value=clone(data.stat_data);}};
  return host;
}

(async()=>{
  const statRef={value:fresh()},host=hostFor(statRef),engine=new Engine(host);
  engine.config.enabled=true;
  engine.worldbook=async()=>[];
  assert.equal(engine.config.worldModulePromptVersion,6);
  assert.equal(engine.services.prompts.constructor.name,'WorldPromptRegistry');
  assert.match(engine.config.preset,/只提交已经发生或需要规划的世界变化/);
  assert.match(engine.config.corePrompt,/模型知道≠场外人物知道/);

  const defaults=clone(engine.services.prompts.moduleValues());
  engine.applyPromptSettings({
    preset:engine.config.preset,
    corePrompt:engine.config.corePrompt,
    macroPrompt:engine.config.macroPrompt,
    stabilityPromptTemplate:engine.config.stabilityPromptTemplate,
    npcAuditPrompt:engine.config.npcAuditPrompt,
    structurePrompt:engine.config.structurePrompt,
    modulePrompts:{
      ...defaults,
      worldTime:'【自定义世界时间】\n只按我的时间规则。',
      rumorSource:'【自定义传播来源】\n只按我的传播来源。',
      rumorLiveliness:'',
      rumorThrottle:''
    },
    contextTurns:1,activationMode:'respect_activation',selectedEntries:[]
  });
  assert.equal(engine.config.modulePrompts.worldTime,'【自定义世界时间】\n只按我的时间规则。');
  const request=await engine.buildRequest(engine.snapshot());
  assert.match(request.system,/【自定义世界时间】/);
  assert.match(request.system,/【自定义传播来源】/);
  assert.doesNotMatch(request.system,/【世界时间所有权】/);
  assert.doesNotMatch(request.system,/【传闻与传播 · 常驻活跃层】|【传闻刷新节流|【信息传播 · 世界侧事实】/);
  assert.ok(Array.isArray(request.manifest?.提示词模块)&&request.manifest.提示词模块.some(x=>x.key==='worldTime'));

  const saved=engine.savePromptDocument('模块导出测试',{
    preset:engine.config.preset,corePrompt:engine.config.corePrompt,macroPrompt:engine.config.macroPrompt,
    stabilityPromptTemplate:engine.config.stabilityPromptTemplate,npcAuditPrompt:engine.config.npcAuditPrompt,
    structurePrompt:engine.config.structurePrompt,contextTurns:1,activationMode:'respect_activation',selectedEntries:[]
  },false);
  assert.equal(saved.settings.modulePrompts.worldTime,'【自定义世界时间】\n只按我的时间规则。');

  engine.exportPromptDocument(saved.id);
  assert.equal(host.__exportClicked,true);
  const exported=JSON.parse(await host.__exportedBlob.text());
  assert.equal(exported.settings.modulePrompts.worldTime,'【自定义世界时间】\n只按我的时间规则。');

  const importedEngine=new Engine(hostFor({value:fresh()}));
  const imported=importedEngine.importPromptDocument(JSON.stringify(exported));
  assert.equal(imported.settings.modulePrompts.worldTime,'【自定义世界时间】\n只按我的时间规则。');

  console.log('PASS editable prompt registry persists through save, export and import');
})().catch(error=>{console.error(error);process.exitCode=1;});
