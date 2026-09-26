const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const dir=path.join(root,'script','world-engine-src');
const buildScript=fs.readFileSync(path.join(root,'tools','build-world-engine.py'),'utf8');
const built=fs.readFileSync(path.join(root,'script','世界推进系统.js'),'utf8');

// 以真实构建器声明的 PARTS 作为模块清单，避免测试自己维护第二份、最终与构建流程漂移的文件列表。
const partsBlock=buildScript.match(/PARTS\s*=\s*\(([\s\S]*?)\)\n\n/);
assert.ok(partsBlock,'build-world-engine.py must declare PARTS');
const declared=[...partsBlock[1].matchAll(/'([^']+\.part\.js)'/g)].map(match=>match[1]);
assert.ok(declared.length>=10,'world engine should be assembled from modular source parts');
assert.equal(new Set(declared).size,declared.length,'build PARTS must not contain duplicate modules');
for(const moduleName of ['ui/00-styles.part.js','editor/00-world-mutations.part.js','editor/10-event-editor.part.js','editor/20-person-editor.part.js']){
  assert.ok(declared.includes(moduleName),`domain module must be registered: ${moduleName}`);
}
for(const moduleName of [
  '@src/WorldEngine/core/WorldEngineServiceContainer.part.js',
  '@src/WorldEngine/core/WorldEngineFeatureRegistry.part.js',
  '@src/WorldEngine/core/WorldEngineClassBridge.part.js',
  '@src/WorldEngine/domains/WorldRuntimeContextService.part.js',
  '@src/WorldEngine/domains/WorldKnowledgeService.part.js',
  '@src/WorldEngine/domains/WorldRequestBuilder.part.js',
  '@src/WorldEngine/domains/WorldStateProjector.part.js',
  '@src/WorldEngine/domains/WorldResultKernel.part.js',
  '@src/WorldEngine/domains/WorldExplorationService.part.js',
  '@src/WorldEngine/domains/WorldResultContract.part.js',
  '@src/WorldEngine/domains/WorldResultNormalizer.part.js',
  '@src/WorldEngine/domains/WorldResultMaterializer.part.js',
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
  '@src/WorldEngine/ui/WorldEditorController.part.js',
  '@src/WorldEngine/ui/WorldApiPresetController.part.js',
  '@src/WorldEngine/ui/WorldCausalOverviewController.part.js'
]){
  assert.ok(declared.includes(moduleName),`class source module must be registered: ${moduleName}`);
}

function sourcePartsUnder(base,relative=''){
  const out=[];
  for(const entry of fs.readdirSync(path.join(base,relative),{withFileTypes:true})){
    const next=relative?path.join(relative,entry.name):entry.name;
    if(entry.isDirectory())out.push(...sourcePartsUnder(base,next));
    else if(entry.isFile()&&entry.name.endsWith('.part.js'))out.push(next.split(path.sep).join('/'));
  }
  return out;
}
const legacyDeclared=declared.filter(file=>!file.startsWith('@'));
const srcDeclared=declared.filter(file=>file.startsWith('@'));
const actual=sourcePartsUnder(dir).sort();
assert.deepEqual([...legacyDeclared].sort(),actual,'every legacy world-engine source part must be registered in the real build pipeline');
for(const file of srcDeclared){
  assert.ok(fs.existsSync(path.join(root,file.slice(1))),`registered src module must exist: ${file}`);
}

const sourcePath=file=>file.startsWith('@')?path.join(root,file.slice(1)):path.join(dir,...file.split('/'));
const texts=Object.fromEntries(declared.map(file=>{
  const text=fs.readFileSync(sourcePath(file),'utf8');
  assert.ok(text.length>0,`${file} must not be empty`);
  return [file,text];
}));
const assembled=declared.map(file=>texts[file]).join('');
assert.equal(built,assembled,'script/世界推进系统.js must exactly equal the source parts in build order');
assert.ok(texts['50-engine-ui.part.js'].length<50000,'main UI class should stay below 50 KB after control-tab extraction');
assert.doesNotMatch(texts['50-engine-ui.part.js'],/this\.style\.textContent\s*=\s*\[/,'base CSS must not grow back into the main UI class');
assert.match(texts['ui/00-styles.part.js'],/function worldEngineBaseStyleText\(/,'base CSS should live in a dedicated UI resource module');

// Phase 12: the real WorldResult implementation must live under src/WorldEngine, not in the legacy numbered source tree.
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultKernel.part.js')<declared.indexOf('20-world-result.part.js'),'WorldResult kernel must load at the former legacy slot before its compatibility shim');
assert.ok(texts['20-world-result.part.js'].length<1000,'legacy WorldResult part must stay a thin compatibility shim');
assert.doesNotMatch(texts['20-world-result.part.js'],/function\s+(?:normalizeWorldResult|compileWorldResult|materializeWorldUpdate)\b/,'legacy WorldResult shim must not regain domain implementation');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultKernel.part.js'],/function\s+(?:normalizeWorldResult|mergeWorldResults|normalizeNamedResultList)\b/,'normalization implementation must leave the kernel after class extraction');
assert.match(texts['@src/WorldEngine/domains/WorldResultNormalizer.part.js'],/class\s+WorldResultNormalizer\b/,'WorldResult normalization must have a dedicated class');
assert.match(texts['@src/WorldEngine/domains/WorldResultNormalizer.part.js'],/normalizeWorldResult\(value\)/,'normalizer class must own WorldResult normalization');
assert.match(texts['@src/WorldEngine/domains/WorldResultNormalizer.part.js'],/mergeWorldResults\(base,incoming\)/,'normalizer class must own staged merge semantics');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultKernel.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldExplorationService.part.js'),'exploration service must load after shared WorldResult defaults');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldExplorationService.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultContract.part.js'),'exploration compatibility seams must exist before WorldResult compilation services');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultKernel.part.js'],/MICRO_EXPLORATION_SEGMENT|function\s+(?:explorationGranularity|repairExplorationGranularity)\b/,'exploration granularity implementation must leave the WorldResult kernel');
assert.match(texts['@src/WorldEngine/domains/WorldExplorationService.part.js'],/class\s+WorldExplorationService\b/,'exploration granularity must live in the exploration domain service');
assert.match(texts['@src/WorldEngine/domains/WorldExplorationService.part.js'],/repairGranularity\(stat\)/,'exploration service must own legacy granularity repair');
assert.match(texts['@src/WorldEngine/domains/WorldExplorationService.part.js'],/let\s+ACTIVE_WORLD_EXPLORATION_SERVICE\s*=\s*DEFAULT_WORLD_EXPLORATION_SERVICE/,'legacy exploration seams must be backed by the active service');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultKernel.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultContract.part.js'),'contract must load after shared WorldResult constants');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultContract.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultNormalizer.part.js'),'contract must be initialized before downstream WorldResult services');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultKernel.part.js'],/function\s+(?:schemaFromSample|namedEntitySchema)\b|const\s+WORLD_RESULT_SCHEMA\s*=/,'schema construction must leave the WorldResult kernel');
assert.match(texts['@src/WorldEngine/domains/WorldResultContract.part.js'],/class\s+WorldResultContract\b/,'WorldResult schema must have a dedicated contract class');
assert.match(texts['@src/WorldEngine/domains/WorldResultContract.part.js'],/const\s+WORLD_RESULT_SCHEMA\s*=\s*WORLD_RESULT_CONTRACT\.schema/,'legacy schema constant must be a contract-backed compatibility seam');
assert.match(texts['@src/WorldEngine/domains/WorldResultContract.part.js'],/const\s+EVENT_RESULT_SCHEMA\s*=\s*WORLD_RESULT_CONTRACT\.schemas\.event/,'event schema decorator compatibility must point into the contract');
assert.match(texts['@src/WorldEngine/domains/WorldResultContract.part.js'],/const\s+OFFSET_RESULT_SCHEMA\s*=\s*WORLD_RESULT_CONTRACT\.schemas\.offset/,'offset schema decorator compatibility must point into the contract');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultNormalizer.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultMaterializer.part.js'),'normalizer must initialize before the materializer');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultKernel.part.js'],/function\s+(?:compileWorldResult|validateState|applyPatches|materializeWorldUpdate|materializeAssetRecord)\b/,'compile/materialize implementation must leave the WorldResult kernel');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/class\s+WorldResultMaterializer\b/,'WorldResult patch compilation must have a dedicated materializer class');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/compileWorldResult\(stat,value\)/,'materializer must own WorldResult compilation');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/applyPatches\(stat,patches\)/,'materializer must own patch application');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/materializeWorldUpdate\(stat,seedPatches,modelPatches\)/,'materializer must own final world materialization');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/let\s+ACTIVE_WORLD_RESULT_MATERIALIZER\s*=\s*DEFAULT_WORLD_RESULT_MATERIALIZER/,'legacy seams must be backed by the active container-owned materializer');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/function\s+validateState\(stat\)\{return ACTIVE_WORLD_RESULT_MATERIALIZER\.validateBaseState\(stat\);\}/,'legacy validateState must remain a reassignable decorator seam');
assert.match(texts['@src/WorldEngine/domains/WorldResultMaterializer.part.js'],/validateState\(next\)/,'patch application must honor dynamically decorated validateState');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultMaterializer.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultStagingService.part.js'),'staging service must load after the materializer it composes');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultStagingService.part.js')<declared.indexOf('20-world-result.part.js'),'staging compatibility seams must load before the legacy WorldResult slot');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultKernel.part.js'],/function\s+(?:worldResultFragments|stageWorldResult|retryPlanForFailure|retryFeedback|makeRetryFailure)\b/,'staging and retry implementation must leave the WorldResult kernel');
assert.match(texts['@src/WorldEngine/domains/WorldResultStagingService.part.js'],/class\s+WorldResultStagingService\b/,'WorldResult staged acceptance must have a dedicated service class');
assert.match(texts['@src/WorldEngine/domains/WorldResultStagingService.part.js'],/stage\(stat,accepted,incoming,validate\)/,'staging service must own fragment acceptance');
assert.match(texts['@src/WorldEngine/domains/WorldResultStagingService.part.js'],/let\s+ACTIVE_WORLD_RESULT_STAGING\s*=\s*DEFAULT_WORLD_RESULT_STAGING/,'legacy staging seams must be backed by the active container-owned service');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultStagingService.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldResultReplyParser.part.js'),'reply parser must load after the staging service');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultReplyParser.part.js')<declared.indexOf('20-world-result.part.js'),'reply parser compatibility seam must load before the legacy WorldResult slot');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultKernel.part.js'],/function\s+(?:firstCompleteJsonObject|parseReply)\b/,'reply parsing implementation must leave the WorldResult kernel');
assert.match(texts['@src/WorldEngine/domains/WorldResultReplyParser.part.js'],/class\s+WorldResultReplyParser\b/,'WorldResult reply parsing must have a dedicated parser class');
assert.match(texts['@src/WorldEngine/domains/WorldResultReplyParser.part.js'],/parse\(text\)/,'reply parser class must own reply parsing');
assert.match(texts['@src/WorldEngine/domains/WorldResultReplyParser.part.js'],/let\s+ACTIVE_WORLD_RESULT_REPLY_PARSER\s*=\s*DEFAULT_WORLD_RESULT_REPLY_PARSER/,'legacy parseReply seam must be backed by the active container-owned parser');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldResultReplyParser.part.js')<declared.indexOf('@src/WorldEngine/domains/WorldValidationPolicy.part.js'),'validation policy must load after WorldResult reply parsing');
assert.ok(declared.indexOf('@src/WorldEngine/domains/WorldValidationPolicy.part.js')<declared.indexOf('20-world-result.part.js'),'validation compatibility seams must load before legacy decorators');
assert.doesNotMatch(texts['@src/WorldEngine/domains/WorldResultKernel.part.js'],/function\s+(?:ensureDueHandled|unscheduledEvents|ensureEventTimeAnchors|ensureStaleActiveHandled|ensureTemporalAnomaliesResolved|ensureMacroBackbone|progressionAnchorChanged)\b/,'runtime validation implementation must leave the WorldResult kernel');
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
assert.doesNotMatch(texts['59-world-replay-persistence.part.js'],/SamsaraWorldEngine\s*=\s*class/,'replay persistence legacy shim must not recreate an inheritance layer');
for(const file of legacyDeclared)assert.doesNotMatch(texts[file],/SamsaraWorldEngine\s*=\s*class/,file+' must not add another SamsaraWorldEngine inheritance layer');

console.log(`world-engine modules synchronized through build declaration (${declared.length} parts)`);
