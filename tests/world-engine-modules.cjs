const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const buildScript=fs.readFileSync(path.join(root,'tools','build-world-engine.py'),'utf8');
const built=fs.readFileSync(path.join(root,'script','世界推进系统.js'),'utf8');

// 以真实构建器声明的 PARTS 作为模块清单，避免测试自己维护第二份、最终与构建流程漂移的文件列表。
const partsBlock=buildScript.match(/PARTS\s*=\s*\(([\s\S]*?)\)\n\n/);
assert.ok(partsBlock,'build-world-engine.py must declare PARTS');
const declared=[...partsBlock[1].matchAll(/'([^']+\.part\.js)'/g)].map(match=>match[1]);
assert.ok(declared.length>=10,'world engine should be assembled from modular source parts');
assert.equal(new Set(declared).size,declared.length,'build PARTS must not contain duplicate modules');
assert.ok(declared.indexOf('@src/WorldEngine/prompts/WorldPromptRegistry.part.js')<declared.indexOf('@src/WorldEngine/prompts/WorldPromptIntegrationService.part.js'),'prompt integration must load after the canonical registry');
assert.ok(declared.indexOf('@src/WorldEngine/prompts/WorldPromptIntegrationService.part.js')<declared.indexOf('@src/WorldEngine/core/WorldEngineServiceContainer.part.js'),'prompt integration must load before the service container constructs it');
assert.ok(declared.every(file=>file.startsWith('@src/WorldEngine/')),'all world-engine source parts must come from src/WorldEngine after legacy removal');
for(const moduleName of ['editor/00-world-mutations.part.js','editor/10-event-editor.part.js','editor/20-person-editor.part.js']){
  assert.equal(declared.includes(moduleName),false,`migrated editor module must leave legacy build: ${moduleName}`);
}
for(const moduleName of [
  '@src/WorldEngine/core/WorldEngineFoundation.part.js',
  '@src/WorldEngine/core/WorldSharedUtilities.part.js',
  '@src/WorldEngine/core/WorldEngineRuntimeConstants.part.js',
  '@src/WorldEngine/ui/WorldThemeCatalog.part.js',
  '@src/WorldEngine/domains/WorldTokenTelemetry.part.js',
  '@src/WorldEngine/prompts/WorldBasePromptDefaults.part.js',
  '@src/WorldEngine/ui/WorldEngineStyles.part.js',
  '@src/WorldEngine/core/WorldEngineBootstrap.part.js',
  '@src/WorldEngine/core/WorldEngineServiceContainer.part.js',
  '@src/WorldEngine/core/WorldHostAdapter.part.js',
  '@src/WorldEngine/core/WorldEngineConfigService.part.js',
  '@src/WorldEngine/core/WorldRunScheduler.part.js',
  '@src/WorldEngine/core/SamsaraWorldEngine.part.js',
  '@src/WorldEngine/core/WorldEngineLifecycleController.part.js',
  '@src/WorldEngine/domains/WorldStateModel.part.js',
  '@src/WorldEngine/core/WorldEngineFeatureRegistry.part.js',
  '@src/WorldEngine/core/WorldEngineClassBridge.part.js',
  '@src/WorldEngine/domains/WorldRuntimeContextService.part.js',
  '@src/WorldEngine/domains/WorldProseExtractor.part.js',
  '@src/WorldEngine/domains/WorldKnowledgeSelectionPolicy.part.js',
  '@src/WorldEngine/domains/WorldKnowledgeService.part.js',
  '@src/WorldEngine/domains/WorldRequestBuilder.part.js',
  '@src/WorldEngine/domains/WorldStateProjector.part.js',
  '@src/WorldEngine/domains/WorldHistoryMemoryPolicy.part.js',
  '@src/WorldEngine/domains/WorldHistoryService.part.js',
  '@src/WorldEngine/domains/WorldTaskAwarenessService.part.js',
  '@src/WorldEngine/domains/WorldTimelinePolicy.part.js',
  '@src/WorldEngine/domains/WorldChronologyPolicy.part.js',
  '@src/WorldEngine/domains/WorldTimePolicy.part.js',
  '@src/WorldEngine/domains/WorldDueEventPolicy.part.js',
  '@src/WorldEngine/domains/WorldActivityPolicy.part.js',
  '@src/WorldEngine/domains/WorldSoftMaintenancePolicy.part.js',
  '@src/WorldEngine/domains/WorldLifecycleService.part.js',
  '@src/WorldEngine/domains/WorldStateNormalizer.part.js',
  '@src/WorldEngine/domains/WorldCausalService.part.js',
  '@src/WorldEngine/domains/WorldResultVocabulary.part.js',
  '@src/WorldEngine/domains/WorldRelationSyncPolicy.part.js',
  '@src/WorldEngine/domains/WorldAssetMaterializationPolicy.part.js',
  '@src/WorldEngine/domains/WorldStateIntegrityPolicy.part.js',
  '@src/WorldEngine/domains/WorldPatchApplicationService.part.js',
  '@src/WorldEngine/domains/WorldStateMaterializationService.part.js',
  '@src/WorldEngine/domains/WorldResultContract.part.js',
  '@src/WorldEngine/domains/WorldResultNormalizer.part.js',
  '@src/WorldEngine/domains/WorldResultPatchCompilationService.part.js',
  '@src/WorldEngine/domains/WorldResultMaterializer.part.js',
  '@src/WorldEngine/domains/WorldRetryGuidanceService.part.js',
  '@src/WorldEngine/domains/WorldResultStagingService.part.js',
  '@src/WorldEngine/domains/WorldResultReplyParser.part.js',
  '@src/WorldEngine/domains/WorldValidationPolicy.part.js',
  '@src/WorldEngine/domains/WorldResultCompiler.part.js',
  '@src/WorldEngine/domains/WorldValidationService.part.js',
  '@src/WorldEngine/domains/WorldCommitService.part.js',
  '@src/WorldEngine/domains/WorldApiTransportService.part.js',
  '@src/WorldEngine/domains/WorldPromptDocumentService.part.js',
  '@src/WorldEngine/domains/WorldRunOrchestrator.part.js',
  '@src/WorldEngine/prompts/WorldPromptRegistry.part.js',
  '@src/WorldEngine/prompts/WorldPromptIntegrationService.part.js',
  '@src/WorldEngine/ui/views/WorldOverviewView.part.js',
  '@src/WorldEngine/ui/views/WorldPeopleView.part.js',
  '@src/WorldEngine/ui/views/WorldExplorationView.part.js',
  '@src/WorldEngine/ui/views/WorldAssetView.part.js',
  '@src/WorldEngine/ui/views/WorldEventArchiveView.part.js',
  '@src/WorldEngine/ui/views/WorldRumorView.part.js',
  '@src/WorldEngine/ui/views/WorldHistoryView.part.js',
  '@src/WorldEngine/ui/views/WorldSettingsView.part.js',
  '@src/WorldEngine/ui/views/WorldPromptView.part.js',
  '@src/WorldEngine/ui/views/WorldRequestInspectorView.part.js',
  '@src/WorldEngine/domains/WorldCausalService.part.js',
  '@src/WorldEngine/domains/WorldRequestFeature.part.js',
  '@src/WorldEngine/domains/WorldAutoProgressController.part.js',
  '@src/WorldEngine/domains/WorldReplayService.part.js',
  '@src/WorldEngine/domains/WorldTimeOwnershipFeature.part.js',
  '@src/WorldEngine/domains/WorldNpcAuditPolicy.part.js',
  '@src/WorldEngine/domains/WorldHistoryLifecycle.part.js',
  '@src/WorldEngine/domains/WorldSoftMaintenanceFeature.part.js',
  '@src/WorldEngine/domains/WorldIntegrityRequestFeature.part.js',
  '@src/WorldEngine/domains/WorldActivityRequestFeature.part.js',
  '@src/WorldEngine/domains/WorldDueEventFeature.part.js',
  '@src/WorldEngine/domains/WorldTaskAwarenessFeature.part.js',
  '@src/WorldEngine/domains/WorldChronologyFeature.part.js',
  '@src/WorldEngine/domains/WorldRumorRequestFeature.part.js',
  '@src/WorldEngine/domains/WorldNpcAuditPromptFeature.part.js',
  '@src/WorldEngine/ui/WorldPanelController.part.js',
  '@src/WorldEngine/ui/WorldPanelRenderer.part.js',
  '@src/WorldEngine/ui/WorldEditorController.part.js',
  '@src/WorldEngine/ui/WorldApiPresetController.part.js',
  '@src/WorldEngine/ui/WorldCausalOverviewController.part.js'
]){
  assert.ok(declared.includes(moduleName),`class source module must be registered: ${moduleName}`);
}

assert.equal(fs.existsSync(path.join(root,'script','world-engine-src')),false,'legacy world-engine source directory must be removed');
for(const file of declared){
  assert.ok(fs.existsSync(path.join(root,file.slice(1))),`registered src module must exist: ${file}`);
}

const sourcePath=file=>path.join(root,file.slice(1));
const texts=Object.fromEntries(declared.map(file=>{
  const text=fs.readFileSync(sourcePath(file),'utf8');
  assert.ok(text.length>0,`${file} must not be empty`);
  return [file,text];
}));
const assembled=declared.map(file=>texts[file]).join('');
assert.equal(built,assembled,'script/世界推进系统.js must exactly equal the source parts in build order');
assert.ok(declared.indexOf('@src/WorldEngine/core/WorldEngineFoundation.part.js')<declared.indexOf('@src/WorldEngine/core/WorldSharedUtilities.part.js'),'shared utilities must load immediately after foundation');
assert.ok(declared.indexOf('@src/WorldEngine/core/WorldSharedUtilities.part.js')<declared.indexOf('@src/WorldEngine/core/WorldEngineRuntimeConstants.part.js'),'shared utilities must initialize before runtime constants and domain consumers');
assert.doesNotMatch(texts['@src/WorldEngine/core/WorldEngineFoundation.part.js'],/const\s+(?:copy|plain|same|escape|forbidden)|function\s+digest/,'foundation must remain a pure IIFE boundary');
assert.match(texts['@src/WorldEngine/core/WorldSharedUtilities.part.js'],/function digest\(text\)/,'shared utilities module must own digest');
assert.ok(declared.indexOf('@src/WorldEngine/core/WorldEngineFoundation.part.js')<declared.indexOf('@src/WorldEngine/core/WorldEngineRuntimeConstants.part.js'),'runtime constants must load immediately after foundation');
assert.ok(declared.indexOf('@src/WorldEngine/core/WorldEngineRuntimeConstants.part.js')<declared.indexOf('@src/WorldEngine/ui/WorldThemeCatalog.part.js'),'runtime constants must initialize before theme/runtime consumers');
assert.doesNotMatch(texts['@src/WorldEngine/core/WorldEngineFoundation.part.js'],/EVENT_TARGET|HOT_PERSON_TARGET|TERMINAL_PERSON_STATUS|samsara_world_engine_v1/,'foundation must not re-own runtime policy constants');
assert.match(texts['@src/WorldEngine/core/WorldEngineRuntimeConstants.part.js'],/const EVENT_TARGET = 180;/,'runtime constants module must own lifecycle capacities');
assert.ok(declared.indexOf('@src/WorldEngine/core/WorldEngineFoundation.part.js')<declared.indexOf('@src/WorldEngine/ui/WorldThemeCatalog.part.js'),'theme catalog must load immediately after the foundation boundary');
assert.ok(declared.indexOf('@src/WorldEngine/ui/WorldThemeCatalog.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldTokenTelemetry.part.js'),'theme catalog must initialize before later UI/runtime consumers');
assert.doesNotMatch(texts['@src/WorldEngine/core/WorldEngineFoundation.part.js'],/WORLD_UI_THEMES|WORLD_FONT_SCALES|STATUS_THEME_CONFIG/,'foundation must not re-own UI theme data');
assert.match(texts['@src/WorldEngine/ui/WorldThemeCatalog.part.js'],/const WORLD_UI_THEMES = Object\.freeze/,'UI theme registry must live in the theme catalog');
assert.ok(declared.indexOf('@src/WorldEngine/core/WorldEngineFoundation.part.js')<declared.indexOf('@src/WorldEngine/prompts/WorldBasePromptDefaults.part.js'),'base prompt defaults must load immediately after foundation boundary');
assert.ok(declared.indexOf('@src/WorldEngine/prompts/WorldBasePromptDefaults.part.js')<declared.indexOf('@src/WorldEngine/core/WorldEngineConfigService.part.js'),'base prompt defaults must initialize before configuration consumes them');
const applicationShell=texts['@src/WorldEngine/core/SamsaraWorldEngine.part.js'];
assert.ok(applicationShell.length<9000,'application shell should stay below 9 KB after configuration availability extraction');
assert.doesNotMatch(applicationShell,/this\.style\.textContent\s*=\s*\[/,'base CSS must not grow back into the application shell');
assert.equal(declared.includes('40-engine-runtime.part.js'),false,'legacy runtime shell must leave the build');
assert.equal(declared.includes('50-engine-ui.part.js'),false,'legacy UI shell must leave the build');
assert.match(texts['@src/WorldEngine/ui/WorldEngineStyles.part.js'],/function worldEngineBaseStyleText\(/,'base CSS should live in the src UI resource module');

// Phase 15: event/person lifecycle and the top-level compaction flow live behind one service.
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldTimelinePolicy.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldLifecycleService.part.js'),'lifecycle service must load after timeline/date helpers');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldLifecycleService.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultMaterializer.part.js'),'lifecycle service must load before materialization invokes compactWorldLifecycle');
assert.match(texts['@src/WorldEngine/domains/WorldLifecycleService.part.js'],/class\s+WorldLifecycleService\b/,'world lifecycle rules must live behind a dedicated service');
assert.match(texts['@src/WorldEngine/domains/WorldLifecycleService.part.js'],/compact\(stat\)/,'lifecycle service must own the top-level compaction orchestration');
assert.equal(declared.includes('10-world-state.part.js'),false,'legacy world-state slot must leave the build after state-model migration');
assert.equal(Object.hasOwn(texts,'59-soft-maintenance.part.js'),false,'deleted soft-maintenance legacy module must not return to the build');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldExplorationService.part.js'],/pruneColdExploration\s*=/,'exploration service must not recreate the removed lifecycle pruning seam');

// Phase 17: causal-orbit projection lives in the causal domain.
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldStateNormalizer.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldCausalService.part.js'),'causal projection loads after state normalization');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldCausalService.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultMaterializer.part.js'),'causal service must load before materialization');
assert.match(texts['@src/WorldEngine/domains/WorldCausalService.part.js'],/repairProjection\(stat\)/,'causal service must own orbit projection repair');

// Phase 16: backend migration and event structural repair live behind one state normalizer.
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldLifecycleService.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldStateNormalizer.part.js'),'state normalizer must load after lifecycle seams');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldStateNormalizer.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultMaterializer.part.js'),'state normalizer must load before materialization');
assert.match(texts['@src/WorldEngine/domains/WorldStateNormalizer.part.js'],/class\s+WorldStateNormalizer\b/,'state normalization must have a dedicated class');
assert.match(texts['@src/WorldEngine/domains/WorldStateModel.part.js'],/class\s+WorldRecordCatalog\b/,'state-model module must own shared record definitions');

// Phase 18: timeline snapshot/projection state also belongs to WorldTimelinePolicy.
assert.match(texts['@src/WorldEngine/domains/WorldTimelinePolicy.part.js'],/timelineState\(stat\)/,'timeline policy must own timeline snapshot calculation');
assert.match(texts['@src/WorldEngine/domains/WorldStateModel.part.js'],/class\s+WorldEntityIdentityPolicy\b/,'state-model module must own shared identity rules');

// Phase 13: timeline/time validation helpers are class-owned instead of living in the legacy state monolith.
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldStateModel.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldTimelinePolicy.part.js'),'timeline policy must load after canonical state-model helpers');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldTimelinePolicy.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultMaterializer.part.js'),'timeline policy must load before result materialization uses temporal seams');
assert.match(texts['@src/WorldEngine/domains/WorldTimelinePolicy.part.js'],/class\s+WorldTimelinePolicy\b/,'timeline rules must live behind a dedicated policy class');
assert.match(texts['@src/WorldEngine/domains/WorldStateModel.part.js'],/const\s+RECORDS\s*=DEFAULT_WORLD_RECORD_CATALOG\.records/,'record compatibility constants must be catalog-backed');

// Phase 45: the obsolete numbered WorldResult/context compatibility slots are gone.
assert.equal(declared.includes('20-world-result.part.js'),false,'legacy WorldResult compatibility slot must be removed');
assert.equal(declared.includes('30-context-protocol.part.js'),false,'legacy context-protocol compatibility slot must be removed');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultVocabulary.part.js'],/function\s+(?:normalizeWorldResult|mergeWorldResults|normalizeNamedResultList)\b/,'normalization implementation must stay out of the result vocabulary');
assert.match(texts['@src/WorldEngine/domains/WorldResultNormalizer.part.js'],/class\s+WorldResultNormalizer\b/,'WorldResult normalization must have a dedicated class');
assert.match(texts['@src/WorldEngine/domains/WorldResultNormalizer.part.js'],/normalizeWorldResult\(value\)/,'normalizer class must own WorldResult normalization');
assert.match(texts['@src/WorldEngine/domains/WorldResultNormalizer.part.js'],/mergeWorldResults\(base,incoming\)/,'normalizer class must own staged merge semantics');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultVocabulary.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultContract.part.js'),'contract must load after shared WorldResult constants');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultContract.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultNormalizer.part.js'),'contract must be initialized before downstream WorldResult services');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultVocabulary.part.js'],/function\s+(?:schemaFromSample|namedEntitySchema)\b|const\s+WORLD_RESULT_SCHEMA\s*=/,'schema construction must leave the WorldResult vocabulary');
assert.match(texts['@src/WorldEngine/domains/WorldResultContract.part.js'],/class\s+WorldResultContract\b/,'WorldResult schema must have a dedicated contract class');
assert.match(texts['@src/WorldEngine/domains/WorldResultContract.part.js'],/const\s+WORLD_RESULT_SCHEMA\s*=\s*WORLD_RESULT_CONTRACT\.schema/,'legacy schema constant must be a contract-backed compatibility seam');
assert.match(texts['@src/WorldEngine/domains/WorldResultContract.part.js'],/const\s+EVENT_RESULT_SCHEMA\s*=\s*WORLD_RESULT_CONTRACT\.schemas\.event/,'event schema decorator compatibility must point into the contract');
assert.match(texts['@src/WorldEngine/domains/WorldResultContract.part.js'],/const\s+OFFSET_RESULT_SCHEMA\s*=\s*WORLD_RESULT_CONTRACT\.schemas\.offset/,'offset schema decorator compatibility must point into the contract');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultNormalizer.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultPatchCompilationService.part.js'),'normalizer must initialize before result patch compilation');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultPatchCompilationService.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultMaterializer.part.js'),'result patch compilation service must initialize before the materializer facade');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldAssetMaterializationPolicy.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultContract.part.js'),'asset type policy must initialize before the result contract consumes WORLD_ASSET_TYPES');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldAssetMaterializationPolicy.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultMaterializer.part.js'),'asset materialization policy must initialize before the materializer');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldRumorService.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldStateIntegrityPolicy.part.js'),'state integrity must load after the rumor service it composes');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldStateIntegrityPolicy.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultMaterializer.part.js'),'state integrity policy must initialize before the materializer');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldStateIntegrityPolicy.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldPatchApplicationService.part.js'),'patch application must load after state integrity');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldPatchApplicationService.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldStateMaterializationService.part.js'),'state materialization must load after patch application');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldStateMaterializationService.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultMaterializer.part.js'),'state materialization service must initialize before the materializer facade');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultVocabulary.part.js'],/function\s+(?:compileWorldResult|validateState|applyPatches|materializeWorldUpdate|materializeAssetRecord)\b/,'compile/materialize implementation must leave the WorldResult vocabulary');
assert.match(texts['@src/WorldEngine/domains/WorldResultPatchCompilationService.part.js'],/class\s+WorldResultPatchCompilationService\b/,'WorldResult patch compilation must have a dedicated service class');
assert.match(texts['@src/WorldEngine/domains/WorldResultPatchCompilationService.part.js'],/compile\(stat,value\)/,'patch compilation service must own WorldResult compilation');
assert.match(texts['@src/WorldEngine/domains/WorldStateMaterializationService.part.js'],/class\s+WorldStateMaterializationService\b/,'final world state materialization must have a dedicated service class');
assert.match(texts['@src/WorldEngine/domains/WorldStateMaterializationService.part.js'],/materialize\(stat,seedPatches,modelPatches\)/,'state materialization service must own final repair orchestration');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/class\s+WorldResultMaterializer\b/,'WorldResultMaterializer must remain the compatibility facade');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/compileWorldResult\(stat,value\)\s*\{\s*return this\.patchCompilation\.compile\(stat,value\);\s*\}/,'materializer must preserve a thin compile compatibility facade');
assert.match(texts['@src/WorldEngine/domains/WorldPatchApplicationService.part.js'],/apply\(stat,patches\)/,'patch application service must own patch execution');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/applyPatches\(stat,patches\)\s*\{\s*return this\.stateMaterialization\.apply\(stat,patches\);\s*\}/,'materializer must preserve the public patch-application facade through state materialization');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/materializeWorldUpdate\(stat,seedPatches,modelPatches\)\s*\{\s*return this\.stateMaterialization\.materialize\(stat,seedPatches,modelPatches\);\s*\}/,'materializer must preserve the public final-materialization facade');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/let\s+ACTIVE_WORLD_RESULT_MATERIALIZER\s*=\s*DEFAULT_WORLD_RESULT_MATERIALIZER/,'legacy seams must be backed by the active container-owned materializer');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/function\s+validateState\(stat\)\{return ACTIVE_WORLD_RESULT_MATERIALIZER\.validateBaseState\(stat\);\}/,'legacy validateState compatibility seam must remain available');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/(?<!function\s)validateState\(next\)/,'materializer internals must not route state validation back through the global compatibility seam');
assert.match(texts['@src/WorldEngine/domains/WorldPatchApplicationService.part.js'],/this\.stateIntegrity\.validate\(next\)/,'patch application must validate through the composed state-integrity policy');
assert.match(texts['@src/WorldEngine/domains/WorldStateMaterializationService.part.js'],/this\.validate\(next\)/,'final repair materialization service must retain a state-integrity validation pass');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultMaterializer.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultStagingService.part.js'),'staging service must load after the materializer it composes');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultVocabulary.part.js'],/function\s+(?:worldResultFragments|stageWorldResult|retryPlanForFailure|retryFeedback|makeRetryFailure)\b/,'staging and retry implementation must leave the WorldResult vocabulary');
assert.match(texts['@src/WorldEngine/domains/WorldResultStagingService.part.js'],/class\s+WorldResultStagingService\b/,'WorldResult staged acceptance must have a dedicated service class');
assert.match(texts['@src/WorldEngine/domains/WorldResultStagingService.part.js'],/stage\(stat,accepted,incoming,validate\)/,'staging service must own fragment acceptance');
assert.match(texts['@src/WorldEngine/domains/WorldResultStagingService.part.js'],/let\s+ACTIVE_WORLD_RESULT_STAGING\s*=\s*DEFAULT_WORLD_RESULT_STAGING/,'legacy staging seams must be backed by the active container-owned service');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultStagingService.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultReplyParser.part.js'),'reply parser must load after the staging service');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultVocabulary.part.js'],/function\s+(?:firstCompleteJsonObject|parseReply)\b/,'reply parsing implementation must leave the WorldResult vocabulary');
assert.match(texts['@src/WorldEngine/domains/WorldResultReplyParser.part.js'],/class\s+WorldResultReplyParser\b/,'WorldResult reply parsing must have a dedicated parser class');
assert.match(texts['@src/WorldEngine/domains/WorldResultReplyParser.part.js'],/parse\(text\)/,'reply parser class must own reply parsing');
assert.match(texts['@src/WorldEngine/domains/WorldResultReplyParser.part.js'],/let\s+ACTIVE_WORLD_RESULT_REPLY_PARSER\s*=\s*DEFAULT_WORLD_RESULT_REPLY_PARSER/,'legacy parseReply seam must be backed by the active container-owned parser');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultReplyParser.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldValidationPolicy.part.js'),'validation policy must load after WorldResult reply parsing');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultVocabulary.part.js'],/function\s+(?:ensureDueHandled|unscheduledEvents|ensureEventTimeAnchors|ensureStaleActiveHandled|ensureTemporalAnomaliesResolved|ensureMacroBackbone|progressionAnchorChanged)\b/,'runtime validation implementation must leave the WorldResult vocabulary');
assert.match(texts['@src/WorldEngine/domains/WorldValidationPolicy.part.js'],/class\s+WorldValidationPolicy\b/,'runtime validation helpers must have a dedicated policy class');
assert.match(texts['@src/WorldEngine/domains/WorldValidationPolicy.part.js'],/ensureMacroBackbone\(next,timeline,required=true\)/,'validation policy must own macro backbone validation');
assert.match(texts['@src/WorldEngine/domains/WorldValidationPolicy.part.js'],/let\s+ACTIVE_WORLD_VALIDATION_POLICY\s*=\s*DEFAULT_WORLD_VALIDATION_POLICY/,'legacy validation seams must be backed by the active container-owned policy');

for(const file of [
  '@src/WorldEngine/ui/views/WorldOverviewView.part.js',
  '@src/WorldEngine/ui/views/WorldPeopleView.part.js',
  '@src/WorldEngine/ui/views/WorldExplorationView.part.js',
  '@src/WorldEngine/ui/views/WorldEventArchiveView.part.js',
  '@src/WorldEngine/ui/views/WorldHistoryView.part.js',
  '@src/WorldEngine/ui/views/WorldSettingsView.part.js',
  '@src/WorldEngine/ui/views/WorldPromptView.part.js',
  '@src/WorldEngine/ui/views/WorldRequestInspectorView.part.js'
]){
  assert.doesNotMatch(texts[file],/worldEngineRender(?:WorldTab|PeopleTab|ExplorationTab|WorldEventsTab|RunRecordTab|SettingsTab|PromptTab|RequestInspector)/,file+' must own its renderer instead of delegating to a legacy function');
}

// 本次迁移的关键 seam：replay 随主世界提交一次写入，恢复模块不再额外写第二次。
assert.match(texts['@src/WorldEngine/domains/WorldCommitService.part.js'],/buildWorldReplayPackage/,'primary world commit service must carry replay metadata');
assert.match(texts['@src/WorldEngine/domains/WorldCommitService.part.js'],/__samsaraWorldReplay/,'primary world commit service must persist replay metadata in the same write');
assert.match(texts['@src/WorldEngine/domains/WorldRunOrchestrator.part.js'],/services\?\.commit\?\.persist|services\.commit\.persist/,'run orchestrator must delegate the primary write to WorldCommitService');
assert.match(texts['@src/WorldEngine/domains/WorldReplayService.part.js'],/reprocessContext\(/);
assert.match(texts['@src/WorldEngine/domains/WorldReplayService.part.js'],/legacyPackage\(/);
assert.match(texts['@src/WorldEngine/domains/WorldReplayService.part.js'],/const\s+WORLD_REPLAY_VERSION=1/,'replay contract version must live with the replay service');
assert.match(texts['@src/WorldEngine/domains/WorldReplayService.part.js'],/const\s+WORLD_REPLAY_SCOPES=/,'replay scopes must live with the replay service');

console.log(`world-engine modules synchronized through build declaration (${declared.length} parts)`);
