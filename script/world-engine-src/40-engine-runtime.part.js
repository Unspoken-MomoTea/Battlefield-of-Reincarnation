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
            this.services={};
            const mutationService=new WorldEngineMutationService(this);
            this.services.mutations=mutationService;
            this.services.events=new WorldEventService(this,mutationService);
            this.services.people=new WorldPersonActivityService(this,mutationService);
            this.services.prompts=new WorldEnginePromptService(this);
            this.services.requests=new WorldEngineRequestService(this,this.services.prompts);
            this.services.requestBuilder=new WorldEngineRequestBuilderService(this,this.services.prompts);
            this.services.runner=new WorldEngineRunService(this);
            this.services.history=new WorldHistoryMemoryService(this,this.services.prompts);
            this.views=new WorldEngineViewRegistry(this);
            this.uiController=new WorldEngineUIController(this);
            this.promptService=this.services.prompts;
            const normalizedRequestPrompts=this.services.prompts.normalize(this.config.requestPrompts);
            if(!same(normalizedRequestPrompts,this.config.requestPrompts)){
                this.config.requestPrompts=normalizedRequestPrompts;
                this.saveConfig();
            }
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
            const mvu = this.env.Mvu || this.host.Mvu;
            const getMessages = this.fn('getChatMessages');
            if (!mvu || !getMessages) throw new Error('等待 MVU 与酒馆消息接口');
            const message = getMessages(-1)[0];
            if (!message) throw new Error('当前没有消息');
            const id = message.message_id != null ? message.message_id : message.id;
            if (!Number.isInteger(Number(id))) throw new Error('当前楼层编号无效');
            const raw = mvu.getMvuData({type:'message',message_id:Number(id)});
            if (!raw || !raw.stat_data || !raw.stat_data.世界) throw new Error('当前楼层尚未初始化 MVU');
            const context = this.host.SillyTavern && this.host.SillyTavern.getContext ? this.host.SillyTavern.getContext() : {};
            const chatFn = this.fn('getCurrentChatId');
            const chat = chatFn ? chatFn() : context.chatId;
            if (chat == null) throw new Error('无法确认当前聊天标识');
            const text = String(message.message != null ? message.message : message.mes || '');
            const fingerprint = JSON.stringify([String(chat),Number(id),message.swipe_id || 0,digest(text)]);
            return {mvu,raw:copy(raw),stat:copy(raw.stat_data),id:Number(id),text,fingerprint,message};
        }
        blocked(snapshot) {
            const s = snapshot.stat;
            if ((s.系统状态 || {}).是否在主神空间 || s.世界.名称 === '主神空间') return '当前位于主神空间，副本推进暂停';
            if (!s.世界.名称 || s.世界.名称 === '待初始化') return '等待副本初始化';
            if (/轮回清算协议/.test(snapshot.text)) return '结算楼层由结算美化程序处理';
            if (snapshot.message.is_user || snapshot.message.role === 'user') return '等待正文完成';
            return '';
        }
        saveConfig() {
            try{this.host.localStorage?.setItem?.(CONFIG,JSON.stringify(this.config));}catch(_){}
        }
        normalizeDedicatedApi(value) {
            const api=plain(value)?value:{};
            return {
                enabled:api.enabled===true,
                apiUrl:String(api.apiUrl||'').trim(),
                apiKey:String(api.apiKey||''),
                model:String(api.model||'').trim(),
                apiPresets:Array.isArray(api.apiPresets)?api.apiPresets.filter(plain).map(p=>({
                    name:String(p.name||'').trim().slice(0,80),
                    apiUrl:String(p.apiUrl||'').trim(),
                    apiKey:String(p.apiKey||''),
                    model:String(p.model||'').trim()
                })).filter(p=>p.name).slice(0,30):[],
                fetchedModels:Array.isArray(api.fetchedModels)?api.fetchedModels.map(String).filter(Boolean).slice(0,500):[]
            };
        }
        usesDedicatedApi() { return this.config.dedicatedApi?.enabled===true; }
        dedicatedApiReady() {
            const api=this.config.dedicatedApi||{};
            return api.enabled===true&&!!String(api.apiUrl||'').trim()&&!!String(api.model||'').trim();
        }
        apiSourceLabel() { return this.usesDedicatedApi()?'世界推进专属 API':'主神终端额外模型'; }
        setDedicatedApi(patch) {
            const current=this.normalizeDedicatedApi(this.config.dedicatedApi);
            const next=this.normalizeDedicatedApi(Object.assign({},current,plain(patch)?patch:{}));
            if(patch&&Object.hasOwn(patch,'apiUrl')&&String(patch.apiUrl||'').trim()!==current.apiUrl)next.fetchedModels=[];
            this.config.dedicatedApi=next;
            this.saveConfig();
            return next;
        }
        saveDedicatedApiPreset(name) {
            const clean=String(name||'').trim().slice(0,80);
            if(!clean)throw new Error('请输入 API 预设名称');
            const api=this.normalizeDedicatedApi(this.config.dedicatedApi);
            const entry={name:clean,apiUrl:api.apiUrl,apiKey:api.apiKey,model:api.model};
            const idx=api.apiPresets.findIndex(p=>p.name===clean);
            if(idx>=0)api.apiPresets[idx]=entry;else api.apiPresets.unshift(entry);
            api.apiPresets=api.apiPresets.slice(0,30);
            this.config.dedicatedApi=api;this.saveConfig();return entry;
        }
        deleteDedicatedApiPreset(name) {
            const clean=String(name||'').trim(),api=this.normalizeDedicatedApi(this.config.dedicatedApi);
            const before=api.apiPresets.length;api.apiPresets=api.apiPresets.filter(p=>p.name!==clean);
            this.config.dedicatedApi=api;this.saveConfig();return before!==api.apiPresets.length;
        }
        applyDedicatedApiPreset(name) {
            const api=this.normalizeDedicatedApi(this.config.dedicatedApi),preset=api.apiPresets.find(p=>p.name===String(name||''));
            if(!preset)throw new Error('API 预设不存在');
            api.apiUrl=preset.apiUrl;api.apiKey=preset.apiKey;api.model=preset.model;api.fetchedModels=[];
            this.config.dedicatedApi=api;this.saveConfig();return api;
        }
        dedicatedEndpoint(kind='chat') {
            const api=this.normalizeDedicatedApi(this.config.dedicatedApi);
            let endpoint=String(api.apiUrl||'').trim().replace(/\/+$/,'');
            if(!endpoint)throw new Error('请先填写专属 API 地址');
            if(kind==='models'){
                if(/\/chat\/completions$/i.test(endpoint))endpoint=endpoint.replace(/\/chat\/completions$/i,'/models');
                else if(/\/v1$/i.test(endpoint))endpoint+='/models';
                else if(/\/v1\//i.test(endpoint))endpoint=endpoint.replace(/\/v1\/.*$/i,'/v1/models');
                else endpoint+=/\/v\d+$/i.test(endpoint)?'/models':'/v1/models';
                return endpoint;
            }
            if(/\/chat\/completions$/i.test(endpoint))return endpoint;
            if(/\/v1$/i.test(endpoint))return endpoint+'/chat/completions';
            if(/\/v1\//i.test(endpoint))return endpoint.replace(/\/v1\/.*$/i,'/v1/chat/completions');
            return endpoint+(/\/v\d+$/i.test(endpoint)?'/chat/completions':'/v1/chat/completions');
        }
        async fetchDedicatedModels() {
            const api=this.normalizeDedicatedApi(this.config.dedicatedApi),fetcher=this.host.fetch||(typeof fetch!=='undefined'?fetch:null);
            if(!fetcher)throw new Error('当前环境没有 fetch');
            const headers={};if(api.apiKey.trim())headers.Authorization='Bearer '+api.apiKey.trim();
            const response=await fetcher(this.dedicatedEndpoint('models'),{headers});
            if(!response.ok){
                let body='';try{body=await response.text();}catch(_){}
                throw new Error('加载模型失败：HTTP '+response.status+(body?' / '+body.slice(0,240):''));
            }
            const body=await response.json();
            const raw=Array.isArray(body?.data)?body.data:Array.isArray(body?.models)?body.models:[];
            const models=raw.map(item=>typeof item==='string'?item:item?.id||item?.name).filter(Boolean).map(String);
            if(!models.length)throw new Error('API 返回的模型列表为空');
            api.fetchedModels=Array.from(new Set(models)).sort().slice(0,500);
            if(api.model&&!api.fetchedModels.includes(api.model))api.fetchedModels.unshift(api.model);
            this.config.dedicatedApi=api;this.saveConfig();return api.fetchedModels;
        }
        structuredUnsupported(status,body) {
            const code=Number(status),text=String(body||'');
            return [400,404,415,422].includes(code)&&/response[_ -]?format|json[_ -]?schema|json[_ -]?object|unknown (?:field|parameter)|unrecognized|unsupported|not supported|invalid.*schema|INVALID_ARGUMENT|invalid[_ -]?argument/i.test(text);
        }
        async requestDedicatedApi(system,input,options={}) {
            const api=this.normalizeDedicatedApi(this.config.dedicatedApi),fetcher=this.host.fetch||(typeof fetch!=='undefined'?fetch:null);
            if(!this.dedicatedApiReady())throw new Error('世界推进专属 API 已启用，但地址或模型未配置完整');
            if(!fetcher)throw new Error('当前环境没有 fetch');
            const endpoint=this.dedicatedEndpoint('chat'),headers={'Content-Type':'application/json'};
            if(api.apiKey.trim())headers.Authorization='Bearer '+api.apiKey.trim();
            const cacheKey=endpoint+'|'+api.model,wants=options.structured==='auto'&&plain(options.schema);
            const cached=wants?this.apiModeCache[cacheKey]:'';
            const modes=!wants?['plain']:cached==='json_schema'?['json_schema','json_object','plain']:cached==='json_object'?['json_object','plain']:cached==='plain'?['plain']:['json_schema','json_object','plain'];
            let lastError='';const modeAttempts=[];
            for(const mode of modes){
                modeAttempts.push(mode);
                const body={
                    model:api.model,
                    messages:[{role:'system',content:String(system||'')},{role:'user',content:String(input||'')}],
                    stream:false,
                    temperature:Number.isFinite(Number(options.temperature))?Number(options.temperature):0.3
                };
                if(mode==='json_schema')body.response_format={type:'json_schema',json_schema:{name:String(options.schemaName||'samsara_world_result').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,64),strict:false,schema:options.schema}};
                else if(mode==='json_object')body.response_format={type:'json_object'};
                const response=await fetcher(endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:options.signal});
                if(!response.ok){
                    let err='';try{err=await response.text();}catch(_){}
                    lastError='HTTP '+response.status+': '+response.statusText+(err?' / '+err.slice(0,300):'');
                    if(mode!=='plain'&&this.structuredUnsupported(response.status,err)){delete this.apiModeCache[cacheKey];continue;}
                    this.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:mode,尝试模式:copy(modeAttempts),usage:null};
                    throw new Error(lastError);
                }
                const data=await response.json(),message=data?.choices?.[0]?.message;
                const raw=message?.content;
                const content=typeof raw==='string'?raw:(plain(raw)?JSON.stringify(raw):message?.parsed?JSON.stringify(message.parsed):'');
                if(!content)throw new Error('专属 API 返回内容为空');
                if(wants)this.apiModeCache[cacheKey]=mode;
                this.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:mode,尝试模式:copy(modeAttempts),usage:normalizeTokenUsage(data?.usage)};
                return content;
            }
            throw new Error(lastError||'专属 API 不支持当前结构化输出模式');
        }
        async requestAI(system,input,options={}) {
            if(this.usesDedicatedApi()){
                const api=this.normalizeDedicatedApi(this.config.dedicatedApi);
                this.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:'请求中',尝试模式:[],usage:null};
                return this.requestDedicatedApi(system,input,options);
            }
            const terminal=this.host.Samsara&&this.host.Samsara.terminal;
            if(!terminal||typeof terminal.request!=='function'||!terminal.apiReady?.())throw new Error('请在主神终端设置中启用额外模型并选择模型');
            this.lastTransportInfo={接口:'主神终端额外模型',模型:'',结构化模式:options.structured==='auto'?'auto（由主神终端协商）':'plain',尝试模式:[],usage:null};
            return terminal.request(system,input,options);
        }
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
        getPromptDocuments() {
            if(!Array.isArray(this.config.promptDocuments))this.config.promptDocuments=[];
            return this.config.promptDocuments;
        }
        savePromptDocument(name,settings,activate=true) {
            const clean=String(name||'').trim().slice(0,80);
            if(!clean)throw new Error('请先填写预设文档名称');
            if(clean===BUILTIN_DEFAULT_PROMPT_DOCUMENT.name)throw new Error('“默认设置”是内置文档，请换一个名称保存自定义版本');
            const docs=this.getPromptDocuments(),now=new Date().toISOString();
            let doc=docs.find(item=>!item.builtin&&item.id===this.config.activePromptDocumentId&&item.name===clean)||docs.find(item=>!item.builtin&&item.name===clean);
            if(doc){
                doc.name=clean;doc.updatedAt=now;doc.settings=copy(settings);
            }else{
                doc={id:'prompt-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name:clean,createdAt:now,updatedAt:now,settings:copy(settings)};
                docs.unshift(doc);
            }
            this.config.promptDocuments=docs.slice(0,60);
            if(activate)this.config.activePromptDocumentId=doc.id;
            this.saveConfig();
            return doc;
        }
        deletePromptDocument(id) {
            if(id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)return false;
            const before=this.getPromptDocuments().length;
            this.config.promptDocuments=this.getPromptDocuments().filter(doc=>doc.id!==id);
            if(this.config.activePromptDocumentId===id)delete this.config.activePromptDocumentId;
            this.saveConfig();
            return before!==this.config.promptDocuments.length;
        }
        importPromptDocument(raw) {
            let parsed;try{parsed=JSON.parse(String(raw||''));}catch(_){throw new Error('导入文件不是有效 JSON');}
            const settings=plain(parsed.settings)?parsed.settings:parsed;
            if(typeof settings.preset!=='string')throw new Error('导入文件缺少 preset');
            if(settings.preset.length>30000)throw new Error('导入预设超过30000字');
            const name=String(parsed.name||settings.name||'导入预设').trim().slice(0,80)||'导入预设';
            const normalized={
                corePrompt:typeof settings.corePrompt==='string'?settings.corePrompt:CORE_WORLD_RULES,
                macroPrompt:typeof settings.macroPrompt==='string'?settings.macroPrompt:DEFAULT_MACRO_PROMPT,
                stabilityPromptTemplate:typeof settings.stabilityPromptTemplate==='string'?settings.stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,
                npcAuditPrompt:typeof settings.npcAuditPrompt==='string'?settings.npcAuditPrompt:undefined,
                structurePrompt:typeof settings.structurePrompt==='string'?settings.structurePrompt:undefined,
                preset:normalizeEditablePreset(settings.preset),
                contextTurns:Math.max(1,Math.min(100,Number(settings.contextTurns)||6)),
                activationMode:settings.activationMode==='force_selected'?'force_selected':'respect_activation',
                selectedEntries:Array.isArray(settings.selectedEntries)?settings.selectedEntries.filter(x=>typeof x==='string'):null
            };
            return this.savePromptDocument(name,normalized,false);
        }
        exportPromptDocument(id) {
            const doc=this.getPromptDocuments().find(item=>item.id===id);
            if(!doc)throw new Error('预设文档不存在');
            const BlobCtor=this.host.Blob||(typeof Blob!=='undefined'?Blob:null);
            const URLApi=this.host.URL||(typeof URL!=='undefined'?URL:null);
            if(!BlobCtor||!URLApi?.createObjectURL)throw new Error('当前环境不支持文件导出');
            const exportedSettings=Object.assign({corePrompt:CORE_WORLD_RULES,macroPrompt:DEFAULT_MACRO_PROMPT,stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,npcAuditPrompt:NPC_BUILD_AUDIT_RULES,structurePrompt:protocol().split('【Canonical WorldResult JSON Schema】')[0].trim()},copy(doc.settings));
            const payload={type:'samsara-world-prompt-document',version:2,name:doc.name,exportedAt:new Date().toISOString(),settings:exportedSettings};
            const blob=new BlobCtor([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
            const href=URLApi.createObjectURL(blob),a=this.host.document.createElement('a');
            a.href=href;a.download=doc.name.replace(/[\\/:*?"<>|]+/g,'_')+'.world-prompt.json';a.style.display='none';
            this.host.document.body.appendChild(a);a.click();a.remove();
            setTimeout(()=>URLApi.revokeObjectURL(href),1000);
        }
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
            const get=this.fn('getWorldbook');
            if(!get)return [];
            const sources=new Map(),addSource=(book,label)=>{
                const name=String(book||'').trim();if(!name)return;
                if(!sources.has(name))sources.set(name,new Set());
                sources.get(name).add(label);
            };
            const namesFn=this.fn('getCharWorldbookNames');
            if(namesFn){
                const names=await namesFn('current')||{};
                addSource(names.primary,'角色主书');
                for(const book of names.additional||[])addSource(book,'角色附加');
            }
            const chatFn=this.fn('getChatWorldbookName');
            if(chatFn){
                try{addSource(await chatFn('current'),'聊天绑定');}catch(_){}
            }
            const globalFn=this.fn('getGlobalWorldbookNames');
            if(globalFn){
                try{for(const book of await globalFn()||[])addSource(book,'全局启用');}catch(_){}
            }
            const result=[];
            for(const [book,labels] of sources){
                const entries=await get(book)||[];
                entries.forEach((e,i)=>{
                    const title=e.name||e.comment||'未命名';
                    result.push({
                        book,id:String(e.uid??e.id??i),title,sources:Array.from(labels),
                        technical:isTechnicalBook(title),enabled:e.enabled!==false&&!e.disable&&!e.disabled,
                        mode:e.strategy?.type||e.type||(e.constant===false?'selective':'constant'),
                        keys:e.strategy?.keys||e.keys||e.key||[],
                        secondary:e.strategy?.keys_secondary||e.keys_secondary||e.secondary_keys||{},
                        content:e.content||''
                    });
                });
            }
            this.applyBuiltinDefaultWorldbookExclusions(result);
            return result;
        }
        async worldbook(scan='', options={}) {
            const catalogue=await this.catalogue(),output=[];
            this.bookCatalogue=catalogue;
            const report=[];this.readReport=report;
            for(const e of catalogue){
                const selected=!e.technical&&selectedEntryMatches(e,this.config.selectedEntries);
                const timelineBackbone=!!options.timelineBackbone&&selected&&e.enabled&&isTimelineBackboneEntry(e.title);
                const decision=e.technical?{read:false,reason:'世界引擎技术条目已隔离'}:timelineBackbone?{read:true,reason:'宏观资料补充'}:selected?activation(e,scan,this.config.activationMode==='force_selected'):{read:false,reason:'未勾选'};
                report.push({世界书:e.book,条目ID:e.id,名称:e.title,灯:e.mode==='constant'?'蓝灯':e.mode==='selective'?'绿灯':'其他',读取:decision.read,原因:decision.reason});
                if(!decision.read)continue;
                let content=e.content;
                if(content.includes('<%')){
                    const ejs=this.host.EjsTemplate;
                    if(!ejs?.evalTemplate||!ejs?.prepareContext)throw new Error('所选世界书含动态模板，需要 EJS 扩展：'+e.title);
                    content=await ejs.evalTemplate(content,await ejs.prepareContext({}));
                }
                output.push({世界书:e.book,条目ID:e.id,名称:e.title,内容:content});
            }
            Object.defineProperty(output,'report',{value:report});
            return output;
        }
        async buildRequest(base) {
            return this.services.requestBuilder.build(base);
        }
        buildRetryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan=[]) {
            return this.services.requests.retry(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan);
        }
        schedule() {
            if (this.disposed || this.committing || !this.isEnabled()) return;
            if (this.busy) { this.pending = true; return; }
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.run().catch(() => {}), 900);
        }
        async run() {
            return this.services.runner.run();
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
