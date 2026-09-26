    const SamsaraWorldEngineBeforeClassServices=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeClassServices {
        constructor(host,env){
            super(host,env);
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
                for(const key of ['task','chronology','maintenance','exploration','integrity','worldTime','rumor']){
                    if(typeof settings.modulePrompts[key]==='string')values[key]=settings.modulePrompts[key];
                }
            }
            values=this.promptWorkspace?.read(values)||values;
            settings.promptRegistry=values;
            settings.modulePrompts=Object.assign({},plain(settings.modulePrompts)?settings.modulePrompts:{},{
                task:values.task,chronology:values.chronology,maintenance:values.maintenance,
                exploration:values.exploration,integrity:values.integrity,worldTime:values.worldTime,rumor:values.rumor
            });
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
            this.promptRegistry?.syncLegacy();
            const request=await super.buildRequest(base);
            if(this.promptRegistry){
                request.system=this.promptRegistry.rewriteSystem(request.system);
                request.manifest=request.manifest||{};
                request.manifest.提示词注册表=this.promptRegistry.list().map(item=>({
                    key:item.key,标题:item.title,分组:item.group,来源:item.source,
                    估算Tokens:estimateTokens(item.value),启用:String(item.value||'').trim()!==''
                }));
                request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            }
            return request;
        }
        async requestHistoryMemorySummary(world,batch,outputLevel){
            if(!this.promptRegistry)return super.requestHistoryMemorySummary(world,batch,outputLevel);
            const savedTransport=this.lastTransportInfo;
            try{
                const raw=await this.requestAI(
                    this.promptRegistry.historySystem(),
                    historyMemoryPrompt(world,batch,outputLevel),
                    {schema:HISTORY_MEMORY_SCHEMA,schemaName:'samsara_world_history_summary_v1',structured:'auto',temperature:0.2}
                );
                return historyMemoryParseReply(raw);
            } finally {
                this.lastTransportInfo=savedTransport;
            }
        }
        persistWorldEditorMutation(mutator,status){return this.services.mutations.commit(mutator,status);}
        worldEditorModeEnabled(){return this.services.editorController.modeEnabled();}
        setWorldEditorMode(value){return this.services.editorController.setMode(value);}
        toggleWorldEditorMode(){return this.services.editorController.toggleMode();}
        worldEditorSection(title){return this.services.editorController.section(title);}
        worldEditorReportError(error,title){return this.services.editorController.reportError(error,title);}
        worldEventRecord(name){return this.services.events.get(name);}
        setWorldEventRecord(oldName,newName,record){return this.services.events.save(oldName,newName,record);}
        removeWorldEventRecord(name){return this.services.events.remove(name);}
        worldPersonRecord(name){return this.services.people.get(name);}
        setWorldPersonRecord(name,record){return this.services.people.save(name,record);}
        removeWorldPersonRecord(name){return this.services.people.remove(name);}
        persistCausalOffsetMutation(mutator,status){return this.services.causal.commit(mutator,status);}
        causalOffsetRecord(name){return this.services.causal.get(name);}
        setCausalOffsetRecord(oldName,newName,record){return this.services.causal.save(oldName,newName,record);}
        removeCausalOffsetRecord(name){return this.services.causal.remove(name);}
        persistHistoryMemoryEdit(kind,name,build,status){return this.services.history.commitEdit(kind,name,build,status);}
        setHistoryAnchorRecord(name,record){return this.services.history.saveAnchor(name,record);}
        setHistorySummaryRecord(name,record){return this.services.history.saveSummary(name,record);}
        createPanel(){
            super.createPanel();
            this.services?.editorController?.bindPanel();
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
            this.services?.editorController?.afterRender();
            return result;
        }
    };
