    class WorldPromptIntegrationService {
        constructor(engine,registry,telemetry){
            this.engine=engine;
            this.registry=registry;
            this.telemetry=telemetry||DEFAULT_WORLD_TOKEN_TELEMETRY;
            this.workspace=null;
        }
        attachWorkspace(workspace){this.workspace=workspace||null;return this.workspace;}
        initializeDefaults(){
            if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings)&&this.registry){
                BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.promptRegistry=this.registry.defaults();
            }
            this.engine.saveConfig();
        }
        readEditor(settings){
            if(!this.registry)return settings;
            let values=this.registry.values();
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
            values=this.workspace?.read(values)||values;
            settings.promptRegistry=values;
            settings.modulePrompts=Object.assign({},plain(settings.modulePrompts)?settings.modulePrompts:{},{
                task:values.task,chronology:values.chronology,maintenance:values.maintenance,
                exploration:values.exploration,integrity:values.integrity,worldTime:values.worldTime,rumor:values.rumor
            });
            return settings;
        }
        prepareApply(settings){return this.registry?this.registry.prepareSettings(settings):settings;}
        afterApply(prepared,result){
            if(!this.registry)return result;
            this.registry.apply(prepared.promptRegistry,{save:false});
            this.engine.services?.npcAuditPolicy?.afterPromptSettings?.();
            this.engine.saveConfig();
            return result;
        }
        prepareDocument(settings){
            if(!this.registry)return settings;
            const prepared=this.registry.prepareSettings(settings);
            prepared.promptRegistry=this.registry.normalize(prepared.promptRegistry);
            return prepared;
        }
        importDocument(doc,raw){
            if(!doc?.settings||!this.registry)return doc;
            let parsed=null;try{parsed=JSON.parse(String(raw||''));}catch(_){}
            const source=plain(parsed?.settings)?parsed.settings:parsed;
            doc.settings=this.registry.prepareSettings(Object.assign({},doc.settings,plain(source)?source:{}));
            this.engine.saveConfig();
            return doc;
        }
        beforeBuildRequest(){this.registry?.syncLegacy();}
        decorateRequest(request){
            if(!this.registry)return request;
            request.system=this.registry.rewriteSystem(request.system);
            request.input=this.registry.rewriteInput(request.input);
            request.manifest=request.manifest||{};
            request.manifest.提示词注册表=this.registry.list().map(item=>({
                key:item.key,标题:item.title,分组:item.group,来源:item.source,作用范围:item.scope,发送条件:item.condition,
                估算Tokens:this.telemetry.estimate(item.value),启用:String(item.value||'').trim()!==''
            }));
            request.manifest.提示词模块=this.registry.list()
                .filter(item=>item.group==='运行模块'&&item.scope==='system'&&String(item.value||'').trim())
                .map(item=>({key:item.key,title:item.title,source:item.source,估算Tokens:this.telemetry.estimate(item.value)}));
            request.manifest.观测=this.telemetry.request(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            return request;
        }
        bindPanel(panel){
            if(!panel||panel.__classPromptRegistryBound)return;
            Object.defineProperty(panel,'__classPromptRegistryBound',{value:true,configurable:true});
            panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="prompt-edit"]');
                if(!button||!panel.contains(button))return;
                queueMicrotask(()=>this.workspace?.syncEditableState());
            });
        }
        afterRender(){
            this.workspace?.mount();
            this.workspace?.syncEditableState();
        }
    }
