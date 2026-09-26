    // Prompt Registry 兼容桥：旧公开方法保留，但所有提示词来源/持久化/最终注入统一交给 WorldPromptRegistry。
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings)){
        const registryDefaults=new WorldPromptRegistry({config:{modulePrompts:{}},saveConfig(){}});
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=normalizeEditablePreset(COMPACT_DEFAULT_PRESET);
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.corePrompt=COMPACT_CORE_WORLD_RULES;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.macroPrompt=COMPACT_MACRO_PROMPT;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.stabilityPromptTemplate=COMPACT_STABILITY_PROMPT_TEMPLATE;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.modulePrompts=registryDefaults.moduleDefaults();
    }

    {
        const proto=SamsaraWorldEngine.prototype;
        const beforeReadPromptEditor=proto.readPromptEditor;
        proto.readPromptEditor=function(){
            return this.services.prompts.readPromptEditor(beforeReadPromptEditor.call(this));
        };

        const beforeApplyPromptSettings=proto.applyPromptSettings;
        proto.applyPromptSettings=function(settings){
            const prepared=this.services.prompts.prepareSettings(settings);
            const result=beforeApplyPromptSettings.call(this,prepared);
            this.services.prompts.persistModulePrompts(prepared);
            return result;
        };

        const beforeSavePromptDocument=proto.savePromptDocument;
        proto.savePromptDocument=function(name,settings,activate=true){
            return beforeSavePromptDocument.call(this,name,this.services.prompts.decorateSettings(settings),activate);
        };

        const beforeImportPromptDocument=proto.importPromptDocument;
        proto.importPromptDocument=function(raw){
            let parsed=null;try{parsed=JSON.parse(String(raw||''));}catch(_){}
            if(parsed){
                const settings=plain(parsed.settings)?parsed.settings:parsed;
                if(plain(settings))settings.modulePrompts=this.services.prompts.decorateSettings(settings).modulePrompts;
                raw=JSON.stringify(parsed);
            }
            return beforeImportPromptDocument.call(this,raw);
        };

        const beforeExportPromptDocument=proto.exportPromptDocument;
        proto.exportPromptDocument=function(id){
            const doc=this.getPromptDocuments().find(item=>item.id===id);
            if(doc)doc.settings=this.services.prompts.decorateSettings(doc.settings);
            return beforeExportPromptDocument.call(this,id);
        };

        const beforeBuildRequest=proto.buildRequest;
        proto.buildRequest=async function(base){
            const request=await beforeBuildRequest.call(this,base);
            const rebuilt=this.services.prompts.composeMainSystem(request.system);
            request.system=rebuilt.system;
            request.manifest=request.manifest||{};
            request.manifest.提示词模块=rebuilt.used;
            request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            return request;
        };
    }
