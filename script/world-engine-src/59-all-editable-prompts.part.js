    // 最终提示词层：把所有实际发送给 AI 的可变文字收口到统一注册表和提示词预设。
    const WORLD_ALL_PROMPT_VERSION=1;
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings)){
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.requestPrompts=worldEditablePromptDefaults();
    }

    function applyEditableWorldRequestTexts(engine,request,base) {
        const service=engine.services?.prompts;
        if(!service)return request;
        ACTIVE_WORLD_PROMPT_SERVICE=service;
        let payload=null;
        try{payload=JSON.parse(request.input);}catch(_){return request;}
        const get=(key,vars={})=>service.get(key,vars);

        if(plain(payload.输入语义)){
            payload.输入语义.世界书=get('input.worldbook');
            payload.输入语义.当前变量=get('input.currentState');
            payload.输入语义.正文楼层=get('input.prose');
            payload.输入语义.程序结构修复=get('input.structuralFix');
            payload.输入语义.时间线调度=get('input.timeline');
            payload.输入语义.WorldResult=get('input.worldResult');
            payload.输入语义.角色管理=get('input.personAudit');
            if(Object.hasOwn(payload.输入语义,'任务列表')||base?.stat?.任务?.列表)payload.输入语义.任务列表=get('input.taskList');
        }

        if(plain(payload.本轮必须完成的宏观骨架)){
            const rows=Array.isArray(payload.本轮必须完成的宏观骨架.已有可推进宏观节点)?payload.本轮必须完成的宏观骨架.已有可推进宏观节点:[];
            const current=rows.length,active=rows.filter(item=>item?.状态==='进行中').length,future=rows.filter(item=>item?.状态==='待发生').length;
            payload.本轮必须完成的宏观骨架.交付要求=macroBackbonePlan(current,active,future);
            payload.本轮必须完成的宏观骨架.规划与发生=get('macro.planning');
            payload.本轮必须完成的宏观骨架.验收=get('macro.acceptance');
        }
        if(Array.isArray(payload.本轮必须复核的到期事件)){
            payload.本轮必须复核的到期事件=payload.本轮必须复核的到期事件.map(item=>plain(item)?{...item,说明:get('due.review')}:item);
        }
        if(plain(payload.推演阶段))payload.推演阶段.知识来源=get('stage.knowledgePriority');
        if(plain(payload.正文可见投影规则))payload.正文可见投影规则.要求=get('proseProjection.requirement');
        payload.说明=get('request.finalNote');

        if(plain(payload.世界时间维护)){
            payload.世界时间维护.所有权=get('worldTime.owner');
            if(plain(payload.世界时间维护.初始化锚定)){
                payload.世界时间维护.初始化锚定.依据顺序=worldPromptLines('worldTime.initializationOrder','最新已确认正文\n当前阶段与当前地点\n已读取时间线/年表/章节资料\n模型已有原著知识\n谨慎推断');
                payload.世界时间维护.初始化锚定.禁止=get('worldTime.initializationForbidden');
            }
            payload.世界时间维护.正文时间职责=get('worldTime.proseDuty');
            payload.世界时间维护.精确日期格式=get('worldTime.dateFormat');
            payload.世界时间维护.推进原则=get('worldTime.advancePrinciple');
        }

        if(plain(payload.时间线基准)){
            const count=Array.isArray(request?.manifest?.原著时间轴?.时间线资料)?request.manifest.原著时间轴.时间线资料.length:0;
            payload.时间线基准.原著时间资料=count?get('chronology.evidenceFound',{count}):get('chronology.noEvidence');
            if(!plain(payload.时间线基准.规划原则))payload.时间线基准.规划原则={};
            payload.时间线基准.规划原则.滚动窗口=get('chronology.window');
            payload.时间线基准.规划原则.节点粒度=get('chronology.nodeGranularity');
            payload.时间线基准.规划原则.间隔自检=get('chronology.interval');
            payload.时间线基准.规划原则.时间精度=get('chronology.precision');
            payload.时间线基准.要求=get('chronology.requirement');
        }

        if(plain(payload.传闻维护))payload.传闻维护.取材边界=get('rumor.sourceBoundary');
        if(plain(payload.本轮世界活动交付)){
            payload.本轮世界活动交付.硬要求=[
                get('worldActivity.primary'),
                get('worldActivity.region'),
                get('worldActivity.faction'),
                get('worldActivity.event'),
                get('worldActivity.semantic')
            ].filter(Boolean);
        }

        request.input=JSON.stringify(payload,null,2);
        const worldResultHeading=get('system.worldResultHeading'),schemaHeading=get('system.schemaHeading');
        let system=String(request.system||'');
        system=system.replace('【WorldResult 业务输出协议】',worldResultHeading);
        system=system.replace('【Canonical WorldResult JSON Schema】\n程序实际字段定义（不可由文字说明改变）：',schemaHeading);
        request.system=system;
        request.manifest=request.manifest||{};
        request.manifest.可编辑提示词=engine.promptCatalog().map(item=>({key:item.key,category:item.category,title:item.title,估算Tokens:estimateTokens(item.value)}));
        request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
        return request;
    }

    const SamsaraWorldEngineBeforeAllEditablePrompts=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeAllEditablePrompts {
        constructor(host,env){
            super(host,env);
            ACTIVE_WORLD_PROMPT_SERVICE=this.services?.prompts||null;
            let dirty=false;
            const normalized=this.services.prompts.normalize(this.config.requestPrompts);
            if(!same(normalized,this.config.requestPrompts)){this.config.requestPrompts=normalized;dirty=true;}
            if(Number(this.config.worldAllPromptVersion||0)<WORLD_ALL_PROMPT_VERSION){
                if(this.config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)this.config.requestPrompts=worldEditablePromptDefaults();
                this.config.worldAllPromptVersion=WORLD_ALL_PROMPT_VERSION;dirty=true;
            }
            if(dirty)this.saveConfig();
        }
        promptCatalog(){
            const rows=[
                {key:'main.preset',category:'主工作流',title:'分段提示词',value:String(this.config.preset||'')},
                {key:'system.core',category:'主 system',title:'世界引擎核心约束',value:String(this.config.corePrompt??CORE_WORLD_RULES)},
                {key:'system.macro',category:'主 system',title:'宏观骨架',value:String(this.config.macroPrompt??DEFAULT_MACRO_PROMPT)},
                {key:'system.stability',category:'主 system',title:'世界自救模板',value:String(this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE)},
                {key:'system.npcAudit',category:'主 system',title:'NPC构筑审计',value:String(this.config.npcAuditPrompt??NPC_BUILD_AUDIT_RULES)},
                {key:'system.structure',category:'主 system',title:'WorldResult 协议说明',value:String(this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())}
            ];
            if(typeof WORLD_PROMPT_MODULE_DEFS!=='undefined'){
                const modules=normalizeWorldModulePrompts(this.config.modulePrompts);
                for(const item of WORLD_PROMPT_MODULE_DEFS)rows.push({key:'module.'+item.key,category:'运行模块 system',title:item.title,value:String(modules[item.key]||'')});
            }
            rows.push(...this.services.prompts.catalog());
            return rows;
        }
        applyPromptTextSettings(value){
            this.config.requestPrompts=this.services.prompts.setAll(value);
            this.config.worldAllPromptVersion=WORLD_ALL_PROMPT_VERSION;
            ACTIVE_WORLD_PROMPT_SERVICE=this.services.prompts;
            this.saveConfig();
            return copy(this.config.requestPrompts);
        }
        readPromptEditor(){
            const settings=super.readPromptEditor(),values=this.services.prompts.values();
            this.panel?.querySelectorAll?.('[data-request-prompt]')?.forEach?.(field=>{
                values[String(field.dataset.requestPrompt||'')]=String(field.value??'');
            });
            settings.requestPrompts=this.services.prompts.normalize(values);
            return settings;
        }
        applyPromptSettings(settings){
            const next=Object.assign({},settings||{});
            const requestPrompts=this.services.prompts.normalize(next.requestPrompts??this.config.requestPrompts);
            const result=super.applyPromptSettings(next);
            this.applyPromptTextSettings(requestPrompts);
            return result;
        }
        savePromptDocument(name,settings,activate=true){
            const next=Object.assign({},settings||{});
            next.requestPrompts=this.services.prompts.normalize(next.requestPrompts??this.config.requestPrompts);
            return super.savePromptDocument(name,next,activate);
        }
        importPromptDocument(raw){
            let parsed=null;try{parsed=JSON.parse(String(raw||''));}catch(_){}
            const source=plain(parsed?.settings)?parsed.settings:parsed;
            const imported=this.services.prompts.normalize(source?.requestPrompts);
            const doc=super.importPromptDocument(raw);
            if(doc?.settings){doc.settings.requestPrompts=imported;this.saveConfig();}
            return doc;
        }
        async buildRequest(base){
            ACTIVE_WORLD_PROMPT_SERVICE=this.services.prompts;
            const request=await super.buildRequest(base);
            return applyEditableWorldRequestTexts(this,request,base);
        }
        async requestHistoryMemorySummary(world,batch,outputLevel){
            ACTIVE_WORLD_PROMPT_SERVICE=this.services.prompts;
            const savedTransport=this.lastTransportInfo;
            try{
                let payload=null;
                try{payload=JSON.parse(historyMemoryPrompt(world,batch,outputLevel));}catch(_){payload={};}
                payload.说明=this.services.prompts.get('history.inputInstruction');
                const raw=await this.requestAI(
                    this.services.prompts.get('history.system'),
                    JSON.stringify(payload,null,2),
                    {schema:HISTORY_MEMORY_SCHEMA,schemaName:'samsara_world_history_summary_v1',structured:'auto',temperature:0.2}
                );
                return historyMemoryParseReply(raw);
            } finally {
                this.lastTransportInfo=savedTransport;
            }
        }
        mountAllEditablePrompts(){
            if(this.tab!=='提示词预设'||!this.panel)return;
            const main=this.panel.querySelector('main');if(!main)return;
            let block=main.querySelector('[data-all-request-prompts]');
            if(!block){
                block=this.host.document.createElement('section');
                block.className='we-section';block.dataset.allRequestPrompts='';
                const modules=main.querySelector('[data-world-module-prompts]');
                if(modules)modules.insertAdjacentElement('afterend',block);else main.appendChild(block);
            }
            const grouped=new Map();
            for(const item of this.services.prompts.catalog()){
                if(!grouped.has(item.category))grouped.set(item.category,[]);
                grouped.get(item.category).push(item);
            }
            const editable=!!this.promptEditing;
            block.innerHTML='<div class="we-section-head"><h2>请求 / 重试 / 历史提示词</h2><small>实际发送文字 · 全部可编辑</small></div>'
                +'<div class="we-notice">这里收口以前散落在 buildRequest、时间轴、传闻、世界活动、纠错重试和历史压缩代码里的指令文字。程序 Schema、枚举、字段路径与校验器仍由代码固定。</div>'
                +Array.from(grouped).map(([category,items])=>'<details class="we-book" open><summary>'+escape(category)+' <small>'+items.length+' 项</small></summary><div class="we-segment-list">'
                    +items.map(item=>'<details class="we-segment"><summary>'+escape(item.title)+' <small>'+escape(item.key)+' · '+formatTokenCount(estimateTokens(item.value),true)+'</small></summary><textarea data-request-prompt="'+escape(item.key)+'" '+(editable?'':'readonly')+'>'+escape(item.value)+'</textarea></details>').join('')
                    +'</div></details>').join('');
        }
        render(force=false){
            const result=super.render(force);
            this.mountAllEditablePrompts();
            return result;
        }
    };
