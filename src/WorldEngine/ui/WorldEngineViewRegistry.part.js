    class WorldEngineTabView {
        constructor(key,renderer){this.key=key;this.renderer=renderer;}
        render(context){return typeof this.renderer==='function'?this.renderer(context):'';}
    }
    class WorldEngineViewRegistry {
        constructor(engine){
            this.engine=engine;
            this.views=new Map([
                ['world',new WorldEngineTabView('world',worldEngineRenderWorldTab)],
                ['people',new WorldEngineTabView('people',worldEngineRenderPeopleTab)],
                ['exploration',new WorldEngineTabView('exploration',worldEngineRenderExplorationTab)],
                ['events',new WorldEngineTabView('events',worldEngineRenderWorldEventsTab)],
                ['history',new WorldEngineTabView('history',worldEngineRenderRunRecordTab)],
                ['settings',new WorldEngineTabView('settings',worldEngineRenderSettingsTab)],
                ['prompts',new WorldEngineTabView('prompts',worldEngineRenderPromptTab)],
                ['requestInspector',new WorldEngineTabView('requestInspector',worldEngineRenderRequestInspector)]
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
    }
