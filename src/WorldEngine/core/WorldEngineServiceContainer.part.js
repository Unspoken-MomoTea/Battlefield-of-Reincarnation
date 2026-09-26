    class WorldEngineServiceContainer {
        constructor(engine){
            this.engine=engine;
            this.context=new WorldRuntimeContextService(engine);
            this.knowledge=new WorldKnowledgeService(engine);
            this.requestBuilder=new WorldRequestBuilder(engine);
            this.stateProjector=new WorldStateProjector(engine);
            this.resultContract=WORLD_RESULT_CONTRACT;
            this.resultNormalizer=new WorldResultNormalizer();
            this.resultMaterializer=new WorldResultMaterializer(this.resultNormalizer);
            ACTIVE_WORLD_RESULT_MATERIALIZER=this.resultMaterializer;
            this.compiler=new WorldResultCompiler(engine,this.resultNormalizer,this.resultMaterializer);
            this.validation=new WorldValidationService(engine);
            this.commit=new WorldCommitService(engine);
            this.mutations=new WorldMutationService(engine);
            this.events=new WorldEventService(engine);
            this.people=new WorldPersonActivityService(engine);
            this.history=new WorldHistoryService(engine);
            this.causal=new WorldCausalService(engine);
            this.exploration=new WorldExplorationService(engine);
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
