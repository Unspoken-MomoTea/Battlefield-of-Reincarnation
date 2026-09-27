    class SamsaraWorldEngine {
        constructor(host, env) {
            this.host = host; this.env = env || host; this.unsub = []; this.generation = 0;
            this.busy = false; this.committing = false; this.disposed = false; this.tab = '总览'; this.status = '待命';
            this.lastRequest=null; this.previewRequest=null; this.lastReply=''; this.lastFailure='';
            this.lastRetryLog=[]; this.lastAttemptCount=0; this.lastAttemptTelemetry=[]; this.lastTransportInfo=null; this.lastWorldResult=null; this.lastCompiledPatches=[]; this.lastCompileWarnings=[];
            this.configService=new WorldEngineConfigService(this);
            this.config=this.configService.initialize();
        }
        fn(name) {
            for (const obj of [this.env, this.host, this.host.TavernHelper]) if (obj && typeof obj[name] === 'function') return obj[name].bind(obj);
            return null;
        }
        notifyFailure(message) {
            const raw=String(message||'世界推进失败').trim();
            if(!raw||/^(?:请求已取消|上下文已经切换|已切换上下文)/.test(raw))return false;
            const shown=raw.length>900?raw.slice(0,897)+'…':raw;
            const toast=(this.host&&this.host.toastr)||(this.env&&this.env.toastr)||(this.host&&this.host.parent&&this.host.parent.toastr);
            if(toast&&typeof toast.error==='function'){
                try{toast.error(shown,'世界推进失败');return true;}catch(_){}
            }
            try{console.error('[世界推进] '+shown);}catch(_){}
            return false;
        }
        snapshot() {
            const service=this.services?.context||new WorldRuntimeContextService(this);
            return service.snapshot();
        }
        blocked(snapshot) {
            const service=this.services?.context||new WorldRuntimeContextService(this);
            return service.blocked(snapshot);
        }
        saveConfig() {
            if(this.configService)return this.configService.save();
            try{this.host.localStorage?.setItem?.(CONFIG,JSON.stringify(this.config));}catch(_){}
            return this.config;
        }
        transportService(){return this._apiTransport||(this._apiTransport=new WorldApiTransportService(this));}
        normalizeDedicatedApi(value){return this.transportService().normalize(value);}
        usesDedicatedApi(){return this.transportService().usesDedicated();}
        dedicatedApiReady(){return this.transportService().ready();}
        apiSourceLabel(){return this.transportService().sourceLabel();}
        setDedicatedApi(patch){return this.transportService().set(patch);}
        saveDedicatedApiPreset(name){return this.transportService().savePreset(name);}
        deleteDedicatedApiPreset(name){return this.transportService().deletePreset(name);}
        applyDedicatedApiPreset(name){return this.transportService().applyPreset(name);}
        dedicatedEndpoint(kind='chat'){return this.transportService().endpoint(kind);}
        fetchDedicatedModels(){return this.transportService().fetchModels();}
        structuredUnsupported(status,body){return this.transportService().structuredUnsupported(status,body);}
        requestDedicatedApi(system,input,options={}){return this.transportService().requestDedicated(system,input,options);}
        requestAI(system,input,options={}){return this.transportService().request(system,input,options);}
        setPreset(text){return this.promptDocumentService().setPreset(text);}
        readPromptEditor(){return this.promptWorkspace?.readSettings?.()||this.promptDocumentService().currentSettings();}
        applyPromptSettings(settings){return this.promptDocumentService().applySettings(settings);}
        promptDocumentService(){return this._promptDocuments||(this._promptDocuments=new WorldPromptDocumentService(this));}
        getPromptDocuments(){return this.promptDocumentService().list();}
        savePromptDocument(name,settings,activate=true){return this.promptDocumentService().save(name,settings,activate);}
        deletePromptDocument(id){return this.promptDocumentService().remove(id);}
        importPromptDocument(raw){return this.promptDocumentService().import(raw);}
        exportPromptDocument(id){return this.promptDocumentService().export(id);}
        isConfigured(){return this.configService.isConfigured();}
        isAvailable(){return this.configService.isAvailable();}
        isEnabled(){return this.configService.isEnabled();}
        setEnabled(value){return this.configService.setEnabled(value);}
        runScheduler(){return this.services?.runScheduler||this._runScheduler||(this._runScheduler=new WorldRunScheduler(this));}
        cancel(){return this.runScheduler().cancel();}
        applyBuiltinDefaultWorldbookExclusions(catalogue) {
            if(this.config.activePromptDocumentId!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id||!Array.isArray(catalogue)||!catalogue.length)return false;
            const applied=new Set(Array.isArray(this.config.builtinDefaultWorldbookExclusionsApplied)?this.config.builtinDefaultWorldbookExclusionsApplied:[]);
            let selected=Array.isArray(this.config.selectedEntries)?copy(this.config.selectedEntries):[];
            let progressed=false,changed=false;
            for(const title of BUILTIN_DEFAULT_WORLD_BOOK_EXCLUSIONS){
                if(applied.has(title))continue;
                const matches=catalogue.filter(entry=>normalizeWorldbookEntryTitle(entry.title)===title);
                if(!matches.length)continue;
                const before=selected.length;
                selected=selected.filter(raw=>!matches.some(entry=>selectedEntryMatches(entry,[raw])));
                applied.add(title);progressed=true;
                if(selected.length!==before)changed=true;
            }
            if(!progressed)return false;
            this.config.selectedEntries=selected;
            this.config.builtinDefaultWorldbookExclusionsApplied=Array.from(applied);
            const builtin=this.getPromptDocuments().find(doc=>doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id);
            if(builtin?.settings)builtin.settings.selectedEntries=copy(selected);
            this.saveConfig();
            return changed;
        }
        async catalogue() {
            const service=this.services?.knowledge||new WorldKnowledgeService(this);
            return service.catalogue();
        }
        async worldbook(scan='', options={}) {
            const service=this.services?.knowledge||new WorldKnowledgeService(this);
            return service.worldbook(scan,options);
        }
        async buildRequest(base) {
            const service=this.services?.requestBuilder||new WorldRequestBuilder(this);
            return service.build(base);
        }
        schedule(){return this.runScheduler().schedule();}
        runOrchestrator(){return this.services?.run||this._runOrchestrator||(this._runOrchestrator=new WorldRunOrchestrator(this));}
        async run(options={}){return this.runOrchestrator().execute(options);}
        getState() { return copy(Object.assign(emptyState(),this.snapshot().stat.世界[PATH] || {})); }
        resetInspection() {
            this.lastRequest=null;this.previewRequest=null;this.lastReply='';this.lastFailure='';
            this.lastRetryLog=[];this.lastAttemptCount=0;this.lastAttemptTelemetry=[];this.lastTransportInfo=null;this.lastWorldResult=null;this.lastCompiledPatches=[];this.lastCompileWarnings=[];
        }
        statusTone() {
            try {
                const tone=this.host.localStorage.getItem(STATUS_THEME_CONFIG);
                if(WORLD_TONE_KEYS.has(tone))return tone;
            } catch (_) {}
            return 'night';
        }
        syncStatusTone() {
            const tone=this.statusTone();
            if(this.panel)this.panel.dataset.tone=tone;
            return tone;
        }
        init() { return this.services?.applicationLifecycle?.init?.(); }
        isOpen() { return this.services?.applicationLifecycle?.isOpen?.()??false; }
        open() { return this.services?.applicationLifecycle?.open?.(); }
        close() { return this.services?.applicationLifecycle?.close?.(); }
        toggle() { return this.services?.applicationLifecycle?.toggle?.(); }
        createPanel() { return this.services?.panelController?.createPanel?.(); }
        render(force=false) { return this.services?.panelRenderer?.render?.(force); }
        dispose() { return this.services?.applicationLifecycle?.dispose?.(); }
    }
