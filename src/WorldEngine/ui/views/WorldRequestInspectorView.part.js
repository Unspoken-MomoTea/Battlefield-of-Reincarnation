    class WorldRequestInspectorView {
        constructor(engine){this.engine=engine;}
        render(context={}){return worldEngineRenderRequestInspector({...context,engine:this.engine});}
    }
