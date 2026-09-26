    class WorldPromptRegistry {
        constructor(engine){
            this.engine=engine;
            this._definitions=Object.freeze([
                Object.freeze({key:'preset',title:'执行流程 / 主预设',group:'主流程',source:'COMPACT_DEFAULT_PRESET / config.preset',native:true,defaultValue:()=>typeof COMPACT_DEFAULT_PRESET==='string'?COMPACT_DEFAULT_PRESET:DEFAULT_PRESET}),
                Object.freeze({key:'core',title:'世界引擎核心约束',group:'主流程',source:'CORE_WORLD_RULES',native:true,defaultValue:()=>typeof COMPACT_CORE_WORLD_RULES==='string'?COMPACT_CORE_WORLD_RULES:CORE_WORLD_RULES}),
                Object.freeze({key:'macro',title:'宏观骨架',group:'主流程',source:'DEFAULT_MACRO_PROMPT',native:true,defaultValue:()=>typeof COMPACT_MACRO_PROMPT==='string'?COMPACT_MACRO_PROMPT:DEFAULT_MACRO_PROMPT}),
                Object.freeze({key:'stability',title:'世界自救',group:'主流程',source:'DEFAULT_STABILITY_PROMPT_TEMPLATE',native:true,defaultValue:()=>typeof COMPACT_STABILITY_PROMPT_TEMPLATE==='string'?COMPACT_STABILITY_PROMPT_TEMPLATE:DEFAULT_STABILITY_PROMPT_TEMPLATE}),
                Object.freeze({key:'npcAudit',title:'NPC构筑审计',group:'主流程',source:'NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT',native:true,defaultValue:()=>typeof NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT==='string'?NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT:NPC_BUILD_AUDIT_RULES}),
                Object.freeze({key:'outputProtocol',title:'WorldResult 输出协议说明',group:'主流程',source:'protocol()',native:true,defaultValue:()=>protocol().split('【Canonical WorldResult JSON Schema】')[0].trim()}),
                Object.freeze({key:'task',title:'任务只读',group:'运行模块',source:'TASK_AWARENESS_RULES',defaultValue:()=>typeof TASK_AWARENESS_RULES==='string'?TASK_AWARENESS_RULES:''}),
                Object.freeze({key:'chronology',title:'原著 / 数据库时间轴',group:'运行模块',source:'CHRONOLOGY_GUARD_RULES',defaultValue:()=>typeof CHRONOLOGY_GUARD_RULES==='string'?CHRONOLOGY_GUARD_RULES:''}),
                Object.freeze({key:'maintenance',title:'分级维护',group:'运行模块',source:'SOFT_MAINTENANCE_RULES',defaultValue:()=>typeof SOFT_MAINTENANCE_RULES==='string'?SOFT_MAINTENANCE_RULES:''}),
                Object.freeze({key:'exploration',title:'探索台账',group:'运行模块',source:'EXPLORATION_PROJECTION_RULES',defaultValue:()=>typeof EXPLORATION_PROJECTION_RULES==='string'?EXPLORATION_PROJECTION_RULES:''}),
                Object.freeze({key:'integrity',title:'因果与事实时间',group:'运行模块',source:'WORLD_INTEGRITY_GUARD_RULES',defaultValue:()=>typeof WORLD_INTEGRITY_GUARD_RULES==='string'?WORLD_INTEGRITY_GUARD_RULES:''}),
                Object.freeze({key:'worldTime',title:'世界时间所有权',group:'运行模块',source:'WORLD_TIME_RULES',defaultValue:()=>typeof WORLD_TIME_RULES==='string'?WORLD_TIME_RULES:''}),
                Object.freeze({key:'rumor',title:'传闻与传播',group:'运行模块',source:'RUMOR_WORLD_SOURCE_RULES',defaultValue:()=>typeof RUMOR_WORLD_SOURCE_RULES==='string'?RUMOR_WORLD_SOURCE_RULES:(typeof RUMOR_THROTTLE_RULES==='string'?RUMOR_THROTTLE_RULES:'')}),
                Object.freeze({key:'worldActivity',title:'世界活动交付',group:'运行模块',source:'WORLD_ACTIVITY_DELIVERY_RULES',defaultValue:()=>typeof WORLD_ACTIVITY_DELIVERY_RULES==='string'?WORLD_ACTIVITY_DELIVERY_RULES:''}),
                Object.freeze({key:'historyMemory',title:'世界长期历史压缩 · System',group:'辅助模型',source:'HISTORY_MEMORY_SYSTEM',defaultValue:()=>typeof HISTORY_MEMORY_SYSTEM==='string'?HISTORY_MEMORY_SYSTEM:''}),
                Object.freeze({key:'inputWorldbookSemantics',title:'输入语义 · 世界书',group:'请求输入指令',source:'40-engine-runtime / 输入语义.世界书',defaultValue:()=> '可选设定/原著差异/时间资料；不是已发生事实，没有世界书也必须正常推演。'}),
                Object.freeze({key:'inputCurrentStateSemantics',title:'输入语义 · 当前变量',group:'请求输入指令',source:'40-engine-runtime / 输入语义.当前变量',defaultValue:()=> '世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期因果偏移，以及“近期原始锚点 + 更早根总结”组成的分层长期历史记忆。原始历史永久留在MVU，已被上层总结收纳的旧节点不再重复进入热上下文。资产通过WorldResult.资产与同一顶层账簿双向同步；未提供的任务/商城/纯结算数据不属于本引擎职责。'}),
                Object.freeze({key:'inputProseSemantics',title:'输入语义 · 正文楼层',group:'请求输入指令',source:'40-engine-runtime / 输入语义.正文楼层',defaultValue:()=> '已经演出的剧情；用于确认当前事实与时间跨度，不复述成后台日常。'}),
                Object.freeze({key:'inputStructuralRepairSemantics',title:'输入语义 · 程序结构修复',group:'请求输入指令',source:'40-engine-runtime / 输入语义.程序结构修复',defaultValue:()=> '引擎已做的确定性纠正；不得在输出中恢复被程序降级/修正的旧错误。'}),
                Object.freeze({key:'inputTimelineSemantics',title:'输入语义 · 时间线调度',group:'请求输入指令',source:'40-engine-runtime / 输入语义.时间线调度',defaultValue:()=> '程序计算出的宏观边界与到期复核要求；模型负责语义推演，不重定义调度协议。'}),
                Object.freeze({key:'inputWorldResultSemantics',title:'输入语义 · WorldResult',group:'请求输入指令',source:'40-engine-runtime / 输入语义.WorldResult',defaultValue:()=> '唯一业务交付物；不包含 JSON Pointer、add/replace 路径或程序日志。'}),
                Object.freeze({key:'inputCharacterManagementSemantics',title:'输入语义 · 角色管理',group:'请求输入指令',source:'40-engine-runtime / 输入语义.角色管理',defaultValue:()=> '若提供NPC构筑审计，只处理列出的既有NPC缺口；完整构筑资料只在审计对象中提供，避免全量NPC重复占用上下文。'}),
                Object.freeze({key:'macroPlanningInstruction',title:'宏观骨架 · 规划与发生',group:'请求输入指令',source:'40-engine-runtime / 本轮必须完成的宏观骨架.规划与发生',defaultValue:()=> '本轮必须补齐骨架，不能以时间未推进、正文没有宏观变化或无业务变化为由省略。建立待发生节点属于未来规划，可排在下一宏观边界之后，不表示事件现在发生；近期细节与已发生事实仍受本轮时间容量和下一宏观边界限制。不得为凑数提前原著日期，或预先结算未来事件的结果；更新时间使用当前世界时间。'}),
                Object.freeze({key:'macroAcceptanceInstruction',title:'宏观骨架 · 验收',group:'请求输入指令',source:'40-engine-runtime / 本轮必须完成的宏观骨架.验收',defaultValue:()=> '按已有状态与本轮结果合并后计数；若本轮结束或取消已有宏观节点，须补足被移出窗口的数量。重试时以已接受业务结果和最新补充清单为准，不重复创建已接受节点。'}),
                Object.freeze({key:'knowledgePriorityInstruction',title:'推演阶段 · 知识来源',group:'请求输入指令',source:'40-engine-runtime / 推演阶段.知识来源',defaultValue:()=> '当前确认事实 > 明确世界书设定（若有） > 模型已有原著/世界知识 > 谨慎推断'}),
                Object.freeze({key:'proseProjectionInstruction',title:'正文可见投影规则',group:'请求输入指令',source:'40-engine-runtime / 正文可见投影规则.要求',defaultValue:()=> '非战斗正文会读取完整因果轨道：当前阶段用于当前局势，故事线/下一节点用于长期叙事方向，偏移记录用于跨章因果记忆；这些是规划依据，不等于角色预知或自动知晓幕后信息。正文还会读取进行中当前事件的公开字段，以及程序筛选的场外场景：每个热地区只出现一次共享环境/现场群体，人物列表只携带各自行动事实，关联事件只作索引；活跃异端始终保留在其所在热场景。以上均用于叙事连续性，不代表角色已知。可能影响当前场景的当前事件应维护公开征兆和可见影响；不要把隐藏条件、默认走向或未来宏观事件详情塞进公开字段。'}),
                Object.freeze({key:'requestClosingInstruction',title:'请求结尾说明',group:'请求输入指令',source:'40-engine-runtime / 说明',defaultValue:()=> '当前变量为已确认热事实，不重复结算；已归档旧事件和已回收传播不要重新创建；世界书为空不构成阻塞；只提交业务事实，存储路径由程序编译。'}),
                Object.freeze({key:'dueEventInstruction',title:'到期事件复核说明',group:'请求输入指令',source:'40-engine-runtime + 59-due-event-relaxation / 到期事件.说明',defaultValue:()=> '软提醒：该事件已到计划/复核时间。条件与前因满足则转为进行中；若暂不发生，可保持待发生并优先填写新的“下次检查”。“条件”只表示事件触发条件，不要改写成延期阻碍。未处理不会导致本轮世界推进被驳回。'}),
                Object.freeze({key:'timelinePlanningInstruction',title:'时间线调度说明',group:'请求输入指令',source:'10-world-state / timelineState.说明',defaultValue:()=> '先用因果轨道、当前事实与模型已有世界/原著知识建立宏观骨架；世界书若存在只作补充校正。随后仅展开当前时间到下一宏观节点之间的近期事件、人物、势力与传播。非公历或作品内时间按作品语义比较，不强行改写为公历。'}),
                Object.freeze({key:'staleActiveInstruction',title:'超期活动事件复核说明',group:'请求输入指令',source:'10-world-state / staleActiveEvents.说明',defaultValue:()=> '局部活动长期停留在进行中；应结束/取消，或确认仍持续并更新到当前世界时间、当前进展与下次检查。'}),
                Object.freeze({key:'alienReviewInstruction',title:'活跃异端活动复核说明',group:'请求输入指令',source:'59-alien-activity-normalization / 要求',defaultValue:()=> '仅因本轮触发复核才需要在 WorldResult.人物 中提交该活跃异端的新活动；至少给出非空地点、目标、行动。人物更新时间无需抄写，由程序使用本轮最终世界时间统一记录。未获得新情报时沿用既有目标/行动，不得因为模型看见<user>行为就自动追踪或改策；若因<user>行为改变目标/行动，必须已有认知或同轮写入可追溯的认知/认知来源。若本轮已确认死亡，则只把异端状态更新为死亡。'}),
                Object.freeze({key:'rumorSourceBoundaryInstruction',title:'传闻维护 · 取材边界',group:'请求输入指令',source:'59-rumor-world-request / 取材边界',defaultValue:()=> '只使用世界侧可传播事实、已有传播链与既有公开传闻；正文不是直接传播源'}),
                Object.freeze({key:'chronologyRequestInstruction',title:'原著时间轴 · 本轮要求',group:'请求输入指令',source:'58-chronology-guard / 原著时间校验.要求',defaultValue:()=> '宏观节点先定原著/数据库日期、节点粒度与合理跨度，再展开当前→下一节点区间。明确到日的日期必须服从；仅有月份、时段或顺序时按软约束保守规划，不因估计差异反复改期。'}),
                Object.freeze({key:'historyCompressionInstruction',title:'历史压缩 · 输入说明',group:'辅助模型',source:'59-history-memory / 说明',defaultValue:()=> '按给定顺序压缩；时间字段是权威锚点，不得改写或补造。'}),
                Object.freeze({key:'retryAcceptedInstruction',title:'纠错重试 · 已有补充清单',group:'纠错提示词',source:'10-world-state / retryInput',defaultValue:()=> '严格按“补充清单”只补充或修正未通过的业务片段。已接受业务结果已经通过本地验收，默认全部保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。'}),
                Object.freeze({key:'retryPartialInstruction',title:'纠错重试 · 已有接受结果',group:'纠错提示词',source:'10-world-state / retryInput',defaultValue:()=> '只补充或修正导致拒绝的业务片段。已接受业务结果默认保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。'}),
                Object.freeze({key:'retryFreshInstruction',title:'纠错重试 · 重新输出',group:'纠错提示词',source:'10-world-state / retryInput',defaultValue:()=> '修正格式或业务错误后重新输出一个 WorldResult JSON；不要解释错误，不要输出存储路径。'})
            ]);
        }
        definitions(){return this._definitions.slice();}
        defaults(){return Object.fromEntries(this._definitions.map(item=>[item.key,String(item.defaultValue?.()??'')]));}
        legacyValues(){
            const config=this.engine.config||{},modules=plain(config.modulePrompts)?config.modulePrompts:{},fallback=this.defaults();
            return {
                ...fallback,
                preset:String(config.preset??fallback.preset),
                core:String(config.corePrompt??fallback.core),
                macro:String(config.macroPrompt??fallback.macro),
                stability:String(config.stabilityPromptTemplate??fallback.stability),
                npcAudit:String(config.npcAuditPrompt??fallback.npcAudit),
                outputProtocol:String(config.structurePrompt??fallback.outputProtocol),
                task:String(modules.task??fallback.task),
                chronology:String(modules.chronology??fallback.chronology),
                maintenance:String(modules.maintenance??fallback.maintenance),
                exploration:String(modules.exploration??fallback.exploration),
                integrity:String(modules.integrity??fallback.integrity),
                worldTime:String(modules.worldTime??fallback.worldTime),
                rumor:String(modules.rumor??fallback.rumor),
                worldActivity:String(config.promptRegistry?.worldActivity??fallback.worldActivity),
                historyMemory:String(config.promptRegistry?.historyMemory??fallback.historyMemory)
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
            const config=this.engine.config||(this.engine.config={});
            const source=values===undefined?this.absorbLegacyOverrides():values;
            const v=this.normalize(source);
            config.preset=normalizeEditablePreset(v.preset);
            config.corePrompt=v.core;
            config.macroPrompt=v.macro;
            config.stabilityPromptTemplate=v.stability;
            config.npcAuditPrompt=v.npcAudit;
            config.structurePrompt=v.outputProtocol;
            config.modulePrompts=Object.assign({},plain(config.modulePrompts)?config.modulePrompts:{},{
                task:v.task,chronology:v.chronology,maintenance:v.maintenance,exploration:v.exploration,
                integrity:v.integrity,worldTime:v.worldTime,rumor:v.rumor
            });
            config.promptRegistry=v;
            return v;
        }
        values(){return this.normalize(this.engine.config?.promptRegistry);}
        absorbLegacyOverrides(){
            const config=this.engine.config||{},current=this.values(),next={...current};
            const native=[
                ['preset','preset'],['core','corePrompt'],['macro','macroPrompt'],
                ['stability','stabilityPromptTemplate'],['npcAudit','npcAuditPrompt'],['outputProtocol','structurePrompt']
            ];
            for(const [key,legacyKey] of native){
                if(typeof config[legacyKey]==='string'&&config[legacyKey]!==current[key])next[key]=config[legacyKey];
            }
            const modules=plain(config.modulePrompts)?config.modulePrompts:{};
            for(const key of ['task','chronology','maintenance','exploration','integrity','worldTime','rumor']){
                if(typeof modules[key]==='string'&&modules[key]!==current[key])next[key]=modules[key];
            }
            config.promptRegistry=this.normalize(next);
            return config.promptRegistry;
        }
        value(key){return this.values()[key]??'';}
        list(){const values=this.values();return this._definitions.map(item=>({...item,value:values[item.key]??''}));}
        apply(value,{save=true}={}){
            const normalized=this.normalize(value);
            for(const item of this._definitions){
                if(normalized[item.key].length>30000)throw new Error(item.title+'限30000字');
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
            input.preset=registry.preset;
            input.corePrompt=registry.core;
            input.macroPrompt=registry.macro;
            input.stabilityPromptTemplate=registry.stability;
            input.npcAuditPrompt=registry.npcAudit;
            input.structurePrompt=registry.outputProtocol;
            input.modulePrompts=Object.assign({},plain(input.modulePrompts)?input.modulePrompts:{},{
                task:registry.task,chronology:registry.chronology,maintenance:registry.maintenance,
                exploration:registry.exploration,integrity:registry.integrity,worldTime:registry.worldTime,rumor:registry.rumor
            });
            return input;
        }
        rewriteSystem(system){
            let output=String(system||''),activityDefault=typeof WORLD_ACTIVITY_DELIVERY_RULES==='string'?WORLD_ACTIVITY_DELIVERY_RULES:'';
            if(activityDefault){
                const replacement=this.value('worldActivity').trim();
                output=output.split(activityDefault).join(replacement);
            }
            return output.replace(/\n{3,}/g,'\n\n').trim();
        }
        rewriteInput(input){
            let payload;try{payload=JSON.parse(String(input||''));}catch(_){return input;}
            const setIf=(object,key,promptKey)=>{if(plain(object)&&Object.hasOwn(object,key))object[key]=this.value(promptKey);};
            const semantics=payload.输入语义;
            setIf(semantics,'世界书','inputWorldbookSemantics');
            setIf(semantics,'当前变量','inputCurrentStateSemantics');
            setIf(semantics,'正文楼层','inputProseSemantics');
            setIf(semantics,'程序结构修复','inputStructuralRepairSemantics');
            setIf(semantics,'时间线调度','inputTimelineSemantics');
            setIf(semantics,'WorldResult','inputWorldResultSemantics');
            setIf(semantics,'角色管理','inputCharacterManagementSemantics');
            setIf(payload.本轮必须完成的宏观骨架,'规划与发生','macroPlanningInstruction');
            setIf(payload.本轮必须完成的宏观骨架,'验收','macroAcceptanceInstruction');
            setIf(payload.推演阶段,'知识来源','knowledgePriorityInstruction');
            setIf(payload.正文可见投影规则,'要求','proseProjectionInstruction');
            setIf(payload,'说明','requestClosingInstruction');
            setIf(payload.时间线调度,'说明','timelinePlanningInstruction');
            if(Array.isArray(payload.本轮必须复核的到期事件))for(const item of payload.本轮必须复核的到期事件)setIf(item,'说明','dueEventInstruction');
            if(Array.isArray(payload.本轮必须复核的超期活动事件))for(const item of payload.本轮必须复核的超期活动事件)setIf(item,'说明','staleActiveInstruction');
            if(Array.isArray(payload.本轮必须维持的异端活动))for(const item of payload.本轮必须维持的异端活动)setIf(item,'要求','alienReviewInstruction');
            setIf(payload.传闻维护,'取材边界','rumorSourceBoundaryInstruction');
            setIf(payload.原著时间校验,'要求','chronologyRequestInstruction');
            return JSON.stringify(payload,null,2);
        }
        retryInstruction({accepted=false,hasPlan=false}={}){
            return accepted?(hasPlan?this.value('retryAcceptedInstruction'):this.value('retryPartialInstruction')):this.value('retryFreshInstruction');
        }
        historyCompressionInstruction(){return this.value('historyCompressionInstruction');}
        historySystem(){return this.value('historyMemory');}
    }
