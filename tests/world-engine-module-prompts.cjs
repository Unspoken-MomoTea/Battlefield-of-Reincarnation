const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const delivery=path.join(root,'script','世界推进系统.js');
const layer=fs.readFileSync(path.join(root,'script','world-engine-src','59-editable-module-prompts.part.js'),'utf8');
const {SamsaraWorldEngine:Engine,emptyState}=require(delivery);
const clone=value=>JSON.parse(JSON.stringify(value));

assert.match(layer,/WORLD_PROMPT_MODULE_DEFS/,'module prompt registry missing');
for(const source of ['TASK_AWARENESS_RULES','CHRONOLOGY_GUARD_RULES','SOFT_MAINTENANCE_RULES','EXPLORATION_PROJECTION_RULES','WORLD_INTEGRITY_GUARD_RULES','WORLD_TIME_RULES','RUMOR_THROTTLE_RULES / RUMOR_WORLD_SOURCE_RULES']){
  assert.ok(layer.includes(source),`prompt workspace must expose actual module source: ${source}`);
}
assert.match(layer,/data-module-prompt=/,'module prompt editors must be rendered');
assert.match(layer,/\[data-core-prompt\],\[data-macro-prompt\],\[data-stability-prompt\],\[data-module-prompt\]/,'new prompt blocks must follow the same edit-mode toggle as the original prompt workspace');
assert.match(layer,/savePromptDocument\(name,settings,activate=true\)/,'saved preset documents must explicitly persist module prompts');
assert.doesNotMatch(layer,/if\(!this\.isNpcBuildAuditEnabled\(\)\)audit\?\.closest\('details'\)\?\.remove\(\)/,'NPC audit prompt must stay visible and editable even while the audit feature is disabled');
assert.doesNotMatch(layer,/空分类本轮必须补2条/,'new final prompt layer must not revive obsolete rumor quota wording');
assert.match(layer,/本轮没有这种重大变化时，省略“因果\.偏移记录”/,'causal offsets must be explicitly optional instead of treated as per-turn maintenance');
assert.match(layer,/\{yyy\}年-\{mm\}月-\{dd\}日-\{时间段\}/,'world-time prompt must use the neutral machine-readable template');
assert.doesNotMatch(layer,/帝历1024年-09月-12日-下午/,'runtime module defaults must not hard-code a world-specific date example');
assert.match(layer,/凌晨 \/ 黎明 \/ 清晨 \/ 早晨 \/ 上午 \/ 中午 \/ 午后 \/ 下午 \/ 傍晚 \/ 入夜 \/ 晚上 \/ 深夜/,'world-time prompt must restrict AI output to the canonical 12 dayparts');
assert.match(layer,/没有足够时间流逝跨过当前时段就保持原值/,'world-time prompt must not force a daypart change every world-engine run');


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
    document:{
      addEventListener:()=>{},removeEventListener:()=>{},
      createElement:()=>({style:{},click(){host.__exportClicked=true;},remove(){}}),
      body:{appendChild:()=>{}}
    },
    Blob:globalThis.Blob,
    URL:{createObjectURL(blob){host.__exportedBlob=blob;return 'blob:module-prompts-test';},revokeObjectURL:()=>{}}
  };
  host.Mvu={getMvuData:()=>({stat_data:clone(statRef.value)}),replaceMvuData:async data=>{statRef.value=clone(data.stat_data);}};
  return host;
}

(async()=>{
  const statRef={value:fresh()};
  const host=hostFor(statRef);
  const engine=new Engine(host);
  engine.config.enabled=true;
  assert.equal(engine.config.worldModulePromptVersion,5);
  assert.match(engine.config.preset,/只提交已经发生或需要规划的世界变化/,'built-in preset should migrate to concise pipeline');
  assert.match(engine.config.corePrompt,/模型知道≠场外人物知道/,'compact core must preserve anti-omniscience boundary');
  assert.match(engine.config.corePrompt,/活跃异端只在活动缺失、复核到期、关联事件\/所在地区变化或长期未复核时更新/,'compact core must keep active-alien review event-driven');
  assert.match(engine.config.corePrompt,/没有重大世界偏移就完全不写偏移记录/,'compact core must not pressure the model to touch stability every round');
  assert.ok(engine.config.modulePrompts&&typeof engine.config.modulePrompts.worldTime==='string');

  const defaults=clone(engine.config.modulePrompts);
  engine.applyPromptSettings({
    preset:engine.config.preset,
    corePrompt:engine.config.corePrompt,
    macroPrompt:engine.config.macroPrompt,
    stabilityPromptTemplate:engine.config.stabilityPromptTemplate,
    npcAuditPrompt:engine.config.npcAuditPrompt,
    structurePrompt:engine.config.structurePrompt,
    modulePrompts:{...defaults,worldTime:'【自定义世界时间】\n只按我的时间规则。',rumor:'【自定义传播】\n只按我的传播规则。'},
    contextTurns:1,activationMode:'respect_activation',selectedEntries:[]
  });
  assert.equal(engine.config.modulePrompts.worldTime,'【自定义世界时间】\n只按我的时间规则。');
  const request=await engine.buildRequest(engine.snapshot());
  assert.match(request.system,/【自定义世界时间】/);
  assert.match(request.system,/【自定义传播】/);
  assert.doesNotMatch(request.system,/【世界时间所有权】/,'legacy WORLD_TIME_RULES must not survive final request');
  assert.doesNotMatch(request.system,/【传闻与传播 · 常驻活跃层】|【传闻刷新节流|【信息传播 · 世界侧事实】/,'legacy rumor prompt stack must collapse before final request');
  assert.equal((request.system.match(/【自定义传播】/g)||[]).length,1,'custom rumor module must appear exactly once');
  assert.ok(Array.isArray(request.manifest?.提示词模块)&&request.manifest.提示词模块.length>=7,'request manifest must expose final module prompt list');

  const saved=engine.savePromptDocument('模块导出测试',{
    preset:engine.config.preset,
    corePrompt:engine.config.corePrompt,
    macroPrompt:engine.config.macroPrompt,
    stabilityPromptTemplate:engine.config.stabilityPromptTemplate,
    npcAuditPrompt:engine.config.npcAuditPrompt,
    structurePrompt:engine.config.structurePrompt,
    contextTurns:1,activationMode:'respect_activation',selectedEntries:[]
  },false);
  assert.equal(saved.settings.modulePrompts.worldTime,'【自定义世界时间】\n只按我的时间规则。','saving a new preset must capture current runtime module prompts even if the caller omits modulePrompts');
  assert.equal(saved.settings.modulePrompts.rumor,'【自定义传播】\n只按我的传播规则。');

  engine.exportPromptDocument(saved.id);
  assert.equal(host.__exportClicked,true,'preset export must trigger a download');
  assert.ok(host.__exportedBlob,'preset export must create a JSON blob');
  const exported=JSON.parse(await host.__exportedBlob.text());
  assert.equal(exported.settings.modulePrompts.worldTime,'【自定义世界时间】\n只按我的时间规则。','exported preset JSON must contain customized runtime module prompts');
  assert.equal(exported.settings.modulePrompts.rumor,'【自定义传播】\n只按我的传播规则。');

  const importedEngine=new Engine(hostFor({value:fresh()}));
  const imported=importedEngine.importPromptDocument(JSON.stringify(exported));
  assert.equal(imported.settings.modulePrompts.worldTime,'【自定义世界时间】\n只按我的时间规则。','import must restore exported runtime module prompts');
  assert.equal(imported.settings.modulePrompts.rumor,'【自定义传播】\n只按我的传播规则。');

  console.log('PASS concise editable module prompts persist through save, export and import');
})().catch(error=>{console.error(error);process.exitCode=1;});
