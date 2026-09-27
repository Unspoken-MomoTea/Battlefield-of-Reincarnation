const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
for(const file of [
  'src/WorldEngine/README.md',
  'src/WorldEngine/ARCHITECTURE.md',
  'src/WorldEngine/core/WorldEngineServiceContainer.part.js',
  'src/WorldEngine/core/WorldEngineConfigService.part.js',
  'src/WorldEngine/core/SamsaraWorldEngine.part.js',
  'src/WorldEngine/core/WorldEngineLifecycleController.part.js',
  'src/WorldEngine/ui/WorldPanelController.part.js',
  'src/WorldEngine/ui/WorldPanelRenderer.part.js',
  'src/WorldEngine/domains/WorldStateModel.part.js',
  'src/WorldEngine/domains/WorldStateFactory.part.js',
  'src/WorldEngine/domains/WorldStateProjector.part.js',
  'src/WorldEngine/domains/WorldPatchPolicy.part.js',
  'src/WorldEngine/domains/WorldTimelinePolicy.part.js',
  'src/WorldEngine/domains/WorldChronologyPolicy.part.js',
  'src/WorldEngine/domains/WorldTimePolicy.part.js',
  'src/WorldEngine/domains/WorldDueEventPolicy.part.js',
  'src/WorldEngine/domains/WorldActivityPolicy.part.js',
  'src/WorldEngine/domains/WorldSoftMaintenancePolicy.part.js',
  'src/WorldEngine/domains/WorldLifecycleService.part.js',
  'src/WorldEngine/domains/WorldStateNormalizer.part.js',
  'src/WorldEngine/domains/WorldResultKernel.part.js',
  'src/WorldEngine/domains/WorldResultContract.part.js',
  'src/WorldEngine/domains/WorldResultNormalizer.part.js',
  'src/WorldEngine/domains/WorldResultMaterializer.part.js',
  'src/WorldEngine/domains/WorldRetryGuidanceService.part.js',
  'src/WorldEngine/domains/WorldResultStagingService.part.js',
  'src/WorldEngine/domains/WorldResultReplyParser.part.js',
  'src/WorldEngine/domains/WorldValidationPolicy.part.js',
  'src/WorldEngine/domains/WorldResultCompiler.part.js',
  'src/WorldEngine/domains/WorldValidationService.part.js',
  'src/WorldEngine/domains/WorldCommitService.part.js',
  'src/WorldEngine/domains/WorldMutationService.part.js',
  'src/WorldEngine/domains/WorldEventService.part.js',
  'src/WorldEngine/domains/WorldPersonActivityService.part.js',
  'src/WorldEngine/domains/WorldTaskAwarenessService.part.js',
  'src/WorldEngine/domains/WorldNpcAuditService.part.js',
  'src/WorldEngine/domains/WorldHistoryMemoryPolicy.part.js',
  'src/WorldEngine/domains/WorldHistoryService.part.js',
  'src/WorldEngine/domains/WorldApiTransportService.part.js',
  'src/WorldEngine/domains/WorldPromptDocumentService.part.js',
  'src/WorldEngine/domains/WorldRunOrchestrator.part.js',
  'src/WorldEngine/domains/WorldRequestService.part.js',
  'src/WorldEngine/prompts/WorldPromptDefaults.part.js',
  'src/WorldEngine/prompts/WorldPromptRegistry.part.js',
]){
  assert.ok(fs.existsSync(path.join(root,file)),file+' must exist in the dedicated src/WorldEngine source tree');
}


const foundationSource=fs.readFileSync(path.join(root,'script/world-engine-src/00-foundation-prompt.part.js'),'utf8');
const configServiceSource=fs.readFileSync(path.join(root,'src/WorldEngine/core/WorldEngineConfigService.part.js'),'utf8');
const applicationShellSource=fs.readFileSync(path.join(root,'src/WorldEngine/core/SamsaraWorldEngine.part.js'),'utf8');
const applicationLifecycleSource=fs.readFileSync(path.join(root,'src/WorldEngine/core/WorldEngineLifecycleController.part.js'),'utf8');
const panelControllerSource=fs.readFileSync(path.join(root,'src/WorldEngine/ui/WorldPanelController.part.js'),'utf8');
const panelRendererSource=fs.readFileSync(path.join(root,'src/WorldEngine/ui/WorldPanelRenderer.part.js'),'utf8');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/40-engine-runtime.part.js')),false,'legacy runtime shell must be deleted');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/50-engine-ui.part.js')),false,'legacy UI shell must be deleted');
assert.match(applicationShellSource,/class\s+SamsaraWorldEngine\s*\{/,'base application shell must live under src/WorldEngine/core');
assert.match(configServiceSource,/class\s+WorldEngineConfigService\s*\{/,'configuration initialization must live behind a dedicated src service');
assert.match(applicationShellSource,/this\.configService=new WorldEngineConfigService\(this\)/,'application shell must delegate constructor config migration');
for(const legacyConfigMarker of ['retryDefaultFiveMigrated','builtinDefaultPromptVersionApplied'])assert.doesNotMatch(applicationShellSource,new RegExp(legacyConfigMarker),'constructor config migration marker must not grow back into the application shell');
assert.match(applicationShellSource,/createPanel\(\)\s*\{\s*return this\.services\?\.panelController\?\.createPanel\?\.\(\);\s*\}/,'application shell createPanel must delegate to the panel controller');
assert.match(panelControllerSource,/class\s+WorldPanelController\s*\{/,'panel interaction routing must live behind a dedicated controller');
assert.match(panelControllerSource,/attachShadow\(\{mode:'open'\}\)/,'panel controller must preserve the Shadow DOM mount boundary');
for(const type of ['click','input','change'])assert.match(panelControllerSource,new RegExp("addEventListener\\('"+type+"'"),'panel controller must own '+type+' routing');
assert.doesNotMatch(applicationShellSource,/panel\.addEventListener\('(click|input|change)'/,'panel DOM event routing must not grow back into the application shell');
assert.match(applicationShellSource,/render\(force=false\)\s*\{\s*return this\.services\?\.panelRenderer\?\.render\?\.\(force\);\s*\}/,'application shell render must delegate to the panel renderer');
assert.match(panelRendererSource,/class\s+WorldPanelRenderer\s*\{/,'shared panel rendering orchestration must live behind a dedicated renderer');
for(const viewKey of ['world','people','exploration','assets','events','rumors','history','settings','prompts','requestInspector'])assert.match(panelRendererSource,new RegExp("engine\\.services\\.views\\.render\\('"+viewKey+"'"),'panel renderer must dispatch '+viewKey+' through the View registry');
assert.doesNotMatch(applicationShellSource,/services\.views\.render|const\s+tabs\s*=\s*\[/,'view dispatch and navigation rendering must not grow back into the application shell');
assert.ok(applicationShellSource.length<14000,'application shell should stay below 14 KB after application lifecycle extraction');
assert.match(applicationLifecycleSource,/class\s+WorldEngineLifecycleController\s*\{/,'application lifecycle must live behind a dedicated controller');
for(const method of ['init','isOpen','open','close','toggle','dispose'])assert.match(applicationLifecycleSource,new RegExp('\\b'+method+'\\s*\\('),'application lifecycle controller must own '+method);
assert.match(applicationShellSource,/init\(\)\s*\{\s*return this\.services\?\.applicationLifecycle\?\.init\?\.\(\);\s*\}/,'application shell init must delegate to the lifecycle controller');
assert.match(applicationShellSource,/isOpen\(\)\s*\{\s*return this\.services\?\.applicationLifecycle\?\.isOpen\?\.\(\)\?\?false;\s*\}/,'application shell isOpen must delegate to the lifecycle controller');
assert.match(applicationShellSource,/open\(\)\s*\{\s*return this\.services\?\.applicationLifecycle\?\.open\?\.\(\);\s*\}/,'application shell open must delegate to the lifecycle controller');
assert.match(applicationShellSource,/close\(\)\s*\{\s*return this\.services\?\.applicationLifecycle\?\.close\?\.\(\);\s*\}/,'application shell close must delegate to the lifecycle controller');
assert.match(applicationShellSource,/toggle\(\)\s*\{\s*return this\.services\?\.applicationLifecycle\?\.toggle\?\.\(\);\s*\}/,'application shell toggle must delegate to the lifecycle controller');
assert.match(applicationShellSource,/dispose\(\)\s*\{\s*return this\.services\?\.applicationLifecycle\?\.dispose\?\.\(\);\s*\}/,'application shell dispose must delegate to the lifecycle controller');
assert.doesNotMatch(applicationShellSource,/eventOn|terminal\.suspend|terminal\.restore|addEventListener\('keydown'|removeEventListener\('keydown'/,'application lifecycle implementation must not grow back into the shell');
const stateModelSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldStateModel.part.js'),'utf8');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/10-world-state.part.js')),false,'legacy world-state slot must be deleted');
assert.match(stateModelSource,/class\s+WorldRecordCatalog\b/,'record catalog must live under src/WorldEngine');
assert.match(stateModelSource,/class\s+WorldEntityIdentityPolicy\b/,'entity identity policy must live under src/WorldEngine');
for(const name of ['NPC_AUDIT_LEVELS','RECORDS','DETAILS','MODEL_RECORDS','MODEL_DETAILS'])assert.match(stateModelSource,new RegExp('const\\s+'+name+'\\s*='),name+' compatibility constant must live in the state model');
for(const seam of ['stableNameIn','worldLocationRelated'])assert.match(stateModelSource,new RegExp('function\\s+'+seam+'\\s*\\('),seam+' compatibility seam must live in the state model');
assert.match(stateModelSource,/const\s+nameKey\s*=\s*value=>DEFAULT_WORLD_ENTITY_IDENTITY_POLICY\.key\(value\)/,'nameKey compatibility seam must delegate to the identity policy');
const stateFactorySource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldStateFactory.part.js'),'utf8');
const timelinePolicySource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldTimelinePolicy.part.js'),'utf8');
const chronologyPolicySource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldChronologyPolicy.part.js'),'utf8');
const worldTimePolicySource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldTimePolicy.part.js'),'utf8');
const dueEventPolicySource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldDueEventPolicy.part.js'),'utf8');
const worldActivityPolicySource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldActivityPolicy.part.js'),'utf8');
const softMaintenancePolicySource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldSoftMaintenancePolicy.part.js'),'utf8');
const retryGuidanceSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldRetryGuidanceService.part.js'),'utf8');
const promptDefaultsSource=fs.readFileSync(path.join(root,'src/WorldEngine/prompts/WorldPromptDefaults.part.js'),'utf8');
const resultContractSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldResultContract.part.js'),'utf8');
const resultMaterializerSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldResultMaterializer.part.js'),'utf8');
const stateProjectorSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldStateProjector.part.js'),'utf8');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/30-context-protocol.part.js')),false,'legacy context-protocol slot must be deleted');
assert.match(stateProjectorSource,/let\s+ACTIVE_WORLD_STATE_PROJECTOR\s*=\s*DEFAULT_WORLD_STATE_PROJECTOR/,'active state projector seam must live with the canonical projector');
assert.match(stateProjectorSource,/function\s+requireWorldStateProjector\s*\(\)/,'state projector src module must own its compatibility resolver');
assert.match(stateProjectorSource,/function\s+projectWorldContext\s*\(stat\)\{return requireWorldStateProjector\(\)\.baseWorld\(stat\);\}/,'public projectWorldContext seam must live in the src projector module');
assert.match(promptDefaultsSource,/const\s+NPC_BUILD_AUDIT_RULES\s*=/,'legacy NPC audit prompt migration default must live under src prompts');
const historyMemoryPolicySource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldHistoryMemoryPolicy.part.js'),'utf8');
const historyServiceSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldHistoryService.part.js'),'utf8');
const knowledgeServiceSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldKnowledgeService.part.js'),'utf8');
const npcAuditServiceSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldNpcAuditService.part.js'),'utf8');
const npcAuditPolicySource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldNpcAuditPolicy.part.js'),'utf8');
assert.match(stateFactorySource,/class\s+WorldStateFactory/,'state factory class must own backend creation');
assert.match(stateFactorySource,/function\s+emptyState\s*\(\)\s*\{return DEFAULT_WORLD_STATE_FACTORY\.emptyBackend\(\);\}/,'public emptyState seam must remain compatible');
assert.match(foundationSource,/function\s+worldDateKey\s*\(value\)\s*\{\s*return ACTIVE_WORLD_TIME_POLICY\.key\(value\);\s*\}/,'foundation worldDateKey must be compatibility-only');
for(const method of ['normalizeDaypartAlias','key','dayKey','hasExactClock'])assert.match(worldTimePolicySource,new RegExp('\\b'+method+'\\s*\\('),'world time policy must own '+method);
for(const method of ['reviewPoint','review','ensureHandled'])assert.match(dueEventPolicySource,new RegExp('\\b'+method+'\\s*\\('),'due event policy must own '+method);
for(const method of ['semanticRecord','recordMap','counts','requirement','changed','ensureDelivery','repairRequired'])assert.match(worldActivityPolicySource,new RegExp('\\b'+method+'\\s*\\('),'world activity policy must own '+method);
for(const method of ['eventHasUsableSchedule','unscheduledEvents','ensureEventTimeAnchors'])assert.match(softMaintenancePolicySource,new RegExp('\\b'+method+'\\s*\\('),'soft maintenance policy must own '+method);
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/59-soft-maintenance.part.js')),false,'legacy soft-maintenance module must be deleted after policy migration');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/59-world-activity-delivery.part.js')),false,'legacy world activity delivery module must be deleted');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/59-due-event-relaxation.part.js')),false,'legacy due-event relaxation module must be deleted');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/55-policy-compat.part.js')),false,'legacy policy compatibility module must be deleted');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/59-world-time-daypart-aliases.part.js')),false,'legacy daypart wrapper must be deleted');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/59-world-integrity-guard.part.js')),false,'legacy integrity prompt shell must be deleted after src prompt migration');
assert.match(timelinePolicySource,/constructor\(timePolicy=DEFAULT_WORLD_TIME_POLICY\)/,'timeline policy must explicitly compose the canonical time policy');
assert.match(timelinePolicySource,/\bimportStory\s*\(stat\)/,'timeline policy must own legacy story seeding');
assert.match(timelinePolicySource,/function\s+importStory\s*\(stat\)\s*\{return ACTIVE_WORLD_TIMELINE_POLICY\.importStory\(stat\);\}/,'public importStory seam must remain compatible');
assert.match(historyServiceSource,/\bproject\s*\(stat\)/,'history service must expose world-history projection');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/59-history-memory.part.js')),false,'legacy history memory module must be deleted after algorithm migration');
for(const method of ['leafKey','leafEntries','collectedIds','invalidateAncestors','rootsAtLevel','batchForLevel','nextKey','parseReply','prompt','project','digest'])assert.match(historyMemoryPolicySource,new RegExp('\\b'+method+'\\s*\\('),'history memory policy must own '+method);
assert.match(historyServiceSource,/return this\.policy\.project\(backend\)/,'history service must delegate projection to the canonical history memory policy');
assert.doesNotMatch(stateProjectorSource,/projectWorldHistoryMemory\(backend\)/,'state projector must not depend on the global history compatibility helper');
assert.match(stateProjectorSource,/world\(stat\)\{return this\.baseWorld\(stat\);\}/,'state projector public world path must be canonical after context decorators are removed');
assert.match(timelinePolicySource,/\bsameTimeAnchor\s*\(a,b\)/,'timeline policy must own compatible world-time anchor comparison');
assert.match(timelinePolicySource,/function\s+sameWorldTimeAnchor\s*\(a,b\)\s*\{return ACTIVE_WORLD_TIMELINE_POLICY\.sameTimeAnchor\(a,b\);\}/,'public sameWorldTimeAnchor seam must remain compatible');
for(const method of ['setGuard','compactName','evidenceForEvent','shiftDeclared','validate','retryGuidance'])assert.match(chronologyPolicySource,new RegExp('\\b'+method+'\\s*\\('),'chronology policy must own '+method);
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/58-chronology-guard.part.js')),false,'legacy chronology prompt shell must be deleted');
assert.match(promptDefaultsSource,/const\s+CHRONOLOGY_GUARD_RULES\s*=/,'chronology editable prompt default must live under src/WorldEngine/prompts');
assert.match(resultMaterializerSource,/事件前因非法自引用/,'canonical materializer validation must own explicit event self-reference rejection');
assert.match(resultMaterializerSource,/事件前因不存在：'\+name\+' <- '/,'canonical materializer validation must own actionable missing-predecessor feedback');
assert.match(resultContractSource,/\binstruction\s*\(\)/,'result contract must own editable output protocol instruction');
assert.match(resultContractSource,/\bprotocol\s*\(\)/,'result contract must own canonical schema protocol assembly');
assert.match(resultContractSource,/function\s+protocol\s*\(\)\s*\{return WORLD_RESULT_CONTRACT\.protocol\(\);\}/,'public protocol seam must remain compatible');
assert.match(knowledgeServiceSource,/\bactivation\s*\(entry,scan,force\)/,'knowledge service must own worldbook activation policy');
assert.match(knowledgeServiceSource,/this\.activation\(e,scan,engine\.config\.activationMode==='force_selected'\)/,'worldbook reads must use the service-owned activation policy');
for(const method of ['projectComponentMap','projectCharacter','buildText','inferNarrativeLevel','narrativeLevel','assessment','audit','normalizeNewEquipment','ensureProgress'])assert.match(npcAuditServiceSource,new RegExp('\\b'+method+'\\s*\\('),'NPC audit service must own '+method);
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/55-npc-narrative-audit.part.js')),false,'legacy NPC audit prompt shell must be deleted');
assert.match(promptDefaultsSource,/const\s+NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT\s*=/,'NPC audit editable prompt default must live under src/WorldEngine/prompts');
for(const method of ['syncDerivedSchemaFields','alignSchemaOrder'])assert.match(npcAuditPolicySource,new RegExp('\\b'+method+'\\s*\\('),'NPC audit policy must own '+method);
for(const method of ['omitKeys','abilityMap','equipped','carriedItems','forms','character','assets','tailRecord','causalOrbit','baseWorld']){
  assert.match(stateProjectorSource,new RegExp('\\b'+method+'\\s*\\('),'state projector must own '+method);
}
const patchPolicySource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldPatchPolicy.part.js'),'utf8');
const causalServiceSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldCausalService.part.js'),'utf8');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/59-causal-stability-gate.part.js')),false,'causal stability compile/apply wrapper file must be removed');
const requestServiceSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldRequestService.part.js'),'utf8');
for(const legacyName of ['retryableModelFailure','retryInput']){
  assert.match(requestServiceSource,new RegExp('\\b'+legacyName+'\\s*\\('),'request service must own '+legacyName);
}
for(const legacyName of ['tokens','get','pointer','canonicalizeParts','bootstrapBackendParent','canUpsertMissing','checkRecord','checkDetails','normalizeBackendRecord','sanitizeModelPatches','normalizeModelPatches','allowed']){
}
for(const method of ['tokens','get','pointer','canonicalizeParts','bootstrapBackendParent','canUpsertMissing','checkRecord','checkDetails','normalizeBackendRecord','sanitizeModelPatches','normalizeModelPatches','removable','allowed']){
  assert.match(patchPolicySource,new RegExp('\\b'+method+'\\s*\\('),'patch policy must own '+method);
}
for(const method of ['clampImpact','offsetText','softNormalizeOffsets','hasWorldScaleEvidence','filterNewOffsetsByWorldScale','prepareResult','staleLocalOffsetRepairs','repairProjection'])assert.match(causalServiceSource,new RegExp('\\b'+method+'\\s*\\('),'causal service must own '+method);
assert.match(promptDefaultsSource,/const\s+WORLD_INTEGRITY_GUARD_RULES\s*=/,'integrity editable prompt default must live under src/WorldEngine/prompts');
const personDomainSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldPersonActivityService.part.js'),'utf8');
const taskAwarenessServiceSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldTaskAwarenessService.part.js'),'utf8');
const rumorServiceSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldRumorService.part.js'),'utf8');
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/59-alien-activity-normalization.part.js')),false,'alien compile wrapper file must be removed after service migration');
for(const legacyName of ['derivePersonWorldContext','projectHotWorldPeople','alienRosterMatch','activeAlienActivityRequirements','seedMissingAlienPeople','ensureActiveAlienActivity']){
}
for(const method of ['deriveContext','projectHot','alienRosterMatch','alienActivityReviewReasons','activeAlienRequirements','seedMissingAlienPeople','ensureActiveAlienActivity','normalizeAlienActivityTimestamps']){
  assert.match(personDomainSource,new RegExp('\\b'+method+'\\s*\\('),'person activity domain must own '+method);
}
for(const method of ['unset','identity','claimsMonthDay','assertCalendarCompatibleWorldResultTimes','inferFromCurrentActivities','resolveProposal','assertNotBackwards','prepareCompile','finalizeCompile']){
  assert.match(worldTimePolicySource,new RegExp('\\b'+method+'\\s*\\('),'world time policy must own '+method);
}
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/59-world-time-ownership.part.js')),false,'legacy world-time prompt shell must be deleted');
assert.match(promptDefaultsSource,/const\s+WORLD_TIME_RULES\s*=/,'world-time editable prompt default must live under src/WorldEngine/prompts');
assert.match(retryGuidanceSource,/class\s+WorldRetryGuidanceService\b/,'retry guidance must live behind a dedicated domain service');
for(const file of ['56-rumor-liveliness.part.js','59-rumor-throttle.part.js','59-rumor-world-source.part.js','59-rumor-world-request.part.js','59-rumor-world-system.part.js']){
  assert.equal(fs.existsSync(path.join(root,'script/world-engine-src',file)),false,'legacy rumor module must be deleted after service migration: '+file);
}

for(const promptName of ['RUMOR_LIVELINESS_RULES','RUMOR_THROTTLE_RULES','RUMOR_WORLD_SOURCE_RULES'])assert.match(rumorServiceSource,new RegExp('const\\s+'+promptName+'\\s*='),'rumor service must own '+promptName);
assert.match(rumorServiceSource,/\bupgradePreset\s*\(value\)/,'rumor service must own preset migration');

for(const method of ['projectList','validateReferences'])assert.match(taskAwarenessServiceSource,new RegExp('\\b'+method+'\\s*\\('),'task awareness service must own '+method);
assert.equal(fs.existsSync(path.join(root,'script/world-engine-src/57-task-awareness.part.js')),false,'legacy task-awareness prompt shell must be deleted');
assert.match(promptDefaultsSource,/const\s+TASK_AWARENESS_RULES\s*=/,'task editable prompt default must live under src/WorldEngine/prompts');

const delivery=require('../script/世界推进系统.js');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS}=delivery;
const clone=value=>JSON.parse(JSON.stringify(value));

let current={
  stat_data:{
    世界:{名称:'测试世界',时间:'2026年09月26日-下午',地点:'北门',稳定:100,后台:emptyState(),势力:{},探索:{},历法:{},法则:[],货币:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
    系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  }
};
current.stat_data.世界.后台.事件.巡逻={
  ...clone(RECORDS.事件),分类:'当前事件',状态:'进行中',描述:'旧描述',时间:'2026年09月26日-下午',开始时间:'2026年09月26日-下午',更新时间:'2026年09月26日-下午',参与者:[],前因:[],关联任务:[],可见影响:[]
};
current.stat_data.世界.后台.人物.卫兵={
  ...clone(RECORDS.人物),所属世界:'测试世界',状态:'活跃',地点:'北门',目标:'巡逻',行动:'巡逻',认知:[],认知来源:[],关联事件:['巡逻'],公开动态:'巡逻中',更新时间:'2026年09月26日-下午',开始时间:'2026年09月26日-下午',行程:[],背景关联:[]
};

const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  getCurrentChatId:()=> 'class-architecture-test',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'北门仍在巡逻。'}],
  Mvu:{
    getMvuData:()=>clone(current),
    replaceMvuData:async data=>{current=clone(data);}
  },
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
  toastr:{error:()=>{}}
};
const engine=new Engine(host);

assert.ok(engine.services,'engine must expose a composed service container');
for(const name of ['applicationLifecycle','panelController','panelRenderer','stateFactory','taskLedger','historyMemory','stateProjector','patchPolicy','timelinePolicy','chronologyPolicy','timePolicy','dueEventPolicy','activityPolicy','softMaintenancePolicy','lifecycle','stateNormalizer','resultContract','resultNormalizer','resultMaterializer','retryGuidance','resultStaging','resultParser','compiler','validationPolicy','validation','commit','mutations','events','people','npcAudit','history','exploration','rumor','requests','transport','promptDocuments','run','views','prompts']){
  assert.ok(engine.services[name],`service container must expose ${name}`);
}
assert.equal(engine.services.constructor.name,'WorldEngineServiceContainer');
assert.equal(engine.services.applicationLifecycle.constructor.name,'WorldEngineLifecycleController');
assert.equal(engine.services.stateFactory.constructor.name,'WorldStateFactory');
assert.equal(engine.services.stateProjector.constructor.name,'WorldStateProjector');
assert.equal(engine.services.historyMemory.constructor.name,'WorldHistoryMemoryPolicy');
assert.equal(engine.services.history.policy,engine.services.historyMemory,'history service must share the container-owned history memory policy');
assert.equal(engine.services.taskLedger.constructor.name,'WorldTaskAwarenessService');
assert.equal(engine.services.stateProjector.taskLedger,engine.services.taskLedger,'projector must compose the container-owned task ledger service');
assert.equal(engine.services.history.constructor.name,'WorldHistoryService');
assert.equal(engine.services.stateProjector.history,engine.services.history,'projector must compose the container-owned history service');
assert.equal(engine.services.patchPolicy.constructor.name,'WorldPatchPolicy');
assert.equal(engine.services.timelinePolicy.constructor.name,'WorldTimelinePolicy');
assert.equal(engine.services.timelinePolicy.timePolicy,engine.services.timePolicy,'timeline policy must share the container-owned time policy');
assert.equal(engine.services.chronologyPolicy.constructor.name,'WorldChronologyPolicy');
assert.equal(engine.services.timePolicy.constructor.name,'WorldTimePolicy');
assert.equal(engine.services.dueEventPolicy.constructor.name,'WorldDueEventPolicy');
assert.equal(engine.services.activityPolicy.constructor.name,'WorldActivityPolicy');
assert.equal(engine.services.softMaintenancePolicy.constructor.name,'WorldSoftMaintenancePolicy');
assert.equal(engine.services.lifecycle.constructor.name,'WorldLifecycleService');
assert.equal(engine.services.stateNormalizer.constructor.name,'WorldStateNormalizer');
assert.equal(engine.services.resultContract.constructor.name,'WorldResultContract');
assert.equal(engine.services.resultContract.schema,delivery.WORLD_RESULT_SCHEMA,'service contract must expose the canonical compatibility schema');
assert.equal(engine.services.resultNormalizer.constructor.name,'WorldResultNormalizer');
assert.equal(engine.services.resultMaterializer.constructor.name,'WorldResultMaterializer');
assert.equal(engine.services.resultMaterializer.stateNormalizer,engine.services.stateNormalizer,'materializer must compose the container-owned state normalizer');
assert.equal(engine.services.resultMaterializer.patchPolicy,engine.services.patchPolicy,'materializer must compose the container-owned patch policy');
assert.equal(engine.services.resultMaterializer.npcAudit,engine.services.npcAudit,'materializer must compose the container-owned NPC audit service');
assert.equal(engine.services.resultMaterializer.people,engine.services.people,'materializer must compose the container-owned person activity service for canonical compile preprocessing');
assert.equal(engine.services.resultMaterializer.taskLedger,engine.services.taskLedger,'materializer must compose the container-owned task ledger service');
assert.equal(engine.services.resultMaterializer.chronology,engine.services.chronologyPolicy,'materializer must compose the container-owned chronology policy');
assert.equal(engine.services.resultMaterializer.timePolicy,engine.services.timePolicy,'materializer must compose the container-owned world time policy');
assert.equal(engine.services.resultMaterializer.causal,engine.services.causal,'materializer must compose the container-owned causal service');
assert.equal(engine.services.retryGuidance.constructor.name,'WorldRetryGuidanceService');
assert.equal(engine.services.retryGuidance.engine,engine,'retry guidance must be able to read the active prompt registry');
assert.equal(engine.services.resultStaging.constructor.name,'WorldResultStagingService');
assert.equal(engine.services.resultStaging.retryGuidance,engine.services.retryGuidance,'staging must compose the container-owned retry guidance service');
assert.equal(engine.services.resultStaging.chronology,engine.services.chronologyPolicy,'staging must compose the container-owned chronology policy');
assert.equal(engine.services.resultParser.constructor.name,'WorldResultReplyParser');
assert.equal(engine.services.compiler.constructor.name,'WorldResultCompiler');
assert.equal(engine.services.validationPolicy.constructor.name,'WorldValidationPolicy');
assert.equal(engine.services.validationPolicy.timeline,engine.services.timelinePolicy,'validation policy must compose the container-owned timeline policy');
assert.equal(engine.services.validationPolicy.duePolicy,engine.services.dueEventPolicy,'validation policy must compose the container-owned due-event policy');
assert.equal(engine.services.validationPolicy.activityPolicy,engine.services.activityPolicy,'validation policy must compose the container-owned world activity policy');
assert.equal(engine.services.validationPolicy.softMaintenancePolicy,engine.services.softMaintenancePolicy,'validation policy must compose the container-owned soft-maintenance policy');
assert.equal(engine.services.compiler.normalizer,engine.services.resultNormalizer,'compiler must compose the container-owned normalizer');
assert.equal(engine.services.compiler.materializer,engine.services.resultMaterializer,'compiler must compose the container-owned materializer');
assert.equal(engine.services.compiler.staging,engine.services.resultStaging,'compiler must compose the container-owned staging service');
assert.equal(engine.services.compiler.patchPolicy,engine.services.patchPolicy,'compiler must compose the container-owned patch policy');
assert.equal(engine.services.validation.constructor.name,'WorldValidationService');
assert.equal(engine.services.validation.policy,engine.services.validationPolicy,'validation service must compose the container-owned policy');
assert.equal(engine.services.validation.npcAudit,engine.services.npcAudit,'validation service must compose the container-owned NPC audit service');
assert.equal(engine.services.commit.constructor.name,'WorldCommitService');
assert.equal(engine.services.mutations.constructor.name,'WorldMutationService');
assert.equal(engine.services.events.constructor.name,'WorldEventService');
assert.equal(engine.services.people.constructor.name,'WorldPersonActivityService');
assert.equal(engine.services.people.timePolicy,engine.services.timePolicy,'person activity must share the canonical world time policy');
assert.equal(engine.services.npcAudit.constructor.name,'WorldNpcAuditService');
assert.equal(engine.services.causal.constructor.name,'WorldCausalService');
assert.equal(engine.services.causal.patchPolicy,engine.services.patchPolicy,'causal service must compose the container-owned patch policy');
assert.equal(engine.services.prompts.constructor.name,'WorldPromptRegistry');
assert.equal(engine.services.views.constructor.name,'WorldEngineViewRegistry');
assert.equal(engine.services.panelController.constructor.name,'WorldPanelController');
assert.equal(engine.services.panelRenderer.constructor.name,'WorldPanelRenderer');
assert.equal(engine.services.taskAwareness.taskLedger,engine.services.taskLedger,'task request feature must share the canonical task ledger service');
assert.equal(engine.services.chronology.policy,engine.services.chronologyPolicy,'chronology request feature must share the canonical chronology policy');
assert.equal(engine.services.dueEvent.policy,engine.services.dueEventPolicy,'due-event request feature must share the canonical due-event policy');
assert.equal(engine.services.worldActivityRequest.policy,engine.services.activityPolicy,'world-activity request feature must share the canonical activity policy');
assert.equal(engine.services.timeOwnership.policy,engine.services.timePolicy,'time ownership feature must share the canonical world time policy');
assert.equal(engine.services.requests.constructor.name,'WorldRequestService');
assert.equal(engine.services.requests.retryableModelFailure(new Error('业务校验失败')),true,'model/business failures remain retryable');
assert.equal(engine.services.requests.retryableModelFailure(new Error('请求已取消')),false,'cancellation must never be retried');
const retryPayload=JSON.parse(engine.services.requests.retryInput('{"说明":"测试"}',new Error('业务校验失败'),'{"坏回复":true}',1,3,null,[]));
assert.equal(retryPayload.纠错重试.当前尝试,2);
assert.equal(retryPayload.纠错重试.最大尝试次数,3);
assert.equal(retryPayload.纠错重试.要求,engine.services.prompts.value('retryFresh'),'retry copy must come from editable Prompt Registry');


const freshBackend=engine.services.stateFactory.emptyBackend();
assert.deepEqual(freshBackend,emptyState(),'factory and public emptyState seam must agree');
freshBackend.事件.临时={};
assert.deepEqual(engine.services.stateFactory.emptyBackend().事件,{},'state factory must return isolated mutable records');

const projectedByService=engine.services.stateProjector.world(current.stat_data);
assert.deepEqual(projectedByService,delivery.projectWorldContext(current.stat_data),'service projector must preserve decorated public world context');
assert.equal(projectedByService.世界.后台.人物.卫兵.地点,'北门');
assert.equal(projectedByService.资产,undefined);

const normalized=clone(current.stat_data);
normalized.世界.后台.公开摘要='旧版阶段摘要';
normalized.世界.后台.正文承接='旧交接';
normalized.世界.后台.运行记录=[{摘要:'旧记录'}];
delete normalized.世界.后台.历史总结;
normalized.世界.因果轨道.故事线='远征开始 -> 城门决战 -> 王都改组';
for(const name of ['远征开始','城门决战','王都改组'])normalized.世界.后台.事件[name]={
  ...clone(RECORDS.事件),分类:'宏观节点',状态:'待发生',描述:name,前因:[],参与者:[]
};
normalized.世界.后台.事件.天台争夺={
  ...clone(RECORDS.事件),分类:'宏观节点',状态:'待发生',地点:'学校天台',描述:'夺取天台入口',前因:[],参与者:[]
};
normalized.世界.后台.事件.街区追踪={
  ...clone(RECORDS.事件),分类:'近期节点',状态:'进行中',地点:'北门',描述:'艾琳正在追踪目标',前因:[],参与者:[]
};
normalized.世界.后台.人物['艾琳·晨星']={
  ...clone(RECORDS.人物),所属世界:'测试世界',地点:'北门',目标:'追踪',行动:'追踪',关联事件:[]
};
engine.services.stateNormalizer.normalizeBackendState(normalized);
assert.equal(normalized.世界.因果轨道.当前阶段,'旧版阶段摘要');
assert.equal(normalized.世界.后台.公开摘要,undefined);
assert.equal(normalized.世界.后台.正文承接,undefined);
assert.equal(normalized.世界.后台.运行记录,undefined);
assert.deepEqual(normalized.世界.后台.历史总结,{});
const layerFixes=engine.services.stateNormalizer.normalizeEventLayers(normalized);
assert.equal(normalized.世界.后台.事件.天台争夺.分类,'近期节点');
assert.equal(normalized.世界.后台.事件.街区追踪.分类,'当前事件');
assert.ok(layerFixes.length>=2);
const linkFixes=engine.services.stateNormalizer.repairExplicitEventLinks(normalized);
assert.ok(normalized.世界.后台.事件.街区追踪.参与者.includes('艾琳·晨星'));
assert.ok(normalized.世界.后台.人物['艾琳·晨星'].关联事件.includes('街区追踪'));
assert.ok(linkFixes.length>=2);
const predecessorFixes=engine.services.stateNormalizer.repairMacroPredecessors(normalized);
assert.ok(normalized.世界.后台.事件.城门决战.前因.includes('远征开始'));
assert.ok(normalized.世界.后台.事件.王都改组.前因.includes('城门决战'));
assert.equal(predecessorFixes.length,2);
normalized.世界.后台.事件.远征开始.状态='进行中';
normalized.世界.因果轨道.当前阶段='待初始化';
normalized.世界.因果轨道.下一节点='';
const causalFixes=engine.services.causal.repairProjection(normalized);
assert.equal(normalized.世界.因果轨道.当前阶段,'远征开始');
assert.equal(normalized.世界.因果轨道.下一节点,'城门决战');
assert.ok(causalFixes.some(p=>p.path==='/世界/因果轨道/当前阶段'));
assert.ok(causalFixes.some(p=>p.path==='/世界/因果轨道/下一节点'));
const timelineSnapshot=engine.services.timelinePolicy.timelineState(normalized);
assert.equal(timelineSnapshot.因果轨道需重建,false);
assert.equal(timelineSnapshot.宏观节点数,3);
assert.equal(timelineSnapshot.下一宏观节点.名称,'城门决战');

const expectedPromptKeys=[
  'preset','core','macro','stability','npcAudit','outputProtocol',
  'task','chronology','maintenance','exploration','integrity','worldTime','rumor',
  'worldActivity','historyMemory'
];
const promptKeys=engine.services.prompts.list().map(item=>item.key);
for(const key of expectedPromptKeys)assert.ok(promptKeys.includes(key),'prompt registry must expose '+key);
assert.equal(new Set(promptKeys).size,promptKeys.length,'prompt registry keys must be unique');

const promptRegistrySource=fs.readFileSync(path.join(root,'src/WorldEngine/prompts/WorldPromptRegistry.part.js'),'utf8');
assert.match(promptRegistrySource,/WorldResultContract\.instruction\(\)/,'prompt registry must source editable output protocol from the canonical contract');

const promptUi=[
  'src/WorldEngine/ui/views/WorldPromptView.part.js',
  'src/WorldEngine/prompts/WorldPromptRegistry.part.js',
  'src/WorldEngine/ui/WorldPromptWorkspaceController.part.js',
].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
assert.match(promptUi,/data-prompt-registry/,'prompt workspace must render registry-backed prompt fields');
assert.match(promptUi,/全部实际提示词/,'prompt workspace must present one discoverable all-prompts section');
assert.match(promptUi,/const editor='<textarea data-prompt-registry=/,'every registry item, including native prompts, must be directly editable in the all-prompts section');
assert.doesNotMatch(promptUi,/we-prompt-registry-preview/,'native prompts must not fall back to read-only preview blocks');

(async()=>{
  await engine.services.events.save('巡逻','修正巡逻',{
    ...clone(current.stat_data.世界.后台.事件.巡逻),
    描述:'已由领域服务修正'
  });
  assert.equal(current.stat_data.世界.后台.事件.巡逻,undefined);
  assert.equal(current.stat_data.世界.后台.事件.修正巡逻.描述,'已由领域服务修正');
  assert.deepEqual(current.stat_data.世界.后台.人物.卫兵.关联事件,['修正巡逻']);

  await engine.services.people.save('卫兵',{
    ...clone(current.stat_data.世界.后台.人物.卫兵),
    地点:'南门',行动:'转移到南门继续巡逻'
  });
  assert.equal(current.stat_data.世界.后台.人物.卫兵.地点,'南门');

  const values=engine.services.prompts.values();
  values.worldActivity='【自定义世界活动】\n只用于测试注册表覆盖。';
  values.historyMemory='【自定义历史压缩】\n只压缩既有事实。';
  engine.applyPromptSettings({promptRegistry:values});
  assert.equal(engine.services.prompts.value('worldActivity'),'【自定义世界活动】\n只用于测试注册表覆盖。');
  assert.equal(engine.services.prompts.value('historyMemory'),'【自定义历史压缩】\n只压缩既有事实。');

  console.log('PASS world engine uses composed domain classes and exposes every system prompt through one registry');
})().catch(error=>{console.error(error);process.exitCode=1;});
