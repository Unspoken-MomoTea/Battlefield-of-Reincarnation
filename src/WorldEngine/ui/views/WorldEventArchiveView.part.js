    class WorldEventArchiveView {
        constructor(engine){this.engine=engine;}
        render(context={}){return worldEngineRenderWorldEventsTab({...context,engine:this.engine});}
    }
