const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const {SamsaraWorldEngine:Engine,emptyState}=require(path.join(root,'script','世界推进系统.js'));
const clone=value=>JSON.parse(JSON.stringify(value));

const stat={
  世界:{名称:'提示词测试世界',时间:'2026年09月26日-下午',地点:'中央区',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'测试阶段',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},货币:{},历法:{},法则:[]},
  系统状态:{是否在主神空间:false},设置:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}},资产:{},任务:{列表:{}}
};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  SillyTavern:{name1:'测试玩家'},
  Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
  getCurrentChatId:()=> 'prompt-registry-complete',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'中央区仍在运转。'}],
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
};
host.Mvu={getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async()=>{}};

(async()=>{
  const engine=new Engine(host);
  engine.config.enabled=true;
  engine.config.requireMacroBackbone=false;
  engine.worldbook=async()=>[];

  const descriptors=engine.services.prompts.describe();
  const keys=new Set(descriptors.map(item=>item.key));
  for(const key of [
    'corePrompt','macroPrompt','stabilityPromptTemplate','npcAuditPrompt','structurePrompt',
    'task','chronology','maintenance','exploration','integrity','worldTime',
    'rumorLiveliness','rumorThrottle','rumorSource','worldActivity',
    'historyMemory','retryAcceptedWithPlan','retryAccepted','retryFresh'
  ]) assert.ok(keys.has(key),'prompt registry missing: '+key);

  for(const row of descriptors){
    assert.equal(typeof row.title,'string');
    assert.equal(typeof row.source,'string');
    assert.equal(typeof row.condition,'string');
    assert.equal(typeof row.value,'string');
    assert.equal(row.editable,true,'every runtime AI prompt text must be editable: '+row.key);
  }

  const defaults=engine.services.prompts.moduleValues();
  engine.applyPromptSettings({
    preset:engine.config.preset,
    corePrompt:engine.config.corePrompt,
    macroPrompt:engine.config.macroPrompt,
    stabilityPromptTemplate:engine.config.stabilityPromptTemplate,
    npcAuditPrompt:engine.config.npcAuditPrompt,
    structurePrompt:engine.config.structurePrompt,
    modulePrompts:{
      ...defaults,
      worldActivity:'【自定义世界活动】\n必须推进真实世界。',
      historyMemory:'【自定义历史压缩】\n只压缩已确认历史。',
      retryFresh:'【自定义首次纠错】\n只修错误。'
    },
    contextTurns:1,activationMode:'respect_activation',selectedEntries:[]
  });

  const request=await engine.buildRequest(engine.snapshot());
  assert.match(request.system,/【自定义世界活动】/,'world activity prompt must come from editable registry');
  assert.doesNotMatch(request.system,/【世界活动交付 · 非异端世界必须推进】/,'hidden built-in world activity prompt must be stripped after customization');

  let historySystem='';
  engine.requestAI=async(system)=>{historySystem=String(system);return JSON.stringify({摘要:'压缩结果'});};
  const summary=await engine.requestHistoryMemorySummary(
    {名称:'提示词测试世界'},
    [{timeStart:'第1日',timeEnd:'第1日',text:'已确认事实。'}],
    1
  );
  assert.equal(summary,'压缩结果');
  assert.equal(historySystem,'【自定义历史压缩】\n只压缩已确认历史。','history compression must use editable prompt');

  const ui=fs.readFileSync(path.join(root,'script','world-engine-src','ui','60-prompt-tab.part.js'),'utf8');
  assert.match(ui,/data-prompt-key=/,'prompt workspace must render registry-backed prompt fields');
  assert.doesNotMatch(ui,/isNpcBuildAuditEnabled\(\).*remove|closest\('details'\)\?\.remove/,'disabled NPC audit prompt must remain visible and editable');
  assert.match(ui,/发送条件|condition/,'prompt workspace must explain when each prompt is sent');

  console.log('PASS prompt registry exposes and controls every runtime AI prompt');
})().catch(error=>{console.error(error);process.exitCode=1;});
