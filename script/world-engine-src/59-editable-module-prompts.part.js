    // Prompt Registry 最终装配层：业务文件保留默认常量，最终发送文本统一由组合式 Prompt 服务决定。
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings)){
        const defaults=new WorldPromptRegistry({config:{}}).moduleDefaults();
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=normalizeEditablePreset(COMPACT_DEFAULT_PRESET);
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.corePrompt=COMPACT_CORE_WORLD_RULES;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.macroPrompt=COMPACT_MACRO_PROMPT;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.stabilityPromptTemplate=COMPACT_STABILITY_PROMPT_TEMPLATE;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.modulePrompts=defaults;
    }

    class WorldPromptRuntimeAdapter {
        constructor(engine,registry){this.engine=engine;this.registry=registry;}
        initialize(){this.registry.initializeConfig();return this;}
        readEditor(baseSettings){return this.registry.readPromptEditor(baseSettings);}
        applySettings(baseApply,settings){
            const prepared=this.registry.prepareSettings(settings);
            const result=baseApply(prepared);
            this.registry.persistModulePrompts(prepared);
            return result;
        }
        saveDocument(baseSave,name,settings,activate=true){
            return baseSave(name,this.registry.decorateSettings(settings),activate);
        }
        importDocument(baseImport,raw){
            let parsed=null;try{parsed=JSON.parse(String(raw||''));}catch(_){}
            const settings=plain(parsed?.settings)?parsed.settings:parsed;
            const importedModules=plain(settings?.modulePrompts)
                ?{...this.registry.moduleDefaults(),...settings.modulePrompts}
                :this.registry.moduleDefaults();
            const doc=baseImport(raw);
            if(doc?.settings){
                doc.settings.modulePrompts=importedModules;
                this.engine.saveConfig();
            }
            return doc;
        }
        finalizeRequest(request){
            const rebuilt=this.registry.composeMainSystem(request.system);
            request.system=rebuilt.system;
            request.manifest=request.manifest||{};
            request.manifest.提示词模块=rebuilt.used;
            request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            return request;
        }
    }

    const promptReadBase=SamsaraWorldEngine.prototype.readPromptEditor;
    const promptApplyBase=SamsaraWorldEngine.prototype.applyPromptSettings;
    const promptSaveBase=SamsaraWorldEngine.prototype.savePromptDocument;
    const promptImportBase=SamsaraWorldEngine.prototype.importPromptDocument;
    const promptBuildBase=SamsaraWorldEngine.prototype.buildRequest;

    SamsaraWorldEngine.prototype.readPromptEditor=function(){
        const base=promptReadBase.call(this);
        return this.services.promptRuntime.readEditor(base);
    };
    SamsaraWorldEngine.prototype.applyPromptSettings=function(settings){
        return this.services.promptRuntime.applySettings(
            prepared=>promptApplyBase.call(this,prepared),
            settings
        );
    };
    SamsaraWorldEngine.prototype.savePromptDocument=function(name,settings,activate=true){
        return this.services.promptRuntime.saveDocument(
            (nextName,nextSettings,nextActivate)=>promptSaveBase.call(this,nextName,nextSettings,nextActivate),
            name,settings,activate
        );
    };
    SamsaraWorldEngine.prototype.importPromptDocument=function(raw){
        return this.services.promptRuntime.importDocument(
            value=>promptImportBase.call(this,value),
            raw
        );
    };
    SamsaraWorldEngine.prototype.buildRequest=async function(base){
        const request=await promptBuildBase.call(this,base);
        return this.services.promptRuntime.finalizeRequest(request);
    };
