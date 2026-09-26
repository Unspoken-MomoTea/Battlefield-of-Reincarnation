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
        }
        initialize(){
            this.prompts.initialize();
            this.features.initialize();
            return this;
        }
        afterInit(){this.features.afterInit();}
        bindPanel(){this.features.bindPanel();}
        beforeRender(){this.features.beforeRender();}
        afterRender(){this.features.afterRender();}
        dispose(){this.features.dispose();}
        modifyRequest(request,base){return this.features.modifyRequest(request,base);}
        afterCatalogue(result){return this.features.afterCatalogue(result);}
    }
