    class WorldEngineConfigService {
        constructor(engine){this.engine=engine;}
        defaults(){
            return {
                enabled:false,
                preset:DEFAULT_PRESET,
                corePrompt:CORE_WORLD_RULES,
                macroPrompt:DEFAULT_MACRO_PROMPT,
                stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,
                retryAttempts:5,
                requireMacroBackbone:true,
                presetEditorVersion:0,
                promptDocuments:[],
                fontScale:'standard',
                sendHistoryToProse:false,
                dedicatedApi:{enabled:false,apiUrl:'',apiKey:'',model:'',apiPresets:[],fetchedModels:[]}
            };
        }
        save(){
            const engine=this.engine;
            try{engine.host.localStorage?.setItem?.(CONFIG,JSON.stringify(engine.config));}catch(_){}
            return engine.config;
        }
        initialize(){
            const engine=this.engine,config=this.defaults();
            engine.config=config;
            try{Object.assign(config,JSON.parse(engine.host.localStorage.getItem(CONFIG)||'{}'));}catch(_){}
            const hadLegacyTone=Object.hasOwn(config,'tone');
            delete config.tone;
            if(Number(config.presetEditorVersion||0)<2)config.preset=ensurePresetStructure(config.preset);
            else config.preset=normalizeEditablePreset(config.preset);
            config.presetEditorVersion=2;
            if(typeof config.corePrompt!=='string')config.corePrompt=CORE_WORLD_RULES;
            if(typeof config.macroPrompt!=='string')config.macroPrompt=DEFAULT_MACRO_PROMPT;
            if(typeof config.stabilityPromptTemplate!=='string')config.stabilityPromptTemplate=DEFAULT_STABILITY_PROMPT_TEMPLATE;
            if(!Array.isArray(config.promptDocuments))config.promptDocuments=[];
            config.promptDocuments=config.promptDocuments
                .filter(doc=>plain(doc)&&typeof doc.name==='string'&&plain(doc.settings)&&typeof doc.settings.preset==='string'&&doc.id!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id&&doc.name!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.name)
                .slice(0,58);

            if(plain(config.userDefaultPromptSettings)&&typeof config.userDefaultPromptSettings.preset==='string'){
                const source=config.userDefaultPromptSettings;
                const legacySettings={
                    corePrompt:typeof source.corePrompt==='string'?source.corePrompt:CORE_WORLD_RULES,
                    macroPrompt:typeof source.macroPrompt==='string'?source.macroPrompt:DEFAULT_MACRO_PROMPT,
                    stabilityPromptTemplate:typeof source.stabilityPromptTemplate==='string'?source.stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,
                    npcAuditPrompt:typeof source.npcAuditPrompt==='string'?source.npcAuditPrompt:undefined,
                    structurePrompt:typeof source.structurePrompt==='string'?source.structurePrompt:undefined,
                    preset:normalizeEditablePreset(source.preset),
                    contextTurns:Math.max(1,Math.min(100,Number(source.contextTurns)||3)),
                    activationMode:source.activationMode==='force_selected'?'force_selected':'respect_activation',
                    selectedEntries:Array.isArray(source.selectedEntries)?copy(source.selectedEntries):null
                };
                const personal=config.promptDocuments.find(doc=>doc.id===USER_DEFAULT_PROMPT_DOCUMENT_ID);
                if(!personal)config.promptDocuments.unshift({
                    id:USER_DEFAULT_PROMPT_DOCUMENT_ID,type:'samsara-world-prompt-document',version:1,builtin:false,
                    name:'个人默认设置',createdAt:'',updatedAt:'',settings:copy(legacySettings)
                });
            }

            config.promptDocuments=config.promptDocuments.filter(doc=>doc.id!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id).slice(0,59);
            config.promptDocuments.unshift(copy(BUILTIN_DEFAULT_PROMPT_DOCUMENT));

            const appliedVersion=Number(config.builtinDefaultPromptVersionApplied||0);
            if(appliedVersion<BUILTIN_DEFAULT_PROMPT_VERSION){
                const shouldApply=appliedVersion===0||config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id;
                if(shouldApply){
                    const settings=BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings;
                    config.corePrompt=settings.corePrompt===undefined?CORE_WORLD_RULES:settings.corePrompt;
                    config.macroPrompt=settings.macroPrompt===undefined?DEFAULT_MACRO_PROMPT:settings.macroPrompt;
                    config.stabilityPromptTemplate=settings.stabilityPromptTemplate===undefined?DEFAULT_STABILITY_PROMPT_TEMPLATE:settings.stabilityPromptTemplate;
                    config.npcAuditPrompt=settings.npcAuditPrompt===undefined?NPC_BUILD_AUDIT_RULES:settings.npcAuditPrompt;
                    config.structurePrompt=settings.structurePrompt===undefined?WORLD_RESULT_CONTRACT.instruction():settings.structurePrompt;
                    config.preset=normalizeEditablePreset(settings.preset);
                    config.presetEditorVersion=2;
                    config.contextTurns=settings.contextTurns;
                    config.activationMode=settings.activationMode;
                    config.selectedEntries=copy(settings.selectedEntries);
                    config.activePromptDocumentId=BUILTIN_DEFAULT_PROMPT_DOCUMENT.id;
                    config.builtinDefaultWorldbookExclusionsApplied=[];
                }
                config.builtinDefaultPromptVersionApplied=BUILTIN_DEFAULT_PROMPT_VERSION;
                this.save();
            }

            const retryLimit=Number(config.retryAttempts);
            config.retryAttempts=Math.max(1,Math.min(5,Number.isFinite(retryLimit)?retryLimit:5));
            if(!config.retryDefaultFiveMigrated){
                if(config.retryAttempts===3)config.retryAttempts=5;
                config.retryDefaultFiveMigrated=true;
                this.save();
            }

            if(!Object.hasOwn(config,'requireMacroBackbone'))config.requireMacroBackbone=true;
            if(!['standard','large','xlarge'].includes(config.fontScale))config.fontScale='standard';
            config.sendHistoryToProse=config.sendHistoryToProse===true;
            config.dedicatedApi=engine.normalizeDedicatedApi(config.dedicatedApi);
            engine.apiModeCache={};
            if(hadLegacyTone)this.save();

            if(config.enabled&&!engine.usesDedicatedApi()){
                const terminal=engine.host.Samsara&&engine.host.Samsara.terminal;
                if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
            }
            return config;
        }
    }
