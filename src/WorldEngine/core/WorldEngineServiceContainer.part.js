    class WorldEngineServiceContainer {
        constructor(engine){
            this.engine=engine;
            this.mutations=new WorldMutationService(engine);
            this.events=new WorldEventService(engine);
            this.people=new WorldPersonActivityService(engine);
            this.history=new WorldHistoryService(engine);
            this.exploration=new WorldExplorationService(engine);
            this.rumor=new WorldRumorService(engine);
            this.requests=new WorldRequestService(engine);
            this.prompts=new WorldPromptRegistry(engine);
        }
        initialize(){
            this.prompts.initialize();
            return this;
        }
    }
