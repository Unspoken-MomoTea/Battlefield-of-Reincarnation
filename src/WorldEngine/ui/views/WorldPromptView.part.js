    class WorldPromptView {
        constructor(engine){this.engine=engine;}
        render(context={}){return worldEngineRenderPromptTab({...context,engine:this.engine});}
    }
