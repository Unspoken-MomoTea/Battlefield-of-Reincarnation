    class WorldPeopleView {
        constructor(engine){this.engine=engine;}
        render(context={}){return worldEngineRenderPeopleTab({...context,engine:this.engine});}
    }
