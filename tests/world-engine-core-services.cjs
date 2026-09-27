const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

const stat={
  世界:{名称:'核心服务测试',时间:'2026年09月26日-下午',地点:'北门',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},货币:{},历法:{},法则:[],异端雷达:{名单:{}}},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  SillyTavern:{name1:'测试玩家'},
  Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
  getCurrentChatId:()=> 'core-services',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'北门仍在运转。'}],
  document:{addEventListener:()=>{},removeEventListener:()=>{}}
};
host.Mvu={getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async()=>{}};

const engine=new Engine(host);
assert.equal(engine.services.stateProjector?.constructor?.name,'WorldStateProjector');
assert.equal(engine.services.compiler?.constructor?.name,'WorldResultCompiler');
assert.equal(engine.services.resultStaging?.constructor?.name,'WorldResultStagingService');
assert.equal(engine.services.resultParser?.constructor?.name,'WorldResultReplyParser');
assert.equal(engine.services.validationPolicy?.constructor?.name,'WorldValidationPolicy');

const projected=engine.services.stateProjector.world(stat);
assert.equal(projected.世界.名称,'核心服务测试');
assert.equal(projected.世界.地点,'北门');
assert.ok(projected.世界.后台,'state projector must expose the world-engine hot backend projection');

const compiled=engine.services.compiler.compile(stat,{
  摘要:'测试',
  事件:[{
    名称:'巡逻升级',分类:'当前事件',状态:'进行中',描述:'北门巡逻升级',
    时间:'2026年09月26日-下午',开始时间:'2026年09月26日-下午',参与者:[],前因:[],关联任务:[],可见影响:[]
  }]
});
assert.ok(compiled.patches.some(p=>String(p.path).includes('/事件/巡逻升级')),'compiler service must compile WorldResult through the canonical compiler');
const built=engine.services.compiler.materialize(stat,[],compiled.patches);
assert.equal(built.next.世界.后台.事件.巡逻升级.描述,'北门巡逻升级');

const runtime=fs.readFileSync(path.join(root,'src/WorldEngine/core/SamsaraWorldEngine.part.js'),'utf8');
const orchestrator=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldRunOrchestrator.part.js'),'utf8');
const compiler=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldResultCompiler.part.js'),'utf8');
const normalizer=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldResultNormalizer.part.js'),'utf8');
const materializer=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldResultMaterializer.part.js'),'utf8');
const causal=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldCausalService.part.js'),'utf8');
const patchPolicy=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldPatchPolicy.part.js'),'utf8');
const staging=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldResultStagingService.part.js'),'utf8');
const retryGuidance=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldRetryGuidanceService.part.js'),'utf8');
const parser=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldResultReplyParser.part.js'),'utf8');
const worldTimePolicy=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldTimePolicy.part.js'),'utf8');
const validationPolicy=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldValidationPolicy.part.js'),'utf8');
const requestBuilder=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldRequestBuilder.part.js'),'utf8');
assert.match(requestBuilder,/services\?\.stateProjector\?\.world/,'base request builder must use the state projector service seam');
const projector=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldStateProjector.part.js'),'utf8');
assert.match(projector,/projectedBackend\.历史记忆=this\.history\?\.project\?this\.history\.project\(backend\):DEFAULT_WORLD_HISTORY_MEMORY_POLICY\.project\(backend\)/,'state projector must own history-memory projection at the canonical context boundary without depending on the global compatibility helper');
assert.match(projector,/world\(stat\)\{return this\.baseWorld\(stat\);\}/,'state projector must no longer traverse a decorated global world-context seam');
assert.match(orchestrator,/services\?\.compiler\?\.compile/,'run orchestrator result handling must use the compiler service seam');
assert.match(orchestrator,/services\?\.compiler\?\.stage/,'run orchestrator staged WorldResult validation must use the compiler service seam');
assert.match(orchestrator,/services\?\.resultParser\?\.parse/,'run orchestrator reply handling must use the reply parser service seam');
assert.match(normalizer,/class\s+WorldResultNormalizer\b/,'normalization must live behind a dedicated domain class');
assert.match(compiler,/this\.normalizer\.normalizeWorldResult\(value\)/,'compiler.normalize must delegate to the normalizer class');
assert.match(materializer,/class\s+WorldResultMaterializer\b/,'patch compilation must live behind a dedicated domain class');
assert.match(compiler,/compile\(stat,value\)\{return this\.materializer\.compileWorldResult\(stat,value\);\}/,'compiler.compile must call the canonical materializer directly after compile decorators are removed');
assert.match(materializer,/this\.timePolicy\.prepareCompile\(originalStat,initial\)/,'canonical materializer must establish the world-time transaction before domain compilation');
assert.match(materializer,/this\.people\.normalizeAlienActivityTimestamps\(stat,timing\.result\)/,'canonical materializer compile must preprocess alien activity against the final world-time snapshot');
assert.match(materializer,/this\.timePolicy\.finalizeCompile\(originalStat,timing\.proposal,\{result,patches,warnings\}\)/,'canonical materializer must finalize the world-time patch after domain compilation');
assert.match(materializer,/this\.taskLedger\.validateReferences\(stat,result\)/,'canonical materializer compile must validate task references through the task ledger service');
assert.match(materializer,/this\.chronology\.validate\(stat,result\)/,'canonical materializer compile must validate chronology through the chronology policy');
assert.match(materializer,/this\.npcAudit\.normalizeNewEquipment\(stat,result\)/,'canonical materializer compile must normalize newly audited NPC equipment through the NPC audit service');
assert.match(materializer,/this\.causal\.prepareResult\(stat,result\)/,'canonical materializer compile must run causal filtering and soft normalization through the causal service');
assert.match(materializer,/this\.causal\.staleLocalOffsetRepairs\(stat,result\)/,'canonical materializer compile must append causal stale-offset repairs through the causal service');
assert.match(causal,/class\s+WorldCausalService\b/,'causal compile rules must live behind the causal domain service');
assert.match(patchPolicy,/\bremovable\s*\(parts\)/,'patch policy must own the controlled causal remove contract');
assert.match(compiler,/this\.materializer\.materializeWorldUpdate\(stat,seedPatches,modelPatches\)/,'compiler.materialize must delegate to the materializer class');
assert.match(staging,/class\s+WorldResultStagingService\b/,'staged result acceptance must live behind a dedicated domain service');
assert.match(staging,/this\.materializer\.compileWorldResult\(stat,candidate\)/,'staging must compile fragments directly through the canonical materializer');
assert.match(staging,/this\.normalizer\.mergeWorldResults\(staged,unit\.result\)/,'staging must merge fragments through the canonical normalizer');
assert.match(staging,/return this\.retryGuidance\.plan\(error,rejected\)/,'staging retry planning must delegate to the canonical retry guidance service');
assert.match(parser,/class\s+WorldResultReplyParser\b/,'reply parsing must live behind a dedicated domain service');
assert.match(worldTimePolicy,/class\s+WorldTimePolicy\b/,'world-time result policy must live behind a dedicated domain class');
assert.match(retryGuidance,/class\s+WorldRetryGuidanceService\b/,'retry guidance must live behind a dedicated domain service');
assert.match(retryGuidance,/this\.engine\?\.services\?\.prompts\?\.value\?\.\(key\)/,'retry guidance must read editable prompt values at execution time');
assert.match(validationPolicy,/class\s+WorldValidationPolicy\b/,'base runtime validation must live behind a dedicated domain policy');
assert.match(compiler,/this\.staging\.stage\(stat,accepted,incoming,validate\)/,'compiler.stage must delegate to the staging service');
assert.match(runtime,/runOrchestrator\(\)/,'runtime must delegate application flow to the orchestrator');

console.log('PASS runtime uses class-based state projection and WorldResult compiler services');
