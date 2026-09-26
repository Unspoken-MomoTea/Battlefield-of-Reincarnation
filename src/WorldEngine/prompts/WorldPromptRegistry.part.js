    const WORLD_PROMPT_RETRY_ACCEPTED_PLAN='严格按“补充清单”只补充或修正未通过的业务片段。已接受业务结果已经通过本地验收，默认全部保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。';
    const WORLD_PROMPT_RETRY_ACCEPTED='只补充或修正导致拒绝的业务片段。已接受业务结果默认保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。';
    const WORLD_PROMPT_RETRY_FRESH='修正格式或业务错误后重新输出一个 WorldResult JSON；不要解释错误，不要输出存储路径。';
    const WORLD_PROMPT_PROJECTION_GUIDANCE='非战斗正文会读取完整因果轨道：当前阶段用于当前局势，故事线/下一节点用于长期叙事方向，偏移记录用于跨章因果记忆；这些是规划依据，不等于角色预知或自动知晓幕后信息。正文还会读取进行中当前事件的公开字段，以及程序筛选的场外场景：每个热地区只出现一次共享环境/现场群体，人物列表只携带各自行动事实，关联事件只作索引；活跃异端始终保留在其所在热场景。以上均用于叙事连续性，不代表角色已知。可能影响当前场景的当前事件应维护公开征兆和可见影响；不要把隐藏条件、默认走向或未来宏观事件详情塞进公开字段。';
    const WORLD_PROMPT_REQUEST_SUMMARY='当前变量为已确认热事实，不重复结算；已归档旧事件和已回收传播不要重新创建；世界书为空不构成阻塞；只提交业务事实，存储路径由程序编译。';
    const WORLD_PROMPT_MACRO_PLANNING='本轮必须补齐骨架，不能以时间未推进、正文没有宏观变化或无业务变化为由省略。建立待发生节点属于未来规划，可排在下一宏观边界之后，不表示事件现在发生；近期细节与已发生事实仍受本轮时间容量和下一宏观边界限制。不得为凑数提前原著日期，或预先结算未来事件的结果；更新时间使用当前世界时间。';
    const WORLD_PROMPT_MACRO_ACCEPTANCE='按已有状态与本轮结果合并后计数；若本轮结束或取消已有宏观节点，须补足被移出窗口的数量。重试时以已接受业务结果和最新补充清单为准，不重复创建已接受节点。';
    const WORLD_PROMPT_DUE_REVIEW='软提醒：该事件已到计划/复核时间。条件与前因满足则转为进行中；若暂不发生，可保持待发生并优先填写新的“下次检查”。“条件”只表示事件触发条件，不要改写成延期阻碍。未处理不会导致本轮世界推进被驳回。';
    const WORLD_PROMPT_CHRONOLOGY_INPUT='宏观节点先定原著/数据库日期、节点粒度与合理跨度，再展开当前→下一节点区间。明确到日的日期必须服从；仅有月份、时段或顺序时按软约束保守规划，不因估计差异反复改期。';
    const WORLD_PROMPT_CHRONOLOGY_PRINCIPLES=JSON.stringify({
        滚动窗口:'3~5个宏观节点只是当前规划视野，不要求覆盖完整篇章；宁可规划得近，也不要把远期大事件打包。',
        节点粒度:'一个宏观节点只表达一个阶段转折；远行、集结、连续战役或多个独立剧情阶段应拆分或拉开跨度。',
        间隔自检:'排期前先判断从上一节点到本节点现实上必须经历什么，为旅行、准备、组织动员与因果发展留足时间。',
        时间精度:'资料只到月份/时段/顺序时保持同级精度并保守留白，不为方便排序强造日级日期。'
    },null,2);
    const WORLD_PROMPT_ALIEN_REVIEW='仅因本轮触发复核才需要在 WorldResult.人物 中提交该活跃异端的新活动；至少给出非空地点、目标、行动。人物更新时间无需抄写，由程序使用本轮最终世界时间统一记录。未获得新情报时沿用既有目标/行动，不得因为模型看见<user>行为就自动追踪或改策；若因<user>行为改变目标/行动，必须已有认知或同轮写入可追溯的认知/认知来源。若本轮已确认死亡，则只把异端状态更新为死亡。';
    const WORLD_PROMPT_WORLD_ACTIVITY_INPUT=[
        '异端不能作为本轮唯一变化；至少推进事件、势力地区或普通人物中的一项非异端实质变化。',
        '若地区为空：建立至少1个与当前地点/阶段相关的地区。',
        '若势力为空：建立至少1个当前真实相关的势力/组织；同名提交 WorldResult.势力（实力/领地/描述/声望）与 WorldResult.势力地区（类型=势力的动态现场）。',
        '若没有进行中的非宏观事件：建立至少1个正在发生的当前事件/近期节点。',
        '只改更新时间/下次检查、重复原值或只新增待发生宏观节点不算实质变化。'
    ].join('\n');
    const WORLD_PROMPT_HISTORY_INPUT='按给定顺序压缩；时间字段是权威锚点，不得改写或补造。';
    const WORLD_PROMPT_INPUT_SEMANTICS=JSON.stringify({
        世界书:'可选设定/原著差异/时间资料；不是已发生事实，没有世界书也必须正常推演。',
        当前变量:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期因果偏移，以及“近期原始锚点 + 更早根总结”组成的分层长期历史记忆。原始历史永久留在MVU，已被上层总结收纳的旧节点不再重复进入热上下文。资产通过WorldResult.资产与同一顶层账簿双向同步；未提供的任务/商城/纯结算数据不属于本引擎职责。',
        正文楼层:'已经演出的剧情；用于确认当前事实与时间跨度，不复述成后台日常。',
        程序结构修复:'引擎已做的确定性纠正；不得在输出中恢复被程序降级/修正的旧错误。',
        时间线调度:'程序计算出的宏观边界与到期复核要求；模型负责语义推演，不重定义调度协议。',
        WorldResult:'唯一业务交付物；不包含 JSON Pointer、add/replace 路径或程序日志。',
        角色管理:'若提供NPC构筑审计，只处理列出的既有NPC缺口；完整构筑资料只在审计对象中提供，避免全量NPC重复占用上下文。'
    },null,2);

    class WorldPromptRegistry {
        constructor(engine){
            this.engine=engine;
            const def=(value)=>Object.freeze(value);
            this._definitions=Object.freeze([
                def({key:'preset',title:'执行流程 / 主预设',group:'主流程',source:'COMPACT_DEFAULT_PRESET / config.preset',scope:'system',condition:'每次主世界推进请求',native:true,defaultValue:()=>typeof COMPACT_DEFAULT_PRESET==='string'?COMPACT_DEFAULT_PRESET:DEFAULT_PRESET}),
                def({key:'core',title:'世界引擎核心约束',group:'主流程',source:'CORE_WORLD_RULES',scope:'system',condition:'每次主世界推进请求',native:true,defaultValue:()=>typeof COMPACT_CORE_WORLD_RULES==='string'?COMPACT_CORE_WORLD_RULES:CORE_WORLD_RULES}),
                def({key:'macro',title:'宏观骨架',group:'主流程',source:'DEFAULT_MACRO_PROMPT',scope:'system',condition:'本轮需要建立或补足宏观骨架时',native:true,defaultValue:()=>typeof COMPACT_MACRO_PROMPT==='string'?COMPACT_MACRO_PROMPT:DEFAULT_MACRO_PROMPT}),
                def({key:'stability',title:'世界自救',group:'主流程',source:'DEFAULT_STABILITY_PROMPT_TEMPLATE',scope:'system',condition:'稳定值低于100且未开启世界超稳时',native:true,defaultValue:()=>typeof COMPACT_STABILITY_PROMPT_TEMPLATE==='string'?COMPACT_STABILITY_PROMPT_TEMPLATE:DEFAULT_STABILITY_PROMPT_TEMPLATE}),
                def({key:'npcAudit',title:'NPC构筑审计',group:'主流程',source:'NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT',scope:'system',condition:'启用NPC构筑审计且本轮存在审计对象时',native:true,defaultValue:()=>typeof NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT==='string'?NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT:NPC_BUILD_AUDIT_RULES}),
                def({key:'outputProtocol',title:'WorldResult 输出协议说明',group:'主流程',source:'protocol()',scope:'system',condition:'每次主世界推进请求；程序 JSON Schema 仍固定只读',native:true,defaultValue:()=>protocol().split('【Canonical WorldResult JSON Schema】')[0].trim()}),
                def({key:'task',title:'任务只读',group:'运行模块',source:'TASK_AWARENESS_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>typeof TASK_AWARENESS_RULES==='string'?TASK_AWARENESS_RULES:''}),
                def({key:'chronology',title:'原著 / 数据库时间轴',group:'运行模块',source:'CHRONOLOGY_GUARD_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>typeof CHRONOLOGY_GUARD_RULES==='string'?CHRONOLOGY_GUARD_RULES:''}),
                def({key:'maintenance',title:'分级维护',group:'运行模块',source:'SOFT_MAINTENANCE_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>typeof SOFT_MAINTENANCE_RULES==='string'?SOFT_MAINTENANCE_RULES:''}),
                def({key:'exploration',title:'探索台账',group:'运行模块',source:'EXPLORATION_PROJECTION_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>typeof EXPLORATION_PROJECTION_RULES==='string'?EXPLORATION_PROJECTION_RULES:''}),
                def({key:'integrity',title:'因果与事实时间',group:'运行模块',source:'WORLD_INTEGRITY_GUARD_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>typeof WORLD_INTEGRITY_GUARD_RULES==='string'?WORLD_INTEGRITY_GUARD_RULES:''}),
                def({key:'worldTime',title:'世界时间所有权',group:'运行模块',source:'WORLD_TIME_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>typeof WORLD_TIME_RULES==='string'?WORLD_TIME_RULES:''}),
                def({key:'rumor',title:'传闻与传播',group:'运行模块',source:'RUMOR_WORLD_SOURCE_RULES',scope:'system',condition:'每次主世界推进请求；无触发时要求保持既有传播',defaultValue:()=>typeof RUMOR_WORLD_SOURCE_RULES==='string'?RUMOR_WORLD_SOURCE_RULES:(typeof RUMOR_THROTTLE_RULES==='string'?RUMOR_THROTTLE_RULES:'')}),
                def({key:'worldActivity',title:'世界活动交付',group:'运行模块',source:'WORLD_ACTIVITY_DELIVERY_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>typeof WORLD_ACTIVITY_DELIVERY_RULES==='string'?WORLD_ACTIVITY_DELIVERY_RULES:''}),
                def({key:'historyMemory',title:'世界长期历史压缩',group:'辅助模型',source:'HISTORY_MEMORY_SYSTEM',scope:'system',condition:'历史记忆达到自动压缩阈值时单独调用模型',defaultValue:()=>typeof HISTORY_MEMORY_SYSTEM==='string'?HISTORY_MEMORY_SYSTEM:''}),
                def({key:'inputSemantics',title:'输入语义说明',group:'请求内指令',source:'40-engine-runtime.part.js / 输入语义',scope:'user payload',condition:'每次主世界推进请求',defaultValue:()=>WORLD_PROMPT_INPUT_SEMANTICS}),
                def({key:'macroPlanningGuidance',title:'宏观骨架 · 规划与发生',group:'请求内指令',source:'40-engine-runtime.part.js / 本轮必须完成的宏观骨架',scope:'user payload',condition:'本轮要求补足宏观骨架时',defaultValue:()=>WORLD_PROMPT_MACRO_PLANNING}),
                def({key:'macroAcceptanceGuidance',title:'宏观骨架 · 验收',group:'请求内指令',source:'40-engine-runtime.part.js / 本轮必须完成的宏观骨架',scope:'user payload',condition:'本轮要求补足宏观骨架时',defaultValue:()=>WORLD_PROMPT_MACRO_ACCEPTANCE}),
                def({key:'projectionGuidance',title:'正文可见投影规则',group:'请求内指令',source:'40-engine-runtime.part.js / 正文可见投影规则',scope:'user payload',condition:'每次主世界推进请求',defaultValue:()=>WORLD_PROMPT_PROJECTION_GUIDANCE}),
                def({key:'requestSummaryGuidance',title:'本轮输入总说明',group:'请求内指令',source:'40-engine-runtime.part.js / 说明',scope:'user payload',condition:'每次主世界推进请求',defaultValue:()=>WORLD_PROMPT_REQUEST_SUMMARY}),
                def({key:'dueReviewGuidance',title:'到期事件复核说明',group:'请求内指令',source:'59-due-event-relaxation.part.js',scope:'user payload',condition:'本轮存在到期事件时',defaultValue:()=>WORLD_PROMPT_DUE_REVIEW}),
                def({key:'chronologyInputGuidance',title:'时间线基准 · 要求',group:'请求内指令',source:'58-chronology-guard.part.js / 时间线基准',scope:'user payload',condition:'时间轴保护层运行时',defaultValue:()=>WORLD_PROMPT_CHRONOLOGY_INPUT}),
                def({key:'chronologyPrinciples',title:'时间线基准 · 规划原则',group:'请求内指令',source:'58-chronology-guard.part.js / 规划原则',scope:'user payload JSON',condition:'时间轴保护层运行时',defaultValue:()=>WORLD_PROMPT_CHRONOLOGY_PRINCIPLES}),
                def({key:'alienReviewGuidance',title:'活跃异端复核要求',group:'请求内指令',source:'59-alien-activity-normalization.part.js',scope:'user payload',condition:'活跃异端命中复核触发器时',defaultValue:()=>WORLD_PROMPT_ALIEN_REVIEW}),
                def({key:'worldActivityInputGuidance',title:'世界活动交付 · 硬要求',group:'请求内指令',source:'59-world-activity-delivery.part.js / 硬要求',scope:'user payload lines',condition:'每次主世界推进请求',defaultValue:()=>WORLD_PROMPT_WORLD_ACTIVITY_INPUT}),
                def({key:'historyInputGuidance',title:'历史压缩输入说明',group:'辅助模型',source:'historyMemoryPrompt()',scope:'user payload',condition:'历史记忆达到自动压缩阈值时',defaultValue:()=>WORLD_PROMPT_HISTORY_INPUT}),
                def({key:'retryAcceptedWithPlan',title:'纠错重试 · 已接受结果 + 补充清单',group:'纠错重试',source:'retryInput()',scope:'user payload',condition:'重试且已有部分业务结果通过，并存在补充清单时',defaultValue:()=>WORLD_PROMPT_RETRY_ACCEPTED_PLAN}),
                def({key:'retryAccepted',title:'纠错重试 · 已接受结果',group:'纠错重试',source:'retryInput()',scope:'user payload',condition:'重试且已有部分业务结果通过，但没有补充清单时',defaultValue:()=>WORLD_PROMPT_RETRY_ACCEPTED}),
                def({key:'retryFresh',title:'纠错重试 · 首次整体纠错',group:'纠错重试',source:'retryInput()',scope:'user payload',condition:'重试且没有已接受业务结果时',defaultValue:()=>WORLD_PROMPT_RETRY_FRESH})
            ]);
        }
        definitions(){return this._definitions.slice();}
        defaults(){return Object.fromEntries(this._definitions.map(item=>[item.key,String(item.defaultValue?.()??'')]));}
        legacyValues(){
            const config=this.engine.config||{},modules=plain(config.modulePrompts)?config.modulePrompts:{},fallback=this.defaults(),registry=plain(config.promptRegistry)?config.promptRegistry:{};
            return {
                ...fallback,
                ...registry,
                preset:String(config.preset??registry.preset??fallback.preset),
                core:String(config.corePrompt??registry.core??fallback.core),
                macro:String(config.macroPrompt??registry.macro??fallback.macro),
                stability:String(config.stabilityPromptTemplate??registry.stability??fallback.stability),
                npcAudit:String(config.npcAuditPrompt??registry.npcAudit??fallback.npcAudit),
                outputProtocol:String(config.structurePrompt??registry.outputProtocol??fallback.outputProtocol),
                task:String(modules.task??registry.task??fallback.task),
                chronology:String(modules.chronology??registry.chronology??fallback.chronology),
                maintenance:String(modules.maintenance??registry.maintenance??fallback.maintenance),
                exploration:String(modules.exploration??registry.exploration??fallback.exploration),
                integrity:String(modules.integrity??registry.integrity??fallback.integrity),
                worldTime:String(modules.worldTime??registry.worldTime??fallback.worldTime),
                rumor:String(modules.rumor??registry.rumor??fallback.rumor)
            };
        }
        normalize(value){
            const fallback=this.legacyValues(),source=plain(value)?value:{},out={};
            for(const item of this._definitions){
                const raw=Object.hasOwn(source,item.key)?source[item.key]:fallback[item.key];
                out[item.key]=typeof raw==='string'?raw:String(raw??'');
            }
            return out;
        }
        initialize(){
            const normalized=this.normalize(this.engine.config?.promptRegistry);
            this.engine.config.promptRegistry=normalized;
            this.syncLegacy(normalized);
            return normalized;
        }
        syncLegacy(values){
            const config=this.engine.config||(this.engine.config={}),source=values===undefined?this.absorbLegacyOverrides():values,v=this.normalize(source);
            config.preset=normalizeEditablePreset(v.preset);
            config.corePrompt=v.core;config.macroPrompt=v.macro;config.stabilityPromptTemplate=v.stability;config.npcAuditPrompt=v.npcAudit;config.structurePrompt=v.outputProtocol;
            config.modulePrompts=Object.assign({},plain(config.modulePrompts)?config.modulePrompts:{},{
                task:v.task,chronology:v.chronology,maintenance:v.maintenance,exploration:v.exploration,integrity:v.integrity,worldTime:v.worldTime,rumor:v.rumor
            });
            config.promptRegistry=v;return v;
        }
        values(){return this.normalize(this.engine.config?.promptRegistry);}
        absorbLegacyOverrides(){
            const config=this.engine.config||{},current=this.values(),next={...current};
            for(const [key,legacyKey] of [['preset','preset'],['core','corePrompt'],['macro','macroPrompt'],['stability','stabilityPromptTemplate'],['npcAudit','npcAuditPrompt'],['outputProtocol','structurePrompt']]){
                if(typeof config[legacyKey]==='string'&&config[legacyKey]!==current[key])next[key]=config[legacyKey];
            }
            const modules=plain(config.modulePrompts)?config.modulePrompts:{};
            for(const key of ['task','chronology','maintenance','exploration','integrity','worldTime','rumor']){
                if(typeof modules[key]==='string'&&modules[key]!==current[key])next[key]=modules[key];
            }
            config.promptRegistry=this.normalize(next);return config.promptRegistry;
        }
        value(key){return this.values()[key]??'';}
        list(){const values=this.values();return this._definitions.map(item=>({...item,value:values[item.key]??''}));}
        apply(value,{save=true}={}){
            const normalized=this.normalize(value);
            for(const item of this._definitions)if(normalized[item.key].length>30000)throw new Error(item.title+'限30000字');
            for(const key of ['inputSemantics','chronologyPrinciples']){
                let parsed=null;try{parsed=JSON.parse(normalized[key]);}catch(_){throw new Error(this._definitions.find(x=>x.key===key)?.title+'必须是合法 JSON 对象');}
                if(!plain(parsed))throw new Error(this._definitions.find(x=>x.key===key)?.title+'必须是 JSON 对象');
            }
            this.syncLegacy(normalized);
            if(save)this.engine.saveConfig?.();
            return normalized;
        }
        prepareSettings(settings){
            const input=plain(settings)?copy(settings):{},registry=this.normalize(input.promptRegistry??this.engine.config?.promptRegistry);
            if(typeof input.preset==='string')registry.preset=input.preset;
            if(typeof input.corePrompt==='string')registry.core=input.corePrompt;
            if(typeof input.macroPrompt==='string')registry.macro=input.macroPrompt;
            if(typeof input.stabilityPromptTemplate==='string')registry.stability=input.stabilityPromptTemplate;
            if(typeof input.npcAuditPrompt==='string')registry.npcAudit=input.npcAuditPrompt;
            if(typeof input.structurePrompt==='string')registry.outputProtocol=input.structurePrompt;
            if(plain(input.modulePrompts))for(const key of ['task','chronology','maintenance','exploration','integrity','worldTime','rumor'])if(typeof input.modulePrompts[key]==='string')registry[key]=input.modulePrompts[key];
            input.promptRegistry=registry;
            input.preset=registry.preset;input.corePrompt=registry.core;input.macroPrompt=registry.macro;input.stabilityPromptTemplate=registry.stability;input.npcAuditPrompt=registry.npcAudit;input.structurePrompt=registry.outputProtocol;
            input.modulePrompts=Object.assign({},plain(input.modulePrompts)?input.modulePrompts:{},{
                task:registry.task,chronology:registry.chronology,maintenance:registry.maintenance,exploration:registry.exploration,integrity:registry.integrity,worldTime:registry.worldTime,rumor:registry.rumor
            });
            return input;
        }
        rewriteSystem(system){
            let output=String(system||''),activityDefault=typeof WORLD_ACTIVITY_DELIVERY_RULES==='string'?WORLD_ACTIVITY_DELIVERY_RULES:'';
            if(activityDefault)output=output.split(activityDefault).join(this.value('worldActivity').trim());
            return output.replace(/\n{3,}/g,'\n\n').trim();
        }
        rewriteInput(input){
            let payload;try{payload=JSON.parse(String(input||''));}catch(_){return input;}
            try{payload.输入语义=JSON.parse(this.value('inputSemantics'));}catch(_){}
            if(plain(payload.本轮必须完成的宏观骨架)){
                payload.本轮必须完成的宏观骨架.规划与发生=this.value('macroPlanningGuidance');
                payload.本轮必须完成的宏观骨架.验收=this.value('macroAcceptanceGuidance');
            }
            if(plain(payload.正文可见投影规则))payload.正文可见投影规则.要求=this.value('projectionGuidance');
            if(Object.hasOwn(payload,'说明'))payload.说明=this.value('requestSummaryGuidance');
            if(Array.isArray(payload.本轮必须复核的到期事件))for(const item of payload.本轮必须复核的到期事件)if(plain(item))item.说明=this.value('dueReviewGuidance');
            if(plain(payload.时间线基准)){
                payload.时间线基准.要求=this.value('chronologyInputGuidance');
                try{payload.时间线基准.规划原则=JSON.parse(this.value('chronologyPrinciples'));}catch(_){}
            }
            if(Array.isArray(payload.本轮必须维持的异端活动))for(const item of payload.本轮必须维持的异端活动)if(plain(item))item.要求=this.value('alienReviewGuidance');
            if(plain(payload.本轮世界活动交付))payload.本轮世界活动交付.硬要求=this.value('worldActivityInputGuidance').split(/\n+/).map(x=>x.trim()).filter(Boolean);
            return JSON.stringify(payload,null,2);
        }
        historySystem(){return this.value('historyMemory');}
        historyInput(input){
            let payload;try{payload=JSON.parse(String(input||''));}catch(_){return input;}
            if(plain(payload))payload.说明=this.value('historyInputGuidance');
            return JSON.stringify(payload,null,2);
        }
        retryRequirement(acceptedResult,retryPlan=[]){
            if(acceptedResult)return Array.isArray(retryPlan)&&retryPlan.length?this.value('retryAcceptedWithPlan'):this.value('retryAccepted');
            return this.value('retryFresh');
        }
    }
