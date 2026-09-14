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
assert.match(layer,/if\(!this\.isNpcBuildAuditEnabled\(\)\)audit\?\.closest\('details'\)\?\.remove\(\)/,'NPC audit prompt must be hidden while audit is disabled');
assert.doesNotMatch(layer,/空分类本轮必须补2条/,'new final prompt layer must not revive obsolete rumor quota wording');
assert.match(layer,/本轮没有这种重大变化时，省略“因果\.偏移记录”/,'causal offsets must be explicitly optional instead of treated as per-turn maintenance');
assert.match(layer,/\{yyy\}年-\{mm\}月-\{dd\}日-\{时间段\}/,'world-time prompt must use the neutral machine-readable template');
assert.doesNotMatch(layer,/帝历1024年-09月-12日-下午/,'runtime module defaults must not hard-code a world-specific date example');

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
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'灰港钟声响过，街面仍很安静。'}]
  };
  host.Mvu={getMvuData:()=>({stat_data:clone(statRef.value)}),replaceMvuData:async data=>{statRef.value=clone(data.stat_data);}};
  return host;
}

(async()=>{
  const statRef={value:fresh()};
  const engine=new Engine(hostFor(statRef));
  engine.config.enabled=true;
  assert.equal(engine.config.worldModulePromptVersion,3);
  assert.match(engine.config.preset,/只提交已经发生或需要规划的世界变化/,'built-in preset should migrate to concise pipeline');
  assert.match(engine.config.corePrompt,/模型知道≠场外人物知道/,'compact core must preserve anti-omniscience boundary');
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
  console.log('PASS concise editable module prompts replace legacy hidden prompt stack');
})().catch(error=>{console.error(error);process.exitCode=1;});
