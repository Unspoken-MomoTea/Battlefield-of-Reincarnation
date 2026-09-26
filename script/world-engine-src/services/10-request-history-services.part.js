    // 请求与历史服务：将请求文本装配、纠错请求和历史压缩从主引擎类中抽离。
    class WorldEngineRequestService {
        constructor(engine,prompts){this.engine=engine;this.prompts=prompts;}
        get(key,vars={}){return this.prompts.get(key,vars);}
        retry(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan=[]){
            ACTIVE_WORLD_PROMPT_SERVICE=this.prompts;
            return retryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan,this.prompts);
        }
        finalize(request,base){
            ACTIVE_WORLD_PROMPT_SERVICE=this.prompts;
            let payload=null;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            const get=(key,vars={})=>this.get(key,vars);

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
            if(Array.isArray(payload.本轮必须复核的到期事件))payload.本轮必须复核的到期事件=payload.本轮必须复核的到期事件.map(item=>plain(item)?{...item,说明:get('due.review')}:item);
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
                    get('worldActivity.primary'),get('worldActivity.region'),get('worldActivity.faction'),get('worldActivity.event'),get('worldActivity.semantic')
                ].filter(Boolean);
            }

            request.input=JSON.stringify(payload,null,2);
            let system=String(request.system||'');
            if(typeof WORLD_ACTIVITY_DELIVERY_RULES==='string'&&WORLD_ACTIVITY_DELIVERY_RULES)system=system.split(WORLD_ACTIVITY_DELIVERY_RULES).join(get('system.worldActivity'));
            system=system.replace('【WorldResult 业务输出协议】',get('system.worldResultHeading'));
            system=system.replace('【Canonical WorldResult JSON Schema】\n程序实际字段定义（不可由文字说明改变）：',get('system.schemaHeading'));
            request.system=system;
            request.manifest=request.manifest||{};
            request.manifest.可编辑提示词=this.engine.promptCatalog().map(item=>({key:item.key,category:item.category,title:item.title,估算Tokens:estimateTokens(item.value)}));
            request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            return request;
        }
    }

    class WorldHistoryMemoryService {
        constructor(engine,prompts){this.engine=engine;this.prompts=prompts;}
        async requestSummary(world,batch,outputLevel){
            ACTIVE_WORLD_PROMPT_SERVICE=this.prompts;
            const engine=this.engine,savedTransport=engine.lastTransportInfo;
            try{
                let payload=null;
                try{payload=JSON.parse(historyMemoryPrompt(world,batch,outputLevel));}catch(_){payload={};}
                payload.说明=this.prompts.get('history.inputInstruction');
                const raw=await engine.requestAI(
                    this.prompts.get('history.system'),
                    JSON.stringify(payload,null,2),
                    {schema:HISTORY_MEMORY_SCHEMA,schemaName:'samsara_world_history_summary_v1',structured:'auto',temperature:0.2}
                );
                return historyMemoryParseReply(raw);
            } finally {
                engine.lastTransportInfo=savedTransport;
            }
        }
        project(stat){return projectWorldHistoryMemory(stat?.世界?.[PATH]||{});}
    }
