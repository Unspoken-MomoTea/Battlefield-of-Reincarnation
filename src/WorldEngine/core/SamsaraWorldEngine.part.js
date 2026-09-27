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
        setPreset(text) {
            if (typeof text !== 'string' || text.length > 30000) throw new Error('预设限30000字');
            this.config.preset = normalizeEditablePreset(text);
            this.config.presetEditorVersion=2;
            this.saveConfig();
        }
        readPromptEditor() {
            const panel=this.panel;
            const list=panel&&panel.querySelector('[data-segment-list]');
            const rows=list?Array.from(list.querySelectorAll('[data-segment-row]')):[];
            const preset=list?rows.map(row=>segmentText({
                title:row.querySelector('[data-segment-title]')?.value||'',
                body:row.querySelector('[data-segment]')?.value||''
            })).filter(Boolean).join('\n'):this.config.preset;
            const floors=panel&&panel.querySelector('[data-floors]');
            const activation=panel&&panel.querySelector('[data-activation]');
            const books=panel?Array.from(panel.querySelectorAll('[data-book]')):[];
            return {
                preset,
                corePrompt:panel?.querySelector('[data-core-prompt]')?.value??this.config.corePrompt??CORE_WORLD_RULES,
                macroPrompt:panel?.querySelector('[data-macro-prompt]')?.value??this.config.macroPrompt??DEFAULT_MACRO_PROMPT,
                stabilityPromptTemplate:panel?.querySelector('[data-stability-prompt]')?.value??this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE,
                npcAuditPrompt:panel?.querySelector('[data-npc-audit-prompt]')?.value??this.config.npcAuditPrompt,
                structurePrompt:panel?.querySelector('[data-structure-prompt]')?.value??this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim(),
                contextTurns:Math.max(1,Math.min(100,Number(floors?.value??this.config.contextTurns)||6)),
                activationMode:activation?.value||this.config.activationMode||'respect_activation',
                selectedEntries:books.length
                    ?books.filter(e=>e.checked&&!e.disabled).map(e=>e.value)
                    :(Array.isArray(this.config.selectedEntries)?copy(this.config.selectedEntries):null)
            };
        }
        applyPromptSettings(settings) {
            if(!plain(settings)||typeof settings.preset!=='string'||settings.preset.length>30000)throw new Error('预设文档内容无效或超过30000字');
            for(const [name,value] of [['核心约束',settings.corePrompt],['宏观骨架提示词',settings.macroPrompt],['世界自救提示词',settings.stabilityPromptTemplate]])if(value!==undefined&&(typeof value!=='string'||value.length>30000))throw new Error(name+'限30000字');
            if(settings.npcAuditPrompt!==undefined&&(typeof settings.npcAuditPrompt!=='string'||settings.npcAuditPrompt.length>30000))throw new Error('NPC审计提示词限30000字');
            if(settings.structurePrompt!==undefined&&(typeof settings.structurePrompt!=='string'||settings.structurePrompt.length>30000))throw new Error('结构提示词限30000字');
            this.config.corePrompt=settings.corePrompt===undefined?CORE_WORLD_RULES:settings.corePrompt;
            this.config.macroPrompt=settings.macroPrompt===undefined?DEFAULT_MACRO_PROMPT:settings.macroPrompt;
            this.config.stabilityPromptTemplate=settings.stabilityPromptTemplate===undefined?DEFAULT_STABILITY_PROMPT_TEMPLATE:settings.stabilityPromptTemplate;
            this.config.npcAuditPrompt=settings.npcAuditPrompt===undefined?NPC_BUILD_AUDIT_RULES:settings.npcAuditPrompt;
            this.config.structurePrompt=settings.structurePrompt===undefined?protocol().split('【Canonical WorldResult JSON Schema】')[0].trim():settings.structurePrompt;
            this.config.preset=normalizeEditablePreset(settings.preset);
            this.config.presetEditorVersion=2;
            this.config.contextTurns=Math.max(1,Math.min(100,Number(settings.contextTurns)||6));
            this.config.activationMode=settings.activationMode==='force_selected'?'force_selected':'respect_activation';
            if(Array.isArray(settings.selectedEntries))this.config.selectedEntries=settings.selectedEntries.filter(x=>typeof x==='string');
            else delete this.config.selectedEntries;
            this.saveConfig();
            return this.config;
        }
        promptDocumentService(){return this._promptDocuments||(this._promptDocuments=new WorldPromptDocumentService(this));}
        getPromptDocuments(){return this.promptDocumentService().list();}
        savePromptDocument(name,settings,activate=true){return this.promptDocumentService().save(name,settings,activate);}
        deletePromptDocument(id){return this.promptDocumentService().remove(id);}
        importPromptDocument(raw){return this.promptDocumentService().import(raw);}
        exportPromptDocument(id){return this.promptDocumentService().export(id);}
        isConfigured() { return !!this.config.enabled; }
        isAvailable() {
            if(this.usesDedicatedApi())return this.dedicatedApiReady();
            const terminal=this.host.Samsara&&this.host.Samsara.terminal;
            return !!(terminal&&typeof terminal.apiReady==='function'&&terminal.apiReady());
        }
        isEnabled() { return this.isConfigured()&&this.isAvailable(); }
        setEnabled(value) {
            const on=!!value;
            this.config.enabled=on;
            if(on&&!this.usesDedicatedApi()){
                const terminal=this.host.Samsara&&this.host.Samsara.terminal;
                if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
            } else if(!on) {
                this.cancel();
                if(this.isOpen())this.close();
            }
            this.saveConfig();
            this.status=on?(this.isAvailable()?'世界推进已开启':(this.usesDedicatedApi()?'世界推进已开启 · 等待专属 API 配置':'世界推进已开启 · 等待额外模型配置')):'世界推进已关闭';
            this.render();
            return this.isEnabled();
        }
        cancel() { ++this.generation; this.pending = false; clearTimeout(this.timer); if (this.controller) this.controller.abort(); }
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
        schedule() {
            if (this.disposed || this.committing || !this.isEnabled()) return;
            if (this.busy) { this.pending = true; return; }
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.run().catch(() => {}), 900);
        }
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
