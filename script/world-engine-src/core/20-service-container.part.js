    class WorldEngineServiceContainer {
        constructor(engine){
            this.engine=engine;
            this.views=new WorldEngineViewRegistry(engine);
            this.mutations=new WorldMutationService(engine);
            this.eventEditor=new WorldEventEditor(engine,this.mutations);
            this.personEditor=new WorldPersonEditor(engine,this.mutations);
            this.prompts=new WorldPromptRegistry(engine);
            this.promptRuntime=new WorldPromptRuntimeAdapter(engine,this.prompts);
            this.features=new WorldEngineFeatureRegistry(engine);
        }
        initialize(){
            this.prompts.initializeConfig();
            this.promptRuntime.initialize();
            this.features.initialize();
            return this;
        }
        afterInit(){this.features.afterInit();}
        bindPanel(){
            this.eventEditor.bindPanel();
            this.personEditor.bindPanel();
            this.features.bindPanel();
        }
        beforeRender(){this.features.beforeRender();}
        afterRender(){
            this.eventEditor.afterRender();
            this.personEditor.afterRender();
            this.features.afterRender();
        }
        async modifyRequest(request,base){return this.features.modifyRequest(request,base);}
        async afterCatalogue(result){return this.features.afterCatalogue(result);}
        dispose(){
            this.features.dispose();
            this.eventEditor.dispose?.();
            this.personEditor.dispose?.();
        }
    }
