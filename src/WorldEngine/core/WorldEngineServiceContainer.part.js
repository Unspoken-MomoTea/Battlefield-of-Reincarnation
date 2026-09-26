    class WorldEngineServiceContainer {
        constructor(engine){
            this.engine=engine;
            this.mutations=new WorldMutationService(engine);
            this.events=new WorldEventService(engine);
            this.people=new WorldPersonActivityService(engine);
            this.history=new WorldHistoryService(engine);
            this.causal=new WorldCausalService(engine);
            this.exploration=new WorldExplorationService(engine);
            this.rumor=new WorldRumorService(engine);
            this.requests=new WorldRequestService(engine);
            this.views=new WorldEngineViewRegistry(engine);
            this.prompts=new WorldPromptRegistry(engine);
            this.editorController=new WorldEditorController(engine);
            this.features=new WorldEngineFeatureRegistry(engine);
            this.apiPreset=new WorldApiPresetController(engine);
            this.causalOverview=new WorldCausalOverviewController(engine);
            this.npcAuditPrompt=new WorldNpcAuditPromptFeature(engine);
            this.features.register('npcAuditPrompt',this.npcAuditPrompt);
            this.features.register('apiPreset',this.apiPreset);
            this.features.register('causalOverview',this.causalOverview);
        }
        initialize(){
            this.prompts.initialize();
            this.features.initialize();
            return this;
        }
    }
