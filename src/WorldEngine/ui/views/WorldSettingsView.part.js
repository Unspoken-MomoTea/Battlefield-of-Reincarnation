    class WorldSettingsView {
        constructor(engine){this.engine=engine;}
        render(context={}){return worldEngineRenderSettingsTab({...context,engine:this.engine});}
    }
