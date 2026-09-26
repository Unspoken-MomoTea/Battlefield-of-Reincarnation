    class WorldHistoryView {
        constructor(engine){this.engine=engine;}
        render(context={}){return worldEngineRenderRunRecordTab({...context,engine:this.engine});}
    }
