    class WorldEngineView {
        constructor(engine){this.engine=engine;}
        render(_ctx){return '';}
    }
    class WorldEngineWorldView extends WorldEngineView {
        render(ctx){return worldEngineRenderWorldTab({...ctx,engine:this.engine});}
    }
    class WorldEnginePeopleView extends WorldEngineView {
        render(ctx){return worldEngineRenderPeopleTab({...ctx,engine:this.engine});}
    }
    class WorldEngineExplorationView extends WorldEngineView {
        render(ctx){return worldEngineRenderExplorationTab({...ctx,engine:this.engine});}
    }
    class WorldEngineArchiveView extends WorldEngineView {
        renderWorldEvents(ctx){return worldEngineRenderWorldEventsTab({...ctx,engine:this.engine});}
        renderHistory(ctx){return worldEngineRenderRunRecordTab({...ctx,engine:this.engine});}
    }
    class WorldEngineSettingsView extends WorldEngineView {
        render(ctx){return worldEngineRenderSettingsTab({...ctx,engine:this.engine});}
    }
    class WorldEnginePromptWorkspaceView extends WorldEngineView {
        render(ctx){return worldEngineRenderPromptTab({...ctx,engine:this.engine});}
    }
    class WorldEngineRequestInspectorView extends WorldEngineView {
        render(ctx){return worldEngineRenderRequestInspector({...ctx,engine:this.engine});}
    }
    class WorldEngineViewRegistry {
        constructor(engine){
            this.engine=engine;
            this.views=new Map([
                ['世界推进',new WorldEngineWorldView(engine)],
                ['角色管理',new WorldEnginePeopleView(engine)],
                ['探索与势力',new WorldEngineExplorationView(engine)],
                ['设置',new WorldEngineSettingsView(engine)],
                ['提示词预设',new WorldEnginePromptWorkspaceView(engine)],
                ['请求检查',new WorldEngineRequestInspectorView(engine)],
            ]);
            this.archive=new WorldEngineArchiveView(engine);
        }
        get(tab){return this.views.get(tab)||null;}
        render(tab,ctx={}){
            if(tab==='世界事件')return this.archive.renderWorldEvents(ctx);
            if(tab==='运行记录')return this.archive.renderHistory(ctx);
            const view=this.get(tab);
            return view?view.render(ctx):null;
        }
        describe(){
            return [
                ...Array.from(this.views,([tab,view])=>({tab,className:view.constructor.name})),
                {tab:'世界事件',className:this.archive.constructor.name},
                {tab:'运行记录',className:this.archive.constructor.name},
            ];
        }
    }
