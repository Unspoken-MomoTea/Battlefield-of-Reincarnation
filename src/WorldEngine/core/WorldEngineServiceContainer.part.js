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
        }
        initialize(){
            this.prompts.initialize();
            return this;
        }
    }
