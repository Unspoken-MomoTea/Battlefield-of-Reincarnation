    class SamsaraWorldEngine {
        constructor(host, env) {
            this.host = host; this.env = env || host; this.version=WORLD_ENGINE_VERSION; this.unsub = []; this.generation = 0;
            this.busy = false; this.committing = false; this.disposed = false; this.tab = '总览'; this.status = '待命';
            this.lastRequest=null; this.previewRequest=null; this.lastReply=''; this.lastFailure='';
            this.lastRetryLog=[]; this.lastAttemptCount=0; this.lastAttemptTelemetry=[]; this.lastTransportInfo=null; this.lastWorldResult=null; this.lastCompiledPatches=[]; this.lastCompileWarnings=[];
            this.hostAdapter=new WorldHostAdapter(this);
            this.configService=new WorldEngineConfigService(this);
            this.config=this.configService.initialize();
        }
        fn(name) { return this.hostAdapter.resolve(name); }
        notifyFailure(message){return this.runOrchestrator().notifyFailure(message);}
        snapshot() {
            const service=this.services?.context||new WorldRuntimeContextService(this);
            return service.snapshot();
        }
        blocked(snapshot) {
            const service=this.services?.context||new WorldRuntimeContextService(this);
            return service.blocked(snapshot);
        }
        saveConfig() { return this.configService.save(); }
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
        applyBuiltinDefaultWorldbookExclusions(catalogue){const service=this.services?.knowledge||new WorldKnowledgeService(this);return service.applyBuiltinDefaultWorldbookExclusions(catalogue);}
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
        getState() {
            const service=this.services?.context||new WorldRuntimeContextService(this);
            return service.backendState();
        }
        resetInspection(){return this.runOrchestrator().resetInspection();}
        statusTone(){return this.services?.panelRenderer?.statusTone?.()||'night';}
        syncStatusTone(){return this.services?.panelRenderer?.syncStatusTone?.()||this.statusTone();}
        init() { return this.services?.applicationLifecycle?.init?.(); }
        isOpen() { return this.services?.applicationLifecycle?.isOpen?.()??false; }
        open() { return this.services?.applicationLifecycle?.open?.(); }
        close() { return this.services?.applicationLifecycle?.close?.(); }
        toggle() { return this.services?.applicationLifecycle?.toggle?.(); }
        createPanel() { return this.services?.panelController?.createPanel?.(); }
        render(force=false) { return this.services?.panelRenderer?.render?.(force); }
        dispose() { return this.services?.applicationLifecycle?.dispose?.(); }
    }
