    class WorldEngineTabView {
        constructor(key,renderer){this.key=key;this.renderer=renderer;}
        render(context){return typeof this.renderer==='function'?this.renderer(context):'';}
    }
    class WorldOverviewView extends WorldEngineTabView {
        constructor(){super('world',worldEngineRenderWorldTab);}
    }
    class WorldPeopleView extends WorldEngineTabView {
        constructor(){super('people',worldEngineRenderPeopleTab);}
    }
    class WorldExplorationView extends WorldEngineTabView {
        constructor(){super('exploration',worldEngineRenderExplorationTab);}
    }
    class WorldEventsView extends WorldEngineTabView {
        constructor(){super('events',worldEngineRenderWorldEventsTab);}
    }
    class WorldHistoryView extends WorldEngineTabView {
        constructor(){super('history',worldEngineRenderRunRecordTab);}
    }
    class WorldSettingsView extends WorldEngineTabView {
        constructor(){super('settings',worldEngineRenderSettingsTab);}
    }
    class WorldPromptView extends WorldEngineTabView {
        constructor(){super('prompts',worldEngineRenderPromptTab);}
    }
    class WorldRequestInspectorView extends WorldEngineTabView {
        constructor(){super('requestInspector',worldEngineRenderRequestInspector);}
    }

    class WorldEngineViewRegistry {
        constructor(engine){
            this.engine=engine;
            this.views=new Map([
                ['world',new WorldOverviewView()],
                ['people',new WorldPeopleView()],
                ['exploration',new WorldExplorationView()],
                ['events',new WorldEventsView()],
                ['history',new WorldHistoryView()],
                ['settings',new WorldSettingsView()],
                ['prompts',new WorldPromptView()],
                ['requestInspector',new WorldRequestInspectorView()]
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
