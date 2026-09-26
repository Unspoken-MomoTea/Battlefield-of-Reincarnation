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
        bindPanel(){this.editorController.bindPanel();this.features.bindPanel();}
        beforeRender(){this.features.beforeRender();}
        afterRender(){this.editorController.afterRender();this.features.afterRender();}
        async modifyRequest(request,base){return this.features.modifyRequest(request,base);}
        async afterCatalogue(result){return this.features.afterCatalogue(result);}
        async beforeRun(context){return this.features.beforeRun(context);}
        async afterRun(context){return this.features.afterRun(context);}
        dispose(){this.features.dispose();this.editorController.dispose?.();}
    }
