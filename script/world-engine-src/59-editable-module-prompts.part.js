    // Prompt Registry 最终装配层：业务文件可以保留默认常量，但最终发送文本统一由 WorldPromptRegistry 决定。
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings)){
        const defaults=new WorldPromptRegistry({config:{}}).moduleDefaults();
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=normalizeEditablePreset(COMPACT_DEFAULT_PRESET);
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.corePrompt=COMPACT_CORE_WORLD_RULES;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.macroPrompt=COMPACT_MACRO_PROMPT;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.stabilityPromptTemplate=COMPACT_STABILITY_PROMPT_TEMPLATE;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.modulePrompts=defaults;
    }

    const SamsaraWorldEngineBeforePromptRegistryAdapter=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforePromptRegistryAdapter{
        constructor(host,env){
            super(host,env);
            this.services?.prompts?.initializeConfig();
        }
        readPromptEditor(){
            return this.services.prompts.readPromptEditor(super.readPromptEditor());
        }
        applyPromptSettings(settings){
            const prepared=this.services.prompts.prepareSettings(settings);
            const result=super.applyPromptSettings(prepared);
            this.services.prompts.persistModulePrompts(prepared);
            return result;
        }
        savePromptDocument(name,settings,activate=true){
            return super.savePromptDocument(name,this.services.prompts.decorateSettings(settings),activate);
        }
        importPromptDocument(raw){
            let parsed=null;try{parsed=JSON.parse(String(raw||''));}catch(_){}
            const settings=plain(parsed?.settings)?parsed.settings:parsed;
            const importedModules=plain(settings?.modulePrompts)
                ?{...this.services.prompts.moduleDefaults(),...settings.modulePrompts}
                :this.services.prompts.moduleDefaults();
            const doc=super.importPromptDocument(raw);
            if(doc?.settings){
                doc.settings.modulePrompts=importedModules;
                this.saveConfig();
            }
            return doc;
        }
        async buildRequest(base){
            const request=await super.buildRequest(base);
            const rebuilt=this.services.prompts.composeMainSystem(request.system);
            request.system=rebuilt.system;
            request.manifest=request.manifest||{};
            request.manifest.提示词模块=rebuilt.used;
            request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            return request;
        }
    };
