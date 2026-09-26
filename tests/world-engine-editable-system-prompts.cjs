const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const delivery = path.join(__dirname, '../script/世界推进系统.js');
const foundation = fs.readFileSync(path.join(__dirname, '../script/world-engine-src/00-foundation-prompt.part.js'), 'utf8');
const runtime = fs.readFileSync(path.join(__dirname, '../script/world-engine-src/40-engine-runtime.part.js'), 'utf8');
const requestBuilder = fs.readFileSync(path.join(__dirname, '../src/WorldEngine/domains/WorldRequestBuilder.part.js'), 'utf8');
const ui = [
  path.join(__dirname, '../script/world-engine-src/50-engine-ui.part.js'),
  path.join(__dirname, '../src/WorldEngine/ui/views/WorldPromptView.part.js'),
].map(file => fs.readFileSync(file, 'utf8')).join('\n');
const {SamsaraWorldEngine: Engine, emptyState} = require(delivery);
const clone = value => JSON.parse(JSON.stringify(value));

assert.match(foundation, /version:21,\n\s*builtin:true/, 'editable system prompt migration should keep the current built-in prompt document at v21');
assert.match(foundation, /corePrompt:\s*CORE_WORLD_RULES/, 'built-in prompt document must carry the same core prompt used at runtime');
assert.match(foundation, /macroPrompt:\s*DEFAULT_MACRO_PROMPT/, 'built-in prompt document must carry the same macro prompt used at runtime');
assert.match(foundation, /stabilityPromptTemplate:\s*DEFAULT_STABILITY_PROMPT_TEMPLATE/, 'built-in prompt document must carry the same stability template used at runtime');

for (const marker of ['data-core-prompt', 'data-macro-prompt', 'data-stability-prompt', 'data-npc-audit-prompt', 'data-structure-prompt']) {
  assert.ok(ui.includes(marker), `prompt workspace must expose editable field: ${marker}`);
}
assert.doesNotMatch(ui, /世界引擎核心约束 · 固定只读/, 'core prompt must no longer be presented as immutable');
assert.match(ui, /程序字段 Schema · 只读/, 'canonical program schema remains the only fixed prompt-related contract');

for (const marker of ['corePrompt', 'macroPrompt', 'stabilityPromptTemplate']) {
  assert.ok(runtime.includes(marker), `runtime must persist prompt setting: ${marker}`);
}
assert.match(requestBuilder, /this\.config\.corePrompt\s*\?\?\s*CORE_WORLD_RULES/, 'actual request must use saved core prompt');
assert.match(requestBuilder, /this\.config\.macroPrompt\s*\?\?\s*DEFAULT_MACRO_PROMPT/, 'actual request must use saved macro prompt');
assert.match(requestBuilder, /worldStabilityPrompt\(state,\s*this\.config\.stabilityPromptTemplate\s*\?\?\s*DEFAULT_STABILITY_PROMPT_TEMPLATE\)/, 'actual request must use saved stability template');

(async () => {
  let stat = {
    世界:{
      名称:'测试世界',时间:'2026年9月14日傍晚',地点:'灰港',稳定:95,
      后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'',故事线:'',下一节点:'',偏移记录:{}},
      货币:{体系:'',购买力基准:'',经济波动:''},历法:{名称:'',月份天数:[],闰年规则:''},异端雷达:{名单:{}}
    },
    系统状态:{是否在主神空间:false},设置:{},关系列表:{},传闻:{},资产:{}
  };
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    SillyTavern:{name1:'测试玩家'},
    Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
    getCurrentChatId:()=> 'editable-system-prompts',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'灰港的钟声刚刚响过。'}]
  };
  host.Mvu={getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async data=>{stat=clone(data.stat_data);}};
  const engine=new Engine(host);
  engine.config.enabled=true;
  engine.config.requireMacroBackbone=true;
  engine.applyPromptSettings({
    preset:'【执行流程】\n测试工作层',
    corePrompt:'【自定义核心】\n核心规则由用户控制',
    macroPrompt:'【自定义宏观】\n宏观规则由用户控制',
    stabilityPromptTemplate:'【自定义世界自救 · {{阶段}}】\n稳定={{稳定值}}；{{规则}}',
    npcAuditPrompt:'【自定义审计】\n审计规则由用户控制',
    structurePrompt:'【自定义输出协议】\n只输出结构化结果',
    contextTurns:1,
    activationMode:'respect_activation',
    selectedEntries:[]
  });
  assert.equal(engine.config.corePrompt, '【自定义核心】\n核心规则由用户控制');
  assert.equal(engine.config.macroPrompt, '【自定义宏观】\n宏观规则由用户控制');
  assert.match(engine.config.stabilityPromptTemplate, /自定义世界自救/);
  const request=await engine.buildRequest(engine.snapshot());
  assert.match(request.system, /【自定义核心】/);
  assert.match(request.system, /【自定义宏观】/);
  assert.match(request.system, /【自定义世界自救 · 因果警觉】/);
  assert.match(request.system, /【自定义输出协议】/);
  assert.doesNotMatch(request.system, /【世界引擎核心约束】/, 'custom core prompt must replace the built-in core prompt in the actual request');
  console.log('PASS editable system prompts are visible, persisted, and used by the actual request');
})().catch(error=>{console.error(error);process.exitCode=1;});
