    class WorldEngineViewRegistry {
        constructor(engine){
            this.engine=engine;
            this.views=new Map([
                ['world',new WorldOverviewView(engine)],
                ['people',new WorldPeopleView(engine)],
                ['exploration',new WorldExplorationView(engine)],
                ['assets',new WorldAssetView(engine)],
                ['events',new WorldEventArchiveView(engine)],
                ['rumors',new WorldRumorView(engine)],
                ['history',new WorldHistoryView(engine)],
                ['settings',new WorldSettingsView(engine)],
                ['prompts',new WorldPromptView(engine)],
                ['requestInspector',new WorldRequestInspectorView(engine)]
            ]);
        }
        get(key){return this.views.get(key)||null;}
        register(key,view){
            if(!key||!view||typeof view.render!=='function')throw new Error('世界推进 View 注册无效');
            this.views.set(String(key),view);return view;
        }
        render(key,context){
            const view=this.get(key);if(!view)throw new Error('世界推进 View 不存在：'+key);
            return view.render(context);
        }
        keys(){return Array.from(this.views.keys());}
        describe(){return this.keys().map(key=>({key,className:this.get(key)?.constructor?.name||''}));}
    }
