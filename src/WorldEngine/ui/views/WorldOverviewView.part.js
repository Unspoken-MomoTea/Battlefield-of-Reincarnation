    class WorldOverviewView {
        constructor(engine){this.engine=engine;}
        render(context={}){return worldEngineRenderWorldTab({...context,engine:this.engine});}
    }
