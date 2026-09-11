    // 任务感知层：任务.列表是现有 MVU 的唯一正式任务账簿；世界引擎只读消费，不建立第二套后台任务库。
    const TASK_AWARENESS_RULES=`【任务感知 · 只读】
1. 当前变量.任务.列表仅用于世界因果推演；任务状态机以<任务与委托系统>为准。可据此维持委托人、目标、相关人物、地区、事件与传播的连续性，世界不会因<user>暂未处理任务而冻结。
2. 任务.列表是唯一正式任务账簿。不得通过 WorldResult 新增、修改、删除任务，不得自动推进任务状态、交付、结算或发奖；只能把任务带来的客观后果写入世界事件、人物、势力地区、探索或传播等本引擎已有字段。
3. 情报交易由世界引擎生成、刷新或因失去交易价值而淘汰；购买、付款与消费性删除由MVU按正文结果处理。若购买形成任务，也由变量AI按<任务与委托系统>写入任务.列表；世界引擎下一轮只读接续，不得代扣款、不得代付款、不得创建任务。
4. 副本成就、击杀统计与任务奖励/惩罚不进入世界推进上下文。`;
    const TASK_WORLD_BOOK_TITLE='任务与委托系统';
    // 旧版曾把正式任务规则从内置默认资料中排除；现在恢复为可读取的权威规则。
    BUILTIN_DEFAULT_WORLD_BOOK_EXCLUSIONS.delete(TASK_WORLD_BOOK_TITLE);

    function projectTaskListForWorld(value) {
        if(!plain(value))return {};
        const out={};
        for(const [name,task] of Object.entries(value)){
            if(!plain(task))continue;
            const projected={};
            for(const key of ['委托方','目标','隐藏真相','难度','交付','状态']){
                if(Object.hasOwn(task,key))projected[key]=copy(task[key]);
            }
            if(Object.keys(projected).length)out[name]=projected;
        }
        return out;
    }

    const projectWorldContextBeforeTaskAwareness=projectWorldContext;
    projectWorldContext=function(stat) {
        const out=projectWorldContextBeforeTaskAwareness(stat);
        const tasks=projectTaskListForWorld(stat?.任务?.列表);
        if(Object.keys(tasks).length)out.任务={列表:tasks};
        // 旧存档里已有的事件→任务索引仍有因果价值，只读恢复；WorldResult 仍没有任务写入口。
        const sourceEvents=stat?.世界?.[PATH]?.事件||{},projectedEvents=out?.世界?.[PATH]?.事件||{};
        for(const [name,event] of Object.entries(projectedEvents)){
            const related=sourceEvents?.[name]?.关联任务;
            if(plain(event)&&Array.isArray(related)&&related.length)event.关联任务=copy(related);
        }
        return out;
    };

    const SamsaraWorldEngineBeforeTaskAwareness=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeTaskAwareness {
        restoreTaskWorldbookSelection(catalogue) {
            if(this.config.activePromptDocumentId!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id||!Array.isArray(catalogue))return false;
            const matches=catalogue.filter(entry=>normalizeWorldbookEntryTitle(entry.title)===TASK_WORLD_BOOK_TITLE&&!entry.technical);
            let changed=false;
            if(matches.length){
                const selected=Array.isArray(this.config.selectedEntries)?copy(this.config.selectedEntries):[];
                for(const entry of matches){
                    const raw=JSON.stringify([entry.book,entry.id]);
                    if(!selected.includes(raw)){selected.push(raw);changed=true;}
                }
                this.config.selectedEntries=selected;
            }
            const applied=Array.isArray(this.config.builtinDefaultWorldbookExclusionsApplied)?this.config.builtinDefaultWorldbookExclusionsApplied:[];
            const cleaned=applied.filter(title=>title!==TASK_WORLD_BOOK_TITLE);
            if(cleaned.length!==applied.length){this.config.builtinDefaultWorldbookExclusionsApplied=cleaned;changed=true;}
            if(changed){
                const builtin=this.getPromptDocuments().find(doc=>doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id);
                if(builtin?.settings)builtin.settings.selectedEntries=copy(this.config.selectedEntries||[]);
                this.saveConfig();
            }
            return changed;
        }
        async catalogue() {
            const result=await super.catalogue();
            this.restoreTaskWorldbookSelection(result);
            return result;
        }
        async buildRequest(base) {
            const request=await super.buildRequest(base);
            const payload=JSON.parse(request.input);
            if(plain(payload.输入语义)){
                payload.输入语义.当前变量='世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期历史、近期因果偏移，以及任务.列表的只读因果字段。任务奖励、惩罚、副本成就、击杀、商城与纯结算数据不进入世界推进。';
                payload.输入语义.任务列表='只读。用于人物、事件、势力地区、探索与传播的因果连续性；正式状态机、购买转任务、交付、结算与奖励仍由MVU及<任务与委托系统>负责。';
            }
            request.input=JSON.stringify(payload,null,2);
            // 兼容上一版传闻活跃层中的旧措辞；购买后的消费性 remove 不属于世界引擎。
            request.system=String(request.system||'').replace(
                '情报交易有卖家时更新1~2条，购买后移除；',
                '情报交易有卖家时更新1~2条；购买结算由变量AI按正文事实处理；'
            )+'\n\n'+TASK_AWARENESS_RULES;
            request.manifest=Object.assign({},request.manifest,{任务感知:{任务数量:Object.keys(payload?.当前变量?.任务?.列表||{}).length,只读:true,副本成就:false}});
            request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema);
            if(request.system.length+request.input.length>240000)throw new Error('请求超过内部安全上限（'+formatTokenCount(estimateTokens(request.system)+estimateTokens(request.input),true)+'），请减少所选条目或正文层数');
            return request;
        }
    };
