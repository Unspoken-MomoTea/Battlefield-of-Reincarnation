    class WorldEngineServiceContainer {
        constructor(engine){
            this.engine=engine;
            this.hostAdapter=engine.hostAdapter;
            this.configuration=engine.configService;
            this.runScheduler=engine._runScheduler||new WorldRunScheduler(engine);
            engine._runScheduler=this.runScheduler;
            this.applicationLifecycle=new WorldEngineLifecycleController(engine);
            this.context=new WorldRuntimeContextService(engine);
            this.knowledgeSelection=new WorldKnowledgeSelectionPolicy();
            ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY=this.knowledgeSelection;
            this.knowledge=new WorldKnowledgeService(engine,this.knowledgeSelection);
            this.tokenTelemetry=new WorldTokenTelemetry();
            ACTIVE_WORLD_TOKEN_TELEMETRY=this.tokenTelemetry;
            this.proseExtractor=new WorldProseExtractor();
            ACTIVE_WORLD_PROSE_EXTRACTOR=this.proseExtractor;
            this.requestBuilder=new WorldRequestBuilder(engine,this.proseExtractor,this.tokenTelemetry);
            this.stateFactory=new WorldStateFactory();
            this.taskLedger=new WorldTaskAwarenessService();
            this.historyMemory=new WorldHistoryMemoryPolicy();
            ACTIVE_WORLD_HISTORY_MEMORY_POLICY=this.historyMemory;
            this.history=new WorldHistoryService(engine,this.historyMemory);
            this.stateProjector=new WorldStateProjector(engine,this.taskLedger,this.history);
            ACTIVE_WORLD_STATE_PROJECTOR=this.stateProjector;
            this.patchPolicy=new WorldPatchPolicy();
            ACTIVE_WORLD_PATCH_POLICY=this.patchPolicy;
            this.timePolicy=new WorldTimePolicy();
            ACTIVE_WORLD_TIME_POLICY=this.timePolicy;
            this.dueEventPolicy=new WorldDueEventPolicy(this.timePolicy);
            this.activityPolicy=new WorldActivityPolicy();
            this.timelinePolicy=new WorldTimelinePolicy(this.timePolicy);
            ACTIVE_WORLD_TIMELINE_POLICY=this.timelinePolicy;
            this.softMaintenancePolicy=new WorldSoftMaintenancePolicy(this.timelinePolicy);
            ACTIVE_WORLD_SOFT_MAINTENANCE_POLICY=this.softMaintenancePolicy;
            this.chronologyPolicy=new WorldChronologyPolicy();
            this.lifecycle=new WorldLifecycleService();
            ACTIVE_WORLD_LIFECYCLE_SERVICE=this.lifecycle;
            this.people=new WorldPersonActivityService(engine,this.timePolicy);
            ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE=this.people;
            this.npcAudit=new WorldNpcAuditService();
            ACTIVE_WORLD_NPC_AUDIT_SERVICE=this.npcAudit;
            this.stateNormalizer=new WorldStateNormalizer();
            ACTIVE_WORLD_STATE_NORMALIZER=this.stateNormalizer;
            this.causal=new WorldCausalService(engine,this.patchPolicy);
            ACTIVE_WORLD_CAUSAL_SERVICE=this.causal;
            this.resultContract=WORLD_RESULT_CONTRACT;
            this.resultNormalizer=new WorldResultNormalizer();
            this.relationSync=new WorldRelationSyncPolicy();
            this.assetMaterialization=new WorldAssetMaterializationPolicy();
            this.exploration=new WorldExplorationService(engine);
            ACTIVE_WORLD_EXPLORATION_SERVICE=this.exploration;
            this.rumor=new WorldRumorService(engine);
            this.resultPatchCompilation=new WorldResultPatchCompilationService(
                this.resultNormalizer,
                this.exploration,
                this.causal,
                this.patchPolicy,
                this.npcAudit,
                this.people,
                this.taskLedger,
                this.chronologyPolicy,
                this.timePolicy,
                this.relationSync,
                this.assetMaterialization
            );
            this.stateIntegrity=new WorldStateIntegrityPolicy(this.patchPolicy,this.timePolicy,this.rumor);
            this.patchApplication=new WorldPatchApplicationService(this.patchPolicy,this.stateNormalizer,this.timelinePolicy,this.stateIntegrity,this.relationSync,this.rumor);
            this.stateMaterialization=new WorldStateMaterializationService(
                this.stateFactory,
                this.stateNormalizer,
                this.lifecycle,
                this.patchPolicy,
                this.patchApplication,
                this.exploration,
                this.causal,
                this.stateIntegrity
            );
            this.resultMaterializer=new WorldResultMaterializer(this.resultPatchCompilation,this.stateMaterialization);
            ACTIVE_WORLD_RESULT_MATERIALIZER=this.resultMaterializer;
            this.retryGuidance=new WorldRetryGuidanceService(engine);
            this.resultStaging=new WorldResultStagingService(this.resultNormalizer,this.resultMaterializer,this.chronologyPolicy,this.retryGuidance,this.rumor);
            ACTIVE_WORLD_RESULT_STAGING=this.resultStaging;
            this.resultParser=new WorldResultReplyParser();
            ACTIVE_WORLD_RESULT_REPLY_PARSER=this.resultParser;
            this.compiler=new WorldResultCompiler(engine,this.resultNormalizer,this.resultMaterializer,this.resultStaging,this.patchPolicy);
            this.validationPolicy=new WorldValidationPolicy(this.timelinePolicy,this.dueEventPolicy,this.activityPolicy,this.softMaintenancePolicy);
            ACTIVE_WORLD_VALIDATION_POLICY=this.validationPolicy;
            this.validation=new WorldValidationService(engine,this.validationPolicy,this.npcAudit);
            this.commit=new WorldCommitService(engine);
            this.mutations=new WorldMutationService(engine);
            this.snapshots=new WorldSnapshotService(engine,this.mutations);
            this.events=new WorldEventService(engine);
            this.requests=new WorldRequestService(engine);
            ACTIVE_WORLD_REQUEST_SERVICE=this.requests;
            this.transport=engine._apiTransport||new WorldApiTransportService(engine,this.tokenTelemetry);
            this.transport.telemetry=this.tokenTelemetry;
            engine._apiTransport=this.transport;
            this.promptDocuments=engine._promptDocuments||new WorldPromptDocumentService(engine);
            engine._promptDocuments=this.promptDocuments;
            this.run=engine._runOrchestrator||new WorldRunOrchestrator(engine);
            engine._runOrchestrator=this.run;
            this.autoProgress=new WorldAutoProgressController(engine);
            this.replay=new WorldReplayService(engine);
            this.manualAdvance=new WorldManualAdvanceFeature(engine);
            this.timeOwnership=new WorldTimeOwnershipFeature(engine,this.timePolicy);
            this.npcAuditPolicy=new WorldNpcAuditPolicy(engine,this.knowledgeSelection);
            this.historyLifecycle=new WorldHistoryLifecycle(engine,this.historyMemory);
            this.views=new WorldEngineViewRegistry(engine);
            this.prompts=new WorldPromptRegistry(engine);
            this.promptIntegration=new WorldPromptIntegrationService(engine,this.prompts,this.tokenTelemetry);
            this.panelController=new WorldPanelController(engine);
            this.panelRenderer=new WorldPanelRenderer(engine);
            this.editorController=new WorldEditorController(engine);
            this.features=new WorldEngineFeatureRegistry(engine);
            this.apiPreset=new WorldApiPresetController(engine);
            this.causalOverview=new WorldCausalOverviewController(engine);
            this.npcAuditPrompt=new WorldNpcAuditPromptFeature(engine);
            this.softMaintenance=new WorldSoftMaintenanceFeature(engine);
            this.integrityRequest=new WorldIntegrityRequestFeature(engine);
            this.worldActivityRequest=new WorldActivityRequestFeature(engine,this.activityPolicy);
            this.dueEvent=new WorldDueEventFeature(engine,this.dueEventPolicy);
            this.taskAwareness=new WorldTaskAwarenessFeature(engine,this.taskLedger,this.knowledgeSelection);
            this.chronology=new WorldChronologyFeature(engine,this.chronologyPolicy,this.knowledgeSelection);
            this.rumorRequest=new WorldRumorRequestFeature(engine,this.rumor);
            // Stateful wrappers are registered first so run composition preserves the former
            // history > replay > auto-progress > policy nesting without inheritance.
            this.features.register('historyLifecycle',this.historyLifecycle);
            this.features.register('replay',this.replay);
            this.features.register('manualAdvance',this.manualAdvance);
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
