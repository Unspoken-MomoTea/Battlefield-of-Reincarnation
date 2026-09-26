    // 世界推进领域服务：SamsaraWorldEngine 只做协调，业务读写由独立类负责。
    const WORLD_EDITABLE_PROMPT_DEFS=Object.freeze([
        Object.freeze({key:'input.worldbook',category:'请求输入说明',title:'世界书语义',fallback:'可选设定/原著差异/时间资料；不是已发生事实，没有世界书也必须正常推演。'}),
        Object.freeze({key:'input.currentState',category:'请求输入说明',title:'当前变量语义',fallback:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期历史、近期因果偏移，以及任务.列表的只读因果字段。任务奖励、惩罚、副本成就、击杀、商城与纯结算数据不进入世界推进。'}),
        Object.freeze({key:'input.prose',category:'请求输入说明',title:'正文楼层语义',fallback:'已经演出的剧情；用于确认当前事实与时间跨度，不复述成后台日常。'}),
        Object.freeze({key:'input.structuralFix',category:'请求输入说明',title:'程序结构修复语义',fallback:'引擎已做的确定性纠正；不得在输出中恢复被程序降级/修正的旧错误。'}),
        Object.freeze({key:'input.timeline',category:'请求输入说明',title:'时间线调度语义',fallback:'程序计算出的宏观边界与到期复核要求；模型负责语义推演，不重定义调度协议。'}),
        Object.freeze({key:'input.worldResult',category:'请求输入说明',title:'WorldResult 语义',fallback:'唯一业务交付物；不包含 JSON Pointer、add/replace 路径或程序日志。'}),
        Object.freeze({key:'input.personAudit',category:'请求输入说明',title:'角色管理语义',fallback:'若提供NPC构筑审计，只处理列出的既有NPC缺口；完整构筑资料只在审计对象中提供，避免全量NPC重复占用上下文。'}),
        Object.freeze({key:'input.taskList',category:'请求输入说明',title:'任务列表语义',fallback:'只读因果账本。事件可通过关联任务引用已存在任务；不得创建、删除、改状态、交付或结算任务。'}),
        Object.freeze({key:'macro.backboneSummary',category:'宏观调度',title:'宏观骨架数量要求',fallback:'宏观骨架：当前可推进宏观节点{{current}}个（进行中{{active}}、待发生{{future}}），还需补充至少{{missing}}个真正的宏观节点；已确认正在发生的阶段转折可记进行中，其余新增节点记待发生。会合、撤离、赶路、局部争夺/突破等近期节点不计入宏观骨架，不要反复把它们改标为宏观节点。'}),
        Object.freeze({key:'macro.delivery',category:'宏观调度',title:'宏观事件交付',fallback:'事件交付：在 WorldResult.事件 中实际建立节点，分类=宏观节点；描述说明篇章、地区整体局势、战争、势力格局或关键人物命运的一个阶段转折，不能只在摘要或因果轨道里列名字。已有合格节点沿用原名，只提交缺失或变化字段。'}),
        Object.freeze({key:'macro.schedule',category:'宏观调度',title:'宏观排期',fallback:'宏观排期：每个新增节点必须给出明确时间锚点；沿用明确资料的日期或时间精度，精确日期未知时使用可理解的相对/因果时间，不写近期/稍后/未来/待定/未知。条件按需填写。前因只能引用已存在，或本轮同时提交且成功建立的事件名称；无明确前因使用 []，不得用当前阶段或自然语言原因代替事件名。'}),
        Object.freeze({key:'macro.causal',category:'宏观调度',title:'宏观因果轨道',fallback:'因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序；只使用最终3~5个仍可推进且 分类=宏观节点 的不同事件名称，不要写当前阶段、当前事件或近期节点。'}),
        Object.freeze({key:'macro.planning',category:'宏观调度',title:'宏观规划与发生',fallback:'本轮必须补齐骨架，不能以时间未推进、正文没有宏观变化或无业务变化为由省略。建立待发生节点属于未来规划，可排在下一宏观边界之后，不表示事件现在发生；近期细节与已发生事实仍受本轮时间容量和下一宏观边界限制。不得为凑数提前原著日期，或预先结算未来事件的结果；更新时间使用当前世界时间。'}),
        Object.freeze({key:'macro.acceptance',category:'宏观调度',title:'宏观验收',fallback:'按已有状态与本轮结果合并后计数；若本轮结束或取消已有宏观节点，须补足被移出窗口的数量。重试时以已接受业务结果和最新补充清单为准，不重复创建已接受节点。'}),
        Object.freeze({key:'due.review',category:'宏观调度',title:'到期事件复核',fallback:'时间已到；逐项核验条件与前因，符合则转进行中；未符合必须更新下次检查并解释阻碍，不得无声跳过。'}),
        Object.freeze({key:'stage.knowledgePriority',category:'宏观调度',title:'知识来源优先级',fallback:'当前确认事实 > 明确世界书设定（若有） > 模型已有原著/世界知识 > 谨慎推断'}),
        Object.freeze({key:'proseProjection.requirement',category:'正文投影',title:'正文可见投影规则',fallback:'非战斗正文会读取完整因果轨道：当前阶段用于当前局势，故事线/下一节点用于长期叙事方向，偏移记录用于跨章因果记忆；这些是规划依据，不等于角色预知或自动知晓幕后信息。正文还会读取进行中当前事件的公开字段，以及程序筛选的场外场景：每个热地区只出现一次共享环境/现场群体，人物列表只携带各自行动事实，关联事件只作索引；活跃异端始终保留在其所在热场景。以上均用于叙事连续性，不代表角色已知。可能影响当前场景的当前事件应维护公开征兆和可见影响；不要把隐藏条件、默认走向或未来宏观事件详情塞进公开字段。'}),
        Object.freeze({key:'request.finalNote',category:'请求输入说明',title:'请求最终说明',fallback:'当前变量为已确认热事实，不重复结算；已归档旧事件和已回收传播不要重新创建；世界书为空不构成阻塞；只提交业务事实，存储路径由程序编译。'}),
        Object.freeze({key:'worldTime.owner',category:'世界时间',title:'世界时间所有权',fallback:'世界推进独占写入；变量 AI 只读'}),
        Object.freeze({key:'worldTime.initializationOrder',category:'世界时间',title:'世界时间初始化依据顺序',fallback:'最新已确认正文\n当前阶段与当前地点\n已读取时间线/年表/章节资料\n模型已有原著知识\n谨慎推断'}),
        Object.freeze({key:'worldTime.initializationForbidden',category:'世界时间',title:'世界时间初始化禁令',fallback:'不得把下一宏观节点、任务期限或未来事件的日期直接当成当前世界时间；无法唯一定位时保持较粗时间精度。'}),
        Object.freeze({key:'worldTime.proseDuty',category:'世界时间',title:'正文时间职责',fallback:'若最新正文明确发生过夜、数小时后、次日、跨日旅行或新的日期/时段，必须输出顶层“时间”同步世界时钟；不能保留旧时钟再提交已经发生于新时点的事实。'}),
        Object.freeze({key:'worldTime.dateFormat',category:'世界时间',title:'精确日期格式说明',fallback:'顶层时间及所有事件/历史/传播等日期，只要精确到月日就使用 {yyy}年-{mm}月-{dd}日-{时间段}。月份必须是数字；不要用自定义月份名称替代数字月。'}),
        Object.freeze({key:'worldTime.advancePrinciple',category:'世界时间',title:'时间推进原则',fallback:'时间段是粗粒度锚点，不是每轮计数器；没有足够时间流逝跨过当前时段就保持原值，只有正文或明确时间资料表明确实经过合理时长才推进。'}),
        Object.freeze({key:'chronology.evidenceFound',category:'原著时间轴',title:'已读取时间线资料说明',fallback:'已读取 {{count}} 条明确时间线/年表资料'}),
        Object.freeze({key:'chronology.noEvidence',category:'原著时间轴',title:'未命中时间线资料说明',fallback:'未命中明确时间线条目；使用模型已有原著知识保守估计，不得为推进剧情压缩跨度'}),
        Object.freeze({key:'chronology.window',category:'原著时间轴',title:'滚动窗口规则',fallback:'3~5个宏观节点只是当前规划视野，不要求覆盖完整篇章；宁可规划得近，也不要把远期大事件打包。'}),
        Object.freeze({key:'chronology.nodeGranularity',category:'原著时间轴',title:'节点粒度规则',fallback:'一个宏观节点只表达一个阶段转折；远行、集结、连续战役或多个独立剧情阶段应拆分或拉开跨度。'}),
        Object.freeze({key:'chronology.interval',category:'原著时间轴',title:'间隔自检规则',fallback:'排期前先判断从上一节点到本节点现实上必须经历什么，为旅行、准备、组织动员与因果发展留足时间。'}),
        Object.freeze({key:'chronology.precision',category:'原著时间轴',title:'时间精度规则',fallback:'资料只到月份/时段/顺序时保持同级精度并保守留白，不为方便排序强造日级日期。'}),
        Object.freeze({key:'chronology.requirement',category:'原著时间轴',title:'时间轴最终要求',fallback:'宏观节点先定原著/数据库日期、节点粒度与合理跨度，再展开当前→下一节点区间。明确到日的日期必须服从；仅有月份、时段或顺序时按软约束保守规划，不因估计差异反复改期。'}),
        Object.freeze({key:'rumor.sourceBoundary',category:'传闻与传播',title:'传闻取材边界',fallback:'只使用世界侧可传播事实、已有传播链与既有公开传闻；正文不是直接传播源'}),
        Object.freeze({key:'worldActivity.primary',category:'世界活动',title:'非异端世界推进要求',fallback:'异端不能作为本轮唯一变化；至少推进事件、势力地区或普通人物中的一项非异端实质变化。'}),
        Object.freeze({key:'worldActivity.region',category:'世界活动',title:'地区初始化要求',fallback:'若地区为空：建立至少1个与当前地点/阶段相关的地区。'}),
        Object.freeze({key:'worldActivity.faction',category:'世界活动',title:'势力初始化要求',fallback:'若势力为空：建立至少1个当前真实相关的势力/组织；同名提交 WorldResult.势力（实力/领地/描述/声望）与 WorldResult.势力地区（类型=势力的动态现场）。'}),
        Object.freeze({key:'worldActivity.event',category:'世界活动',title:'当前事件初始化要求',fallback:'若没有进行中的非宏观事件：建立至少1个正在发生的当前事件/近期节点。'}),
        Object.freeze({key:'worldActivity.semantic',category:'世界活动',title:'实质变化判定',fallback:'只改更新时间/下次检查、重复原值或只新增待发生宏观节点不算实质变化。'}),
        Object.freeze({key:'retry.causalProjection',category:'纠错重试',title:'因果轨道宏观顺序纠错',fallback:'因果轨道：不要重写已接受事件，只补写 因果.宏观顺序；长度必须3~5，且每个名称都必须对应已建立且未取消的宏观节点；不要写当前阶段、当前事件或近期节点。'}),
        Object.freeze({key:'retry.dueEvent',category:'纠错重试',title:'到期事件纠错',fallback:'到期事件/{{name}}：本轮必须明确启动该事件，或更新本轮复核日期、阻碍条件与下次检查。'}),
        Object.freeze({key:'retry.eventAnchor',category:'纠错重试',title:'事件时间锚点纠错',fallback:'事件/{{name}}：补写明确时间锚点；优先具体世界日期/时段，精确日期未知时写相对或因果时间，禁止空值和“近期/稍后/未来/待定/未知”。'}),
        Object.freeze({key:'retry.staleActive',category:'纠错重试',title:'超期活动事件纠错',fallback:'事件/{{name}}：该局部活动已远超正常持续窗口。若实际早已结束则改为已完成并补结果；若失效则已取消；只有确实仍持续时才保留进行中，并把更新时间写为当前世界时间、更新当前描述并填写下次检查。'}),
        Object.freeze({key:'retry.temporalRecords',category:'纠错重试',title:'时间越界记录纠错',fallback:'时间一致性：修复这些已经发生的记录，任何已完成/进行中事件、人物更新时间、地区已发生变化、历史与传播都不得晚于当前世界时间：{{items}}'}),
        Object.freeze({key:'retry.alienActivity',category:'纠错重试',title:'异端活动纠错',fallback:'异端活动/{{name}}：仅对本轮触发复核的该活跃异端补写地点、目标、行动；人物更新时间由程序使用世界时间统一记录；若本轮已确认死亡，则只更新异端状态=死亡，不再提交人物活动。'}),
        Object.freeze({key:'retry.npcAudit',category:'纠错重试',title:'NPC构筑审计纠错',fallback:'NPC构筑审计/{{name}}：只在 WorldResult.关系 中补齐该既有NPC至少一个列出的构筑缺口；优先补职业/血统/装备/技能/状态/形态或缺失档案字段，不得新建NPC、改HP_MAX/EP_MAX或输出真属性/最终属性。'}),
        Object.freeze({key:'retry.overall',category:'纠错重试',title:'整体校验纠错',fallback:'整体校验：{{message}}'}),
        Object.freeze({key:'retry.acceptedWithPlan',category:'纠错重试',title:'已有接受结果 + 补充清单',fallback:'严格按“补充清单”只补充或修正未通过的业务片段。已接受业务结果已经通过本地验收，默认全部保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。'}),
        Object.freeze({key:'retry.acceptedWithoutPlan',category:'纠错重试',title:'已有接受结果 + 无补充清单',fallback:'只补充或修正导致拒绝的业务片段。已接受业务结果默认保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。'}),
        Object.freeze({key:'retry.fresh',category:'纠错重试',title:'首次整体纠错',fallback:'修正格式或业务错误后重新输出一个 WorldResult JSON；不要解释错误，不要输出存储路径。'}),
        Object.freeze({key:'retry.chronology',category:'纠错重试',title:'时间轴纠错',fallback:'宏观时间轴：只纠正已明确到日的原著/数据库日期冲突；重新沿用该日期。不要顺带把仅有月份、时段或先后顺序的节点强行精确到日，后者按原著节奏保守留白即可。'}),
        Object.freeze({key:'retry.integrity',category:'纠错重试',title:'时间一致性纠错',fallback:'时间一致性：事件/地区/历史/传播只把“跨到未来自然日”视为硬越界，同日不同上午/下午/HH:mm无需回写；人物只有双方均明确 HH:mm 时才做分钟级校验。未来计划放预计结束、下次检查或待发生事件。'}),
        Object.freeze({key:'retry.eventPredecessor',category:'纠错重试',title:'事件前因纠错',fallback:'事件前因：先修复链首缺失或自引用，再重新提交受影响的后继节点。前因数组只放事件名称，且须已存在或同轮成功建立；当前阶段/自然语言原因不算事件，无明确前因写 []。不得为消除报错凭空补造事件。'}),
        Object.freeze({key:'retry.schema',category:'纠错重试',title:'Schema 纠错',fallback:'Schema纠错：只修报错路径中的业务字段；真属性/最终属性/强化属于后台派生缓存，模型不得补写，这类派生差异由程序吸收。'}),
        Object.freeze({key:'retry.rumorEmpty',category:'纠错重试',title:'传闻空分类纠错',fallback:'传闻维护：{{items}}。空分类本轮补2条真实世界信息；三类各自展示最近3条，约60字/条，不要无依据围绕<user>。'}),
        Object.freeze({key:'retry.rumorPropagation',category:'纠错重试',title:'传播链纠错',fallback:'传播维护：{{items}}。逐条更新到当前世界时间，并推进范围/受众/内容/引发行动；若传播已结束则结束或移除，不要原样重交。'}),
        Object.freeze({key:'retry.worldActivityMain',category:'纠错重试',title:'世界活动纠错',fallback:'世界活动：先推进非异端世界，再复核异端。至少提交一项进行中事件、势力/地区或普通人物的实质变化；只改更新时间、复述原值或新增未来宏观节点不算。'}),
        Object.freeze({key:'retry.worldActivityScene',category:'纠错重试',title:'世界现场纠错',fallback:'世界现场：若势力地区为空，建立与当前地点/阶段直接相关的地区；若势力为空，选一个当前真正参与局势的真实势力/组织，同名提交 WorldResult.势力 与 WorldResult.势力地区(类型=势力)，不要编造与资料无关的组织。'}),
        Object.freeze({key:'retry.worldActivityReality',category:'纠错重试',title:'当前现实纠错',fallback:'当前现实：若没有进行中的当前事件/近期节点，从当前阶段与最新正文提炼一个“已经正在发生”的现实局势；不要把未来宏观节点提前结算。'}),
        Object.freeze({key:'history.system',category:'历史压缩',title:'历史压缩 system',fallback:'【世界长期历史压缩】\n只总结已确认历史事实。你收到的是按真实先后顺序排列的既有历史节点；任务是把它们融合成一条更高层的世界史记忆，不是续写剧情。\n必须保留：时间顺序、主要参与者、原因、关键转折、最终结果，以及仍会影响后续局势的长期后果与重要因果偏移。\n可以删除：重复描述、已经失去后续意义的过程细节、UI/调试信息。\n禁止：补写未发生剧情、猜测隐藏真相、修改既有结局、制造输入中不存在的日期/人物/关系、把历史事实写成未来计划。\n如果输入时间粒度不完整，就保持原有粒度，不自行补全。\n只输出 JSON：{"摘要":"..."}'}),
        Object.freeze({key:'history.inputInstruction',category:'历史压缩',title:'历史压缩 user 说明',fallback:'按给定顺序压缩；时间字段是权威锚点，不得改写或补造。'}),
        Object.freeze({key:'system.worldResultHeading',category:'输出协议',title:'WorldResult 协议标题',fallback:'【WorldResult 业务输出协议】'}),
        Object.freeze({key:'system.schemaHeading',category:'输出协议',title:'程序 Schema 说明',fallback:'【Canonical WorldResult JSON Schema】\n程序实际字段定义（不可由文字说明改变）：'})
    ]);

    function worldEditablePromptDefaults(){
        return Object.fromEntries(WORLD_EDITABLE_PROMPT_DEFS.map(item=>[item.key,item.fallback]));
    }
    function normalizeWorldEditablePrompts(value){
        const source=plain(value)?value:{},out={};
        for(const item of WORLD_EDITABLE_PROMPT_DEFS)out[item.key]=typeof source[item.key]==='string'?source[item.key]:item.fallback;
        return out;
    }
    function interpolateWorldPrompt(template,vars={}){
        return String(template??'').replace(/\{\{([^}]+)\}\}/g,(_,key)=>String(vars[key]??''));
    }
    let ACTIVE_WORLD_PROMPT_SERVICE=null;
    function worldEditablePromptText(key,fallback='',vars={}){
        const service=ACTIVE_WORLD_PROMPT_SERVICE;
        if(service&&typeof service.get==='function')return service.get(key,vars);
        return interpolateWorldPrompt(fallback,vars);
    }
    function worldPromptLines(key,fallback=''){
        return worldEditablePromptText(key,fallback).split(/\n+/).map(item=>item.trim()).filter(Boolean);
    }

    class WorldEnginePromptService {
        constructor(engine){this.engine=engine;}
        normalize(value){return normalizeWorldEditablePrompts(value);}
        values(){return this.normalize(this.engine?.config?.requestPrompts);}
        get(key,vars={}){return interpolateWorldPrompt(this.values()[key]??'',vars);}
        setAll(value){
            const normalized=this.normalize(value);
            if(this.engine?.config)this.engine.config.requestPrompts=normalized;
            return normalized;
        }
        catalog(){
            const values=this.values();
            return WORLD_EDITABLE_PROMPT_DEFS.map(item=>({...item,value:values[item.key]??''}));
        }
    }

    class WorldEngineMutationService {
        constructor(engine){this.engine=engine;}
        backend(stat){
            const backend=stat?.世界?.[PATH];
            if(!plain(backend))throw new Error('世界后台不存在');
            return backend;
        }
        pathConflict(left,right){
            if(!Array.isArray(left)||!Array.isArray(right))return false;
            const limit=Math.min(left.length,right.length);
            for(let index=0;index<limit;index++)if(String(left[index])!==String(right[index]))return false;
            return true;
        }
        mergeReplay(raw,fingerprint,beforeStat,afterStat){
            const engine=this.engine,replay=raw?.__samsaraWorldReplay;
            if(!plain(replay)||String(replay.fingerprint||'')!==String(fingerprint||'')||!Array.isArray(replay.operations))return false;
            if(!engine||typeof engine.buildWorldReplayPackage!=='function')return false;
            const delta=engine.buildWorldReplayPackage(beforeStat,afterStat,fingerprint);
            if(!plain(delta)||!Array.isArray(delta.operations)||!delta.operations.length)return false;
            for(const incoming of delta.operations){
                replay.operations=replay.operations.filter(existing=>!this.pathConflict(existing?.path,incoming?.path));
                replay.operations.push(copy(incoming));
            }
            return true;
        }
        async persist(mutator,status){
            const engine=this.engine;
            if(typeof mutator!=='function')return false;
            const snapshot=engine.snapshot(),next=copy(snapshot.raw),stat=next.stat_data;
            this.backend(stat);
            const outcome=mutator(stat);
            if(!outcome)return false;
            this.mergeReplay(next,snapshot.fingerprint,snapshot.stat,stat);
            const target=engine.host,had=!!target&&Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target?.__samsaraUIMutation;
            if(target)target.__samsaraUIMutation=true;
            try{await snapshot.mvu.replaceMvuData(next,{type:'message',message_id:snapshot.id});}
            finally{
                if(target){
                    if(had)target.__samsaraUIMutation=previous;
                    else delete target.__samsaraUIMutation;
                }
            }
            engine.status=status||'世界推进资料已手动修正';
            engine.render(true);
            return true;
        }
    }

    class WorldEventService {
        constructor(engine,mutations){this.engine=engine;this.mutations=mutations;}
        list(){return this.engine.snapshot().stat?.世界?.[PATH]?.事件||{};}
        record(name){const events=this.list();return plain(events?.[name])?events[name]:null;}
        retarget(stat,oldName,newName,deleted=false){
            const backend=this.mutations.backend(stat);
            const retarget=list=>{
                if(!Array.isArray(list))return [];
                const out=[];
                for(const item of list){
                    const value=String(item||'');
                    if(value!==oldName){if(value&&!out.includes(value))out.push(value);continue;}
                    if(!deleted&&newName&&!out.includes(newName))out.push(newName);
                }
                return out;
            };
            for(const [name,event] of Object.entries(backend.事件||{})){
                if(name===newName&&!deleted)continue;
                if(Array.isArray(event?.前因))event.前因=retarget(event.前因);
            }
            for(const category of ['人物','势力地区','传播','历史']){
                for(const record of Object.values(backend[category]||{})){
                    if(Array.isArray(record?.关联事件))record.关联事件=retarget(record.关联事件);
                }
            }
            const orbit=stat?.世界?.因果轨道;
            if(plain(orbit)&&String(orbit.下一节点||'')===oldName)orbit.下一节点=deleted?'':newName;
        }
        validate(stat){
            const backend=this.mutations.backend(stat),events=backend.事件||{};
            for(const [name,event] of Object.entries(events)){
                if(!plain(event))throw new Error('事件记录无效：'+name);
                if(!['待发生','进行中','已完成','已取消'].includes(String(event.状态||'')))throw new Error('事件状态只允许：待发生 / 进行中 / 已完成 / 已取消');
                if(!EVENT_CATEGORIES.has(String(event.分类||'')))throw new Error('事件分类只允许：当前事件 / 近期节点 / 宏观节点');
                if(!Array.isArray(event.前因))throw new Error('事件前因必须是列表');
                if(event.前因.includes(name))throw new Error('事件不能把自己设为前因：'+name);
                for(const cause of event.前因)if(!Object.hasOwn(events,cause))throw new Error('事件前因不存在：'+cause);
            }
            const visiting=new Set(),visited=new Set();
            const visit=name=>{
                if(visiting.has(name))throw new Error('事件前因形成循环');
                if(visited.has(name))return;
                visiting.add(name);
                for(const cause of events[name]?.前因||[])visit(cause);
                visiting.delete(name);visited.add(name);
            };
            Object.keys(events).forEach(visit);
            for(const category of ['人物','势力地区','传播','历史']){
                for(const record of Object.values(backend[category]||{})){
                    if(!Array.isArray(record?.关联事件))continue;
                    for(const eventName of record.关联事件)if(!Object.hasOwn(events,eventName))throw new Error(category+'关联了不存在的事件：'+eventName);
                }
            }
        }
        async set(oldName,newName,record){
            oldName=String(oldName||'').trim();newName=String(newName||'').trim();
            if(!oldName||!newName)throw new Error('事件名称不能为空');
            if(forbidden.has(newName))throw new Error('事件名称包含非法键');
            return this.mutations.persist(stat=>{
                const backend=this.mutations.backend(stat),events=backend.事件||{},current=events[oldName];
                if(!plain(current))throw new Error('事件不存在：'+oldName);
                if(newName!==oldName&&Object.hasOwn(events,newName))throw new Error('事件名称已存在：'+newName);
                const next=normalizeBackendRecord('事件',record,current);
                next.前因=worldEditorTextList(next.前因);
                next.参与者=worldEditorTextList(next.参与者);
                next.关联任务=worldEditorTextList(next.关联任务);
                next.可见影响=worldEditorJsonList(next.可见影响,'可见影响');
                if(next.前因.includes(oldName)||next.前因.includes(newName))throw new Error('事件不能把自己设为前因');
                if(newName!==oldName)delete events[oldName];
                events[newName]=next;
                if(newName!==oldName)this.retarget(stat,oldName,newName,false);
                this.validate(stat);
                return {oldName,newName};
            },newName===oldName?'已修正世界事件：'+newName:'已重命名并修正世界事件：'+oldName+' → '+newName);
        }
        async remove(name){
            name=String(name||'').trim();if(!name)return false;
            return this.mutations.persist(stat=>{
                const backend=this.mutations.backend(stat),events=backend.事件||{};
                if(!plain(events[name]))return null;
                delete events[name];this.retarget(stat,name,'',true);this.validate(stat);
                return {deleted:name};
            },'已删除错误世界事件：'+name);
        }
    }

    class WorldPersonActivityService {
        constructor(engine,mutations){this.engine=engine;this.mutations=mutations;}
        record(name){
            const people=this.engine.snapshot().stat?.世界?.[PATH]?.人物||{},stable=stableNameIn(people,String(name||'').trim());
            return stable&&plain(people[stable])?{name:stable,record:people[stable]}:null;
        }
        validate(stat,name,record){
            if(!plain(record))throw new Error('世界活动记录无效：'+name);
            const backend=this.mutations.backend(stat),events=backend.事件||{};
            for(const eventName of record.关联事件||[])if(!Object.hasOwn(events,eventName))throw new Error('关联事件不存在：'+eventName);
        }
        async set(name,record){
            name=String(name||'').trim();if(!name)throw new Error('人物名称不能为空');
            return this.mutations.persist(stat=>{
                const backend=this.mutations.backend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))throw new Error('世界活动记录不存在：'+name);
                const current=people[stable],next=normalizeBackendRecord('人物',record,current);
                next.认知=worldEditorTextList(next.认知);
                next.关联事件=worldEditorTextList(next.关联事件);
                next.行程=worldEditorJsonList(next.行程,'行程');
                next.认知来源=worldEditorJsonList(next.认知来源,'认知来源');
                next.背景关联=worldEditorJsonList(next.背景关联,'背景关联');
                this.validate(stat,stable,next);people[stable]=next;return {name:stable};
            },'已修正世界活动记录：'+name);
        }
        async remove(name){
            name=String(name||'').trim();if(!name)return false;
            return this.mutations.persist(stat=>{
                const backend=this.mutations.backend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))return null;
                delete people[stable];return {deleted:stable};
            },'已删除世界活动记录：'+name);
        }
    }
