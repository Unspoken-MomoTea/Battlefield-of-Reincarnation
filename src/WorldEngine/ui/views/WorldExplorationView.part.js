    class WorldExplorationView {
        constructor(engine){this.engine=engine;}
        render(context={}){return worldEngineRenderExplorationTab({...context,engine:this.engine});}
    }
