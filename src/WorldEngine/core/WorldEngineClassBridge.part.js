    const SamsaraWorldEngineBeforeClassServices=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeClassServices {
        constructor(host,env){
            super(host,env);
            this._worldEngineLegacyPrototype=SamsaraWorldEngineBeforeClassServices.prototype;
            this.services=new WorldEngineServiceContainer(this).initialize();
            this.promptRegistry=this.services.prompts;
            this.promptWorkspace=new WorldPromptWorkspaceController(this,this.promptRegistry);
            if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings)){
                const defaults=this.promptRegistry.defaults();
                BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.promptRegistry=defaults;
            }
            this.saveConfig();
        }
        readPromptEditor(){
            const settings=super.readPromptEditor();
            if(!this.promptRegistry)return settings;
            let values=this.promptRegistry.values();
            values.preset=String(settings.preset??values.preset);
            values.core=String(settings.corePrompt??values.core);
            values.macro=String(settings.macroPrompt??values.macro);
            values.stability=String(settings.stabilityPromptTemplate??values.stability);
            values.npcAudit=String(settings.npcAuditPrompt??values.npcAudit);
            values.outputProtocol=String(settings.structurePrompt??values.outputProtocol);
            if(plain(settings.modulePrompts)){
                for(const key of this.promptRegistry.moduleKeys()){
                    if(typeof settings.modulePrompts[key]==='string')values[key]=settings.modulePrompts[key];
                }
                if(typeof settings.modulePrompts.rumor==='string'&&!Object.hasOwn(settings.modulePrompts,'rumorSource'))values.rumorSource=settings.modulePrompts.rumor;
            }
            values=this.promptWorkspace?.read(values)||values;
            settings.promptRegistry=values;
            const modules={};
            for(const key of this.promptRegistry.moduleKeys())modules[key]=values[key];
            modules.rumor=values.rumorSource;
            settings.modulePrompts=Object.assign({},plain(settings.modulePrompts)?settings.modulePrompts:{},modules);
            return settings;
        }
        applyPromptSettings(settings){
            if(!this.promptRegistry)return super.applyPromptSettings(settings);
            const prepared=this.promptRegistry.prepareSettings(settings);
            const result=super.applyPromptSettings(prepared);
            this.promptRegistry.apply(prepared.promptRegistry,{save:false});
            this.saveConfig();
            return result;
        }
        savePromptDocument(name,settings,activate=true){
            if(!this.promptRegistry)return super.savePromptDocument(name,settings,activate);
            const prepared=this.promptRegistry.prepareSettings(settings);
            prepared.promptRegistry=this.promptRegistry.normalize(prepared.promptRegistry);
            return super.savePromptDocument(name,prepared,activate);
        }
        importPromptDocument(raw){
            const doc=super.importPromptDocument(raw);
            if(!doc?.settings||!this.promptRegistry)return doc;
            let parsed=null;try{parsed=JSON.parse(String(raw||''));}catch(_){}
            const source=plain(parsed?.settings)?parsed.settings:parsed;
            const prepared=this.promptRegistry.prepareSettings(Object.assign({},doc.settings,plain(source)?source:{}));
            doc.settings=prepared;
            this.saveConfig();
            return doc;
        }
        async buildRequest(base){
            return this.services.requests.build(base);
        }
        async requestHistoryMemorySummary(world,batch,outputLevel){
            return this.services.history.summarize(world,batch,outputLevel);
        }
        worldEventRecord(name){return this.services.events.get(name);}
        setWorldEventRecord(oldName,newName,record){return this.services.events.save(oldName,newName,record);}
        removeWorldEventRecord(name){return this.services.events.remove(name);}
        worldPersonRecord(name){return this.services.people.get(name);}
        setWorldPersonRecord(name,record){return this.services.people.save(name,record);}
        removeWorldPersonRecord(name){return this.services.people.remove(name);}
        createPanel(){
            super.createPanel();
            if(!this.panel||this.panel.__classPromptRegistryBound)return;
            Object.defineProperty(this.panel,'__classPromptRegistryBound',{value:true,configurable:true});
            this.panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="prompt-edit"]');
                if(!button||!this.panel.contains(button))return;
                queueMicrotask(()=>this.promptWorkspace?.syncEditableState());
            });
        }
        render(force=false){
            const result=super.render(force);
            this.promptWorkspace?.mount();
            this.promptWorkspace?.syncEditableState();
            return result;
        }
    };
