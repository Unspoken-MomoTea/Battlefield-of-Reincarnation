    class SamsaraWorldEngine {
        constructor(host, env) {
            this.host = host; this.env = env || host; this.unsub = []; this.generation = 0;
            this.busy = false; this.committing = false; this.disposed = false; this.tab = '总览'; this.status = '待命';
            this.lastRequest=null; this.previewRequest=null; this.lastReply=''; this.lastFailure='';
            this.lastRetryLog=[]; this.lastAttemptCount=0; this.lastAttemptTelemetry=[]; this.lastTransportInfo=null; this.lastWorldResult=null; this.lastCompiledPatches=[]; this.lastCompileWarnings=[];
            this.config = {
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
                // 仅控制是否把压缩后的长期历史发送给正文AI；世界推进自身始终读取。
                sendHistoryToProse:false,
                dedicatedApi:{enabled:false,apiUrl:'',apiKey:'',model:'',apiPresets:[],fetchedModels:[]}
            };
            try { Object.assign(this.config, JSON.parse(host.localStorage.getItem(CONFIG) || '{}')); } catch (_) {}
            const hadLegacyTone=Object.hasOwn(this.config,'tone');
            delete this.config.tone;
            if(Number(this.config.presetEditorVersion||0)<2)this.config.preset=ensurePresetStructure(this.config.preset);
            else this.config.preset=normalizeEditablePreset(this.config.preset);
            this.config.presetEditorVersion=2;
            if(typeof this.config.corePrompt!=='string')this.config.corePrompt=CORE_WORLD_RULES;
            if(typeof this.config.macroPrompt!=='string')this.config.macroPrompt=DEFAULT_MACRO_PROMPT;
            if(typeof this.config.stabilityPromptTemplate!=='string')this.config.stabilityPromptTemplate=DEFAULT_STABILITY_PROMPT_TEMPLATE;
            if(!Array.isArray(this.config.promptDocuments))this.config.promptDocuments=[];
            this.config.promptDocuments=this.config.promptDocuments
                .filter(doc=>plain(doc)&&typeof doc.name==='string'&&plain(doc.settings)&&typeof doc.settings.preset==='string'&&doc.id!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id&&doc.name!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.name)
                .slice(0,58);
            // 旧版“保存为默认设置”曾直接覆盖内置默认。v3 起把这份本地内容迁移为独立个人文档，
            // 内置“默认设置”始终绑定代码中的最新 DEFAULT_PRESET，不再被 localStorage 遮蔽。
            if(plain(this.config.userDefaultPromptSettings)&&typeof this.config.userDefaultPromptSettings.preset==='string'){
                const legacySettings={
                    corePrompt:typeof this.config.userDefaultPromptSettings.corePrompt==='string'?this.config.userDefaultPromptSettings.corePrompt:CORE_WORLD_RULES,
                    macroPrompt:typeof this.config.userDefaultPromptSettings.macroPrompt==='string'?this.config.userDefaultPromptSettings.macroPrompt:DEFAULT_MACRO_PROMPT,
                    stabilityPromptTemplate:typeof this.config.userDefaultPromptSettings.stabilityPromptTemplate==='string'?this.config.userDefaultPromptSettings.stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,
                    npcAuditPrompt:typeof this.config.userDefaultPromptSettings.npcAuditPrompt==='string'?this.config.userDefaultPromptSettings.npcAuditPrompt:undefined,
                    structurePrompt:typeof this.config.userDefaultPromptSettings.structurePrompt==='string'?this.config.userDefaultPromptSettings.structurePrompt:undefined,
                    preset:normalizeEditablePreset(this.config.userDefaultPromptSettings.preset),
                    contextTurns:Math.max(1,Math.min(100,Number(this.config.userDefaultPromptSettings.contextTurns)||3)),
                    activationMode:this.config.userDefaultPromptSettings.activationMode==='force_selected'?'force_selected':'respect_activation',
                    selectedEntries:Array.isArray(this.config.userDefaultPromptSettings.selectedEntries)?copy(this.config.userDefaultPromptSettings.selectedEntries):null
                };
                const personal=this.config.promptDocuments.find(doc=>doc.id===USER_DEFAULT_PROMPT_DOCUMENT_ID);
                if(!personal)this.config.promptDocuments.unshift({id:USER_DEFAULT_PROMPT_DOCUMENT_ID,type:'samsara-world-prompt-document',version:1,builtin:false,name:'个人默认设置',createdAt:'',updatedAt:'',settings:copy(legacySettings)});
            }
            this.config.promptDocuments=this.config.promptDocuments.filter(doc=>doc.id!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id).slice(0,59);
            this.config.promptDocuments.unshift(copy(BUILTIN_DEFAULT_PROMPT_DOCUMENT));
            {
                const appliedVersion=Number(this.config.builtinDefaultPromptVersionApplied||0);
                if(appliedVersion<BUILTIN_DEFAULT_PROMPT_VERSION){
                    // 首次安装自动应用；已在使用内置默认的用户随版本升级。
                    // 自定义文档/个人默认不会被强制覆盖，但内置默认文档本身始终升级到最新代码模板。
                    const shouldApply=appliedVersion===0||this.config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id;
                    if(shouldApply){
                        const settings=BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings;
                        this.config.corePrompt=settings.corePrompt??CORE_WORLD_RULES;
                        this.config.macroPrompt=settings.macroPrompt??DEFAULT_MACRO_PROMPT;
                        this.config.stabilityPromptTemplate=settings.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE;
                        this.config.corePrompt=settings.corePrompt===undefined?CORE_WORLD_RULES:settings.corePrompt;
            this.config.macroPrompt=settings.macroPrompt===undefined?DEFAULT_MACRO_PROMPT:settings.macroPrompt;
            this.config.stabilityPromptTemplate=settings.stabilityPromptTemplate===undefined?DEFAULT_STABILITY_PROMPT_TEMPLATE:settings.stabilityPromptTemplate;
            this.config.npcAuditPrompt=settings.npcAuditPrompt===undefined?NPC_BUILD_AUDIT_RULES:settings.npcAuditPrompt;
            this.config.structurePrompt=settings.structurePrompt===undefined?protocol().split('【Canonical WorldResult JSON Schema】')[0].trim():settings.structurePrompt;
                        this.config.preset=normalizeEditablePreset(settings.preset);
                        this.config.presetEditorVersion=2;
                        this.config.contextTurns=settings.contextTurns;
                        this.config.activationMode=settings.activationMode;
                        this.config.selectedEntries=copy(settings.selectedEntries);
                        this.config.activePromptDocumentId=BUILTIN_DEFAULT_PROMPT_DOCUMENT.id;
                        this.config.builtinDefaultWorldbookExclusionsApplied=[];
                    }
                    this.config.builtinDefaultPromptVersionApplied=BUILTIN_DEFAULT_PROMPT_VERSION;
                    this.saveConfig();
                }
            }
            {
                const retryLimit=Number(this.config.retryAttempts);
                this.config.retryAttempts=Math.max(1,Math.min(5,Number.isFinite(retryLimit)?retryLimit:5));
                if(!this.config.retryDefaultFiveMigrated){
                    if(this.config.retryAttempts===3)this.config.retryAttempts=5;
                    this.config.retryDefaultFiveMigrated=true;
                    this.saveConfig();
                }
            }
            if(!Object.hasOwn(this.config,'requireMacroBackbone'))this.config.requireMacroBackbone=true;
            if(!['standard','large','xlarge'].includes(this.config.fontScale))this.config.fontScale='standard';
            this.config.sendHistoryToProse=this.config.sendHistoryToProse===true;
            this.config.dedicatedApi=this.normalizeDedicatedApi(this.config.dedicatedApi);
            this.apiModeCache={};
            if(hadLegacyTone)this.saveConfig();
            if(this.config.enabled&&!this.usesDedicatedApi()){
                const terminal=this.host.Samsara&&this.host.Samsara.terminal;
                if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
            }
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
            try{this.host.localStorage?.setItem?.(CONFIG,JSON.stringify(this.config));}catch(_){}
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
        async run() {
            if (this.disposed || this.busy) return false;
            if (!this.isConfigured()) { this.status='世界推进已关闭'; this.render(); return false; }
            const terminal = this.host.Samsara && this.host.Samsara.terminal;
            this.busy = true; const token = this.generation; let timeout, timedOut=false;
            try {
                const base = this.snapshot(), reason = this.blocked(base);
                if (reason) { this.status = reason; return false; }
                const old = Object.assign(emptyState(),base.stat.世界[PATH] || {});
                if (old.已处理楼层 === base.fingerprint) {
                    const recoveryStat=copy(base.stat);
                    recoveryStat.世界[PATH]=Object.assign(emptyState(),recoveryStat.世界[PATH]||{});
                    normalizeBackendState(recoveryStat);
                    const recoveryTimeline=timelineState(recoveryStat);
                    const needsMacroRepair=this.config.requireMacroBackbone!==false&&(recoveryTimeline.需要补充远期||recoveryTimeline.因果轨道需重建);
                    const needsScheduleRepair=unscheduledEvents(recoveryStat).length>0;
                    const needsLifecycleRepair=staleActiveEvents(recoveryStat).length>0||temporalAnomalies(recoveryStat).length>0;
                    const needsAlienRepair=activeAlienActivityRequirements(recoveryStat).some(item=>{
                        const personName=stableNameIn(recoveryStat.世界?.[PATH]?.人物||{},item.名称),person=personName?recoveryStat.世界[PATH].人物[personName]:null;
                        return !person||!String(person.地点||'').trim()||!String(person.目标||'').trim()||!String(person.行动||'').trim()||String(person.更新时间||'').trim()!==String(recoveryStat.世界?.时间||'').trim();
                    });
                    const needsWorldActivityRepair=typeof worldActivityRepairRequired==='function'&&worldActivityRepairRequired(recoveryStat);
                    if(!needsMacroRepair&&!needsScheduleRepair&&!needsLifecycleRepair&&!needsAlienRepair&&!needsWorldActivityRepair){this.status='本楼层已处理，不重复结算';return false;}
                    this.status=needsWorldActivityRepair?'检测到世界活动骨架缺失 · 修复本楼层':needsMacroRepair?'检测到宏观骨架不完整 · 修复本楼层':needsScheduleRepair?'检测到事件时间锚点缺失 · 修复本楼层':needsAlienRepair?'检测到异端活动缺失 · 修复本楼层':'检测到生命周期或时间异常 · 修复本楼层';
                }
                if (!this.isAvailable()) throw new Error(this.usesDedicatedApi()?'请在世界推进「设置」中完成专属 API 地址与模型配置':'请在主神终端设置中启用额外模型并选择模型');
                const validate = this.host.Samsara && this.host.Samsara.validateWorldState;
                if (!validate) throw new Error('请加载更新后的 ZOD脚本.js');

                this.resetInspection();
                this.status = '正在读取世界资料'; this.render();
                const request=await this.buildRequest(base);
                if(token!==this.generation)throw new Error('请求已取消');

                const configuredAttempts=Number(this.config.retryAttempts),maxAttempts=Math.max(1,Math.min(5,Number.isFinite(configuredAttempts)?configuredAttempts:5));
                let attempt=0,lastError=null,lastRejectedReply='',prepared=null,acceptedWorldResult=null,lastRetryPlan=[];

                while(attempt<maxAttempts){
                    if(token!==this.generation)throw new Error('请求已取消');
                    this.controller=new AbortController();
                    timedOut=false;
                    clearTimeout(timeout);timeout=setTimeout(()=>{timedOut=true;this.controller.abort();},300000);
                    const attemptInput=attempt===0?request.input:(this.services?.requests?.retryInput?this.services.requests.retryInput(request.input,lastError,lastRejectedReply,attempt,maxAttempts,acceptedWorldResult,lastRetryPlan):retryInput(request.input,lastError,lastRejectedReply,attempt,maxAttempts,acceptedWorldResult,lastRetryPlan));
                    const actualRequest=copy(request);
                    actualRequest.input=attemptInput;
                    actualRequest.manifest=Object.assign({},copy(request.manifest),{
                        观测:requestTokenTelemetry(request.system,attemptInput,request.schema),
                        尝试序号:attempt+1,
                        最大尝试次数:maxAttempts,
                        失败记录:copy(this.lastRetryLog)
                    });
                    actualRequest.manifest.观测.请求类型=attempt===0?'首次请求':'纠错重试';
                    this.lastAttemptCount=attempt+1;
                    this.lastRequest=actualRequest;
                    this.status=attempt===0?'六模块联合推演中':'纠错重试 '+(attempt+1)+'/'+maxAttempts;
                    this.render();

                    let received='',attemptTelemetry=null;
                    const attemptStarted=Date.now();this.lastTransportInfo=null;
                    try{
                        received=String(await this.requestAI(request.system,attemptInput,{signal:this.controller.signal,schema:request.schema,schemaName:'samsara_world_result_v1',structured:'auto',temperature:0.3}));
                        clearTimeout(timeout);
                        if(token!==this.generation||this.controller.signal.aborted)throw new Error('请求已取消');
                        this.lastReply=received;this.lastFailure='';
                        const elapsed=Math.max(0,Date.now()-attemptStarted),transport=this.lastTransportInfo||{},usage=transport.usage||null,observation=actualRequest.manifest.观测;
                        Object.assign(observation,{接口来源:transport.接口||this.apiSourceLabel(),模型:transport.模型||'',结构化实际模式:transport.结构化模式||'未知',模式尝试:copy(transport.尝试模式||[]),耗时毫秒:elapsed,输出估算Tokens:estimateTokens(received)});
                        if(usage){observation.实际输入Tokens=usage.inputTokens;observation.实际输出Tokens=usage.outputTokens;observation.实际总Tokens=usage.totalTokens;}
                        attemptTelemetry={尝试:attempt+1,结果:'待验收',输入估算Tokens:observation.请求估算Tokens,输出估算Tokens:observation.输出估算Tokens,API输入Tokens:usage?.inputTokens??null,API输出Tokens:usage?.outputTokens??null,API总Tokens:usage?.totalTokens??null,接口:observation.接口来源,模型:observation.模型,结构化模式:observation.结构化实际模式,模式尝试:copy(observation.模式尝试||[]),耗时毫秒:elapsed};
                        this.lastAttemptTelemetry.push(attemptTelemetry);

                        let reply=parseReply(received);
                        let legacyPatches=[],rejectedSlices=[];
                        if(reply.kind==='world_result'){
                            const staged=this.services?.compiler?.stage(base.stat,acceptedWorldResult,reply.worldResult,validate)??stageWorldResult(base.stat,acceptedWorldResult,reply.worldResult,validate);
                            acceptedWorldResult=staged.accepted;
                            rejectedSlices=staged.rejected;
                            reply.summary=acceptedWorldResult.摘要||reply.summary;
                        } else {
                            legacyPatches=this.services?.compiler?.sanitizeLegacy(reply.patches)??sanitizeModelPatches(normalizeModelPatches(reply.patches));
                        }
                        const compileFor=sourceStat=>{
                            const patches=[],warnings=[];
                            if(acceptedWorldResult){
                                const compiled=this.services?.compiler?.compile(sourceStat,acceptedWorldResult)??compileWorldResult(sourceStat,acceptedWorldResult);
                                patches.push(...compiled.patches);warnings.push(...compiled.warnings);
                            }
                            if(legacyPatches.length)patches.push(...legacyPatches);
                            return {patches,warnings};
                        };
                        let sourceStat=base.stat,compiled=compileFor(sourceStat),modelPatches=compiled.patches;
                        this.lastWorldResult=acceptedWorldResult?copy(acceptedWorldResult):null;
                        this.lastCompiledPatches=copy(modelPatches);
                        this.lastCompileWarnings=copy(compiled.warnings);
                        let built=this.services?.compiler?.materialize(sourceStat,request.seedPatches,modelPatches)??materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                        let next=built.next;
                        let globalError=null;
                        try{
                            if(this.services?.validation)this.services.validation.validate(next,request,acceptedWorldResult,base.stat);
                            else{
                                ensureDueHandled(next,request.due,base.stat.世界.时间);
                                ensureEventTimeAnchors(next,request.unscheduled);
                                ensureStaleActiveHandled(next,request.staleActive,base.stat.世界.时间);
                                ensureTemporalAnomaliesResolved(next,request.timeAnomalies);
                                ensureActiveAlienActivity(next,request.alienActivity,acceptedWorldResult,base.stat.世界.时间);
                                ensureNpcBuildAuditProgress(next,request.npcAudit,acceptedWorldResult);
                                ensureMacroBackbone(next,request.timeline,this.config.requireMacroBackbone!==false);
                            }
                        }catch(error){globalError=error;}
                        if(rejectedSlices.length||globalError)throw makeRetryFailure(rejectedSlices,globalError);

                        const current=this.snapshot();
                        if(token!==this.generation||this.controller.signal.aborted||current.fingerprint!==base.fingerprint||this.blocked(current))throw new Error('上下文已经切换，本次结果已丢弃');
                        if(this.services?.validation?.progressionAnchorChanged(base.stat,current.stat)??progressionAnchorChanged(base.stat,current.stat))throw new Error('推演期间世界时间或副本锚点发生变化，请重新运行');

                        if(!same(current.stat,base.stat)){
                            sourceStat=current.stat;
                            compiled=compileFor(sourceStat);modelPatches=compiled.patches;
                            this.lastCompiledPatches=copy(modelPatches);
                            this.lastCompileWarnings=copy(compiled.warnings);
                            built=this.services?.compiler?.materialize(sourceStat,request.seedPatches,modelPatches)??materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                            next=built.next;
                            let currentGlobalError=null;
                            try{
                                if(this.services?.validation)this.services.validation.validate(next,request,acceptedWorldResult,base.stat,{includeNpcAudit:false});
                                else{
                                    ensureDueHandled(next,request.due,base.stat.世界.时间);
                                    ensureEventTimeAnchors(next,request.unscheduled);
                                    ensureStaleActiveHandled(next,request.staleActive,base.stat.世界.时间);
                                    ensureTemporalAnomaliesResolved(next,request.timeAnomalies);
                                    ensureActiveAlienActivity(next,request.alienActivity,acceptedWorldResult,base.stat.世界.时间);
                                    ensureMacroBackbone(next,request.timeline,this.config.requireMacroBackbone!==false);
                                }
                            }catch(error){currentGlobalError=error;}
                            if(currentGlobalError)throw makeRetryFailure([],currentGlobalError);
                        }
                        const committedPatches=built.appliedSeeds.concat(modelPatches,built.repairPatches);
                        if(this.services?.commit){
                            const finalized=this.services.commit.prepare({
                                next,committedPatches,base,acceptedWorldResult,reply,validate
                            });
                            next=finalized.next;reply=finalized.reply;
                        }else{
                            if (!(next.设置 || {}).世界超稳) {
                                const offsets=(next.世界.因果轨道||{}).偏移记录||{};
                                const total=Object.values(offsets).reduce((n,r)=>n+(Number(r.影响程度)||0),0);
                                next.世界.稳定=Math.max(0,Math.min(120,100+total));
                            }
                            next.世界[PATH].已处理楼层=base.fingerprint;
                            next.世界[PATH].已处理时间=base.stat.世界.时间;
                            const changes=committedPatches.map(p=>{
                                const parts=tokens(p.path),back=parts[1]===PATH,asset=parts[0]==='资产';
                                return {时间:base.stat.世界.时间,类别:asset?'资产':back?parts[2]:parts[1],名称:asset?parts[1]:back?parts[3]:parts[2],字段:asset?'资产':parts.at(-1),操作:p.op==='add'?'新增':p.op==='remove'?'移除':'更新',内容:typeof p.value==='string'?p.value:plain(p.value)?(p.value.描述||p.value.行动||p.value.事实||p.value.目标||p.value.状态||p.value.内容||'记录已更新'):''};
                            });
                            next.世界[PATH].最近变化=changes.slice(-100);
                            if(typeof this.beforeWorldCommit==='function')this.beforeWorldCommit(next,{
                                messageId:base.id,fingerprint:base.fingerprint,worldResult:acceptedWorldResult,reply:copy(reply),baseStat:base.stat
                            });
                            const checked=validate(next);
                            for(const patch of committedPatches){
                                if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(next,tokens(patch.path))))throw schemaMismatchError(next,checked,patch.path);
                            }
                            reply.patches=committedPatches;
                        }
                        prepared={reply,next,current};
                        if(attemptTelemetry)attemptTelemetry.结果='接受';
                        break;
                    }catch(error){
                        clearTimeout(timeout);
                        if(attemptTelemetry){attemptTelemetry.结果='拒绝';attemptTelemetry.原因=String(error.message||error);}
                        else{
                            const elapsed=Math.max(0,Date.now()-attemptStarted),transport=this.lastTransportInfo||{},observation=actualRequest.manifest.观测;
                            Object.assign(observation,{接口来源:transport.接口||this.apiSourceLabel(),模型:transport.模型||'',结构化实际模式:transport.结构化模式||'未返回',模式尝试:copy(transport.尝试模式||[]),耗时毫秒:elapsed});
                            this.lastAttemptTelemetry.push({尝试:attempt+1,结果:'请求失败',输入估算Tokens:observation.请求估算Tokens,输出估算Tokens:0,API输入Tokens:null,API输出Tokens:null,API总Tokens:null,接口:observation.接口来源,模型:observation.模型,结构化模式:observation.结构化实际模式,模式尝试:copy(observation.模式尝试||[]),耗时毫秒:elapsed,原因:String(error.message||error)});
                        }
                        lastError=error;
                        lastRejectedReply=received||this.lastReply||'';
                        lastRetryPlan=Array.isArray(error?.retryPlan)?copy(error.retryPlan):retryPlanForFailure(error,[]);
                        const rejectedByModel=!!received&&retryableModelFailure(error);
                        if(rejectedByModel)this.lastRetryLog.push({尝试:attempt+1,错误:String(error.message||error),片段:Array.isArray(error?.rejectedSlices)?copy(error.rejectedSlices):[],补充清单:copy(lastRetryPlan)});
                        const canRetry=rejectedByModel&&attempt+1<maxAttempts;
                        if(!canRetry)throw error;
                        attempt++;
                        this.status='回复未通过 · 自动纠错 '+(attempt+1)+'/'+maxAttempts;
                        this.render();
                    }
                }

                if(!prepared)throw lastError||new Error('世界推演未生成可写入结果');
                this.committing=true;
                if(this.services?.commit)await this.services.commit.persist(prepared,base);
                else{
                    const result=prepared.current.raw;
                    result.stat_data=prepared.next;
                    const replay=typeof this.buildWorldReplayPackage==='function'
                        ?this.buildWorldReplayPackage(base.stat,prepared.next,base.fingerprint):null;
                    if(replay)result.__samsaraWorldReplay=replay;
                    await prepared.current.mvu.replaceMvuData(result,{type:'message',message_id:base.id});
                }
                this.status='已更新 · '+prepared.reply.summary+(this.lastRetryLog.length?' · 前序失败'+this.lastRetryLog.length+'次':'');
                return true;
            } catch (error) {
                const failureMessage=error.name==='AbortError'?(timedOut?'请求超时（300秒）':'请求已取消'):String(error.message||error);
                this.lastFailure=failureMessage;
                const retryNote=this.lastRetryLog?.length?' · 已记录失败'+this.lastRetryLog.length+'次':'';
                this.status=(this.committing?'写入未确认 · ':'未写入 · ')+failureMessage+retryNote;
                if(!(error.name==='AbortError'&&!timedOut))this.notifyFailure(this.status);
                throw error;
            } finally {
                clearTimeout(timeout); if(this.controller)this.controller=null; this.committing=false; this.busy=false; this.render();
                if (this.pending) { this.pending = false; this.schedule(); }
            }
        }
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
        init() {
            const on = this.fn('eventOn');
            const mvu = this.env.Mvu || this.host.Mvu;
            if (!on || !mvu || !mvu.events) { this.initTimer = setTimeout(() => { if (!this.disposed) this.init(); },500); return; }
            const bind = (event,callback) => { if (event) { const off = on(event,callback); if (typeof off === 'function') this.unsub.push(off); else if (off && off.stop) this.unsub.push(() => off.stop()); } };
            bind(mvu.events.VARIABLE_UPDATE_ENDED, (variables,before) => {
                // 自身提交和装备等 UI 写回不代表正文完成，避免误触发补跑。
                if(this.committing||this.host.__samsaraUIMutation||this.env.__samsaraUIMutation||this.host.parent?.__samsaraUIMutation)return;
                try {
                    const snapshot=this.snapshot();
                    if(plain(variables?.stat_data))snapshot.stat=variables.stat_data;
                    if(this.blocked(snapshot))this.cancel();
                } catch (_) { /* MVU 可能尚未写回；由延迟调度读取最终状态。 */ }
                this.render(); this.schedule();
            });
            const events = this.env.tavern_events || this.host.tavern_events || {};
            for (const key of ['CHAT_CHANGED','MESSAGE_SWIPED','MESSAGE_DELETED']) bind(events[key], () => { this.cancel(); this.resetInspection(); this.status = '已切换上下文'; this.render(); });
            this.keyHandler = event => { if (event.key === 'Escape' && this.isOpen()) { event.stopImmediatePropagation(); this.close(); } };
            this.host.document.addEventListener('keydown',this.keyHandler,true);
        }
        isOpen() { return !!this.panel && !this.panel.hidden; }
        open() {
            if (this.isOpen()) return;
            this.createPanel();
            const terminal = this.host.Samsara && this.host.Samsara.terminal;
            if (terminal) this.returnState = terminal.suspend();
            this.panel.hidden = false; this.render();
        }
        close() {
            this.promptEditing=false;
            if (!this.isOpen()) return;
            this.panel.hidden = true;
            const terminal = this.host.Samsara && this.host.Samsara.terminal;
            if (terminal) terminal.restore(this.returnState);
            this.returnState = null;
        }
        toggle() { this.isOpen() ? this.close() : this.open(); }
