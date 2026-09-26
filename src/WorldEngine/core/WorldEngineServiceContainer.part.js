    class WorldEngineServiceContainer {
        constructor(engine){
            this.engine=engine;
            this.context=new WorldRuntimeContextService(engine);
            this.knowledge=new WorldKnowledgeService(engine);
            this.requestBuilder=new WorldRequestBuilder(engine);
            this.stateProjector=new WorldStateProjector(engine);
            this.patchPolicy=new WorldPatchPolicy();
            ACTIVE_WORLD_PATCH_POLICY=this.patchPolicy;
            this.timelinePolicy=new WorldTimelinePolicy();
            ACTIVE_WORLD_TIMELINE_POLICY=this.timelinePolicy;
            this.lifecycle=new WorldLifecycleService();
            ACTIVE_WORLD_LIFECYCLE_SERVICE=this.lifecycle;
            this.people=new WorldPersonActivityService(engine);
            ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE=this.people;
            this.stateNormalizer=new WorldStateNormalizer();
            ACTIVE_WORLD_STATE_NORMALIZER=this.stateNormalizer;
            this.causal=new WorldCausalService(engine);
            ACTIVE_WORLD_CAUSAL_SERVICE=this.causal;
            this.resultContract=WORLD_RESULT_CONTRACT;
            this.resultNormalizer=new WorldResultNormalizer();
            this.exploration=new WorldExplorationService(engine);
            ACTIVE_WORLD_EXPLORATION_SERVICE=this.exploration;
            this.resultMaterializer=new WorldResultMaterializer(this.resultNormalizer,this.exploration,this.stateNormalizer,this.causal,this.patchPolicy);
            ACTIVE_WORLD_RESULT_MATERIALIZER=this.resultMaterializer;
            this.resultStaging=new WorldResultStagingService(this.resultNormalizer,this.resultMaterializer);
            ACTIVE_WORLD_RESULT_STAGING=this.resultStaging;
            this.resultParser=new WorldResultReplyParser();
            ACTIVE_WORLD_RESULT_REPLY_PARSER=this.resultParser;
            this.compiler=new WorldResultCompiler(engine,this.resultNormalizer,this.resultMaterializer,this.resultStaging,this.patchPolicy);
            this.validationPolicy=new WorldValidationPolicy(this.timelinePolicy);
            ACTIVE_WORLD_VALIDATION_POLICY=this.validationPolicy;
            this.validation=new WorldValidationService(engine,this.validationPolicy);
            this.commit=new WorldCommitService(engine);
            this.mutations=new WorldMutationService(engine);
            this.events=new WorldEventService(engine);
            this.history=new WorldHistoryService(engine);
            this.rumor=new WorldRumorService(engine);
            this.requests=new WorldRequestService(engine);
            this.transport=engine._apiTransport||new WorldApiTransportService(engine);
            engine._apiTransport=this.transport;
            this.promptDocuments=engine._promptDocuments||new WorldPromptDocumentService(engine);
            engine._promptDocuments=this.promptDocuments;
            this.run=engine._runOrchestrator||new WorldRunOrchestrator(engine);
            engine._runOrchestrator=this.run;
            this.autoProgress=new WorldAutoProgressController(engine);
            this.replay=new WorldReplayService(engine);
            this.timeOwnership=new WorldTimeOwnershipFeature(engine);
            this.npcAuditPolicy=new WorldNpcAuditPolicy(engine);
            this.historyLifecycle=new WorldHistoryLifecycle(engine);
            this.views=new WorldEngineViewRegistry(engine);
            this.prompts=new WorldPromptRegistry(engine);
            this.editorController=new WorldEditorController(engine);
            this.features=new WorldEngineFeatureRegistry(engine);
            this.apiPreset=new WorldApiPresetController(engine);
            this.causalOverview=new WorldCausalOverviewController(engine);
            this.npcAuditPrompt=new WorldNpcAuditPromptFeature(engine);
            this.softMaintenance=new WorldSoftMaintenanceFeature(engine);
            this.integrityRequest=new WorldIntegrityRequestFeature(engine);
            this.worldActivityRequest=new WorldActivityRequestFeature(engine);
            this.dueEvent=new WorldDueEventFeature(engine);
            this.taskAwareness=new WorldTaskAwarenessFeature(engine);
            this.chronology=new WorldChronologyFeature(engine);
            this.rumorRequest=new WorldRumorRequestFeature(engine);
            // Stateful wrappers are registered first so run composition preserves the former
            // history > replay > auto-progress > policy nesting without inheritance.
            this.features.register('historyLifecycle',this.historyLifecycle);
            this.features.register('replay',this.replay);
            this.features.register('autoProgress',this.autoProgress);
            this.features.register('npcAuditPolicy',this.npcAuditPolicy);
            this.features.register('timeOwnership',this.timeOwnership);
            this.features.register('npcAuditPrompt',this.npcAuditPrompt);
            this.features.register('apiPreset',this.apiPreset);
            this.features.register('causalOverview',this.causalOverview);
            this.features.register('softMaintenance',this.softMaintenance);
            this.features.register('integrityRequest',this.integrityRequest);
            this.features.register('worldActivityRequest',this.worldActivityRequest);
            this.features.register('dueEvent',this.dueEvent);
            this.features.register('taskAwareness',this.taskAwareness);
            this.features.register('chronology',this.chronology);
            this.features.register('rumorRequest',this.rumorRequest);
        }
        initialize(){
            this.prompts.initialize();
            this.features.initialize();
            return this;
        }
    }
