    class WorldEngineServiceContainer {
        constructor(engine){
            this.engine=engine;
            this.views=new WorldEngineViewRegistry(engine);
            this.mutations=new WorldMutationService(engine);
            this.eventEditor=new WorldEventEditor(engine,this.mutations);
            this.personEditor=new WorldPersonEditor(engine,this.mutations);
            this.prompts=new WorldPromptRegistry(engine);
        }
        initialize(){
            this.prompts.initializeConfig();
            return this;
        }
        bindPanel(){
            this.eventEditor.bindPanel();
            this.personEditor.bindPanel();
        }
        afterRender(){
            this.eventEditor.afterRender();
            this.personEditor.afterRender();
        }
        dispose(){
            this.eventEditor.dispose?.();
            this.personEditor.dispose?.();
        }
    }
