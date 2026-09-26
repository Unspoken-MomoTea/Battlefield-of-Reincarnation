    const WORLD_PROMPT_REGISTRY_VERSION=6;
    const COMPACT_DEFAULT_PRESET=`你是轮回战场的世界引擎。推进正文之外仍在运行的世界，只提交已经发生或需要规划的世界变化。
【执行流程】
1. 取事实：当前变量/已确认剧情 > 明确世界书 > 模型常识。
2. 定边界：确认当前阶段、世界时间与下一宏观节点。
3. 推世界：按可用时间推进事件、地区、人物与势力；世界不会因<user>停下而暂停。
4. 结算影响：记录<user>已经造成的客观后果，但不替<user>行动。
5. 做维护：只处理本轮确有变化的传播、经济、历法；因果偏移仅在出现重大世界级长期改变时维护。
6. 输出差分：只写新增/变化的 WorldResult；无业务变化只写摘要。`;
    const COMPACT_CORE_WORLD_RULES=`【核心边界】
- 事实优先级：当前变量/已确认剧情 > 明确世界书 > 常识；计划不是事实。
- 模型知道≠场外人物知道。人物只能依据在场观察、既有认知或可信传播行动；因<user>新行为改策必须有认知来源。
- 活跃异端只在活动缺失、复核到期、关联事件/所在地区变化或长期未复核时更新；无触发时沿用既有目标与行动，不得为了刷新而凭空改策。
- 时间与路程必须可实现；同一人物同一时段只在一处；不替<user>行动，不复述已演出琐事。
- 资产只记录固定地产、大型载具或要塞；单兵物品不写资产。探索只记录<user>实际到达、调查或可靠获知的区域。
- 因果偏移只记已实现的主线级长期变化；没有重大世界偏移就完全不写偏移记录。当前事件公开字段只写现实中可感知的信息。
- 任务结算、奖励、成就、击杀等由对应系统负责。`;
    const COMPACT_MACRO_PROMPT=`【宏观骨架】
需要补骨架时保持3~5个滚动阶段节点；先定顺序与时间边界，再填近期细节。未来规划可跨边界，实际推进不可越过下一节点；不要把多个独立阶段硬并成一个节点。`;
    const COMPACT_STABILITY_PROMPT_TEMPLATE=`【世界自救 · {{阶段}}】
稳定={{稳定值}}。{{规则}}
排异必须通过世界内合理因果发生；NPC仍受自身认知与传播链限制。`;

    const PROMPT_DEFAULT_RUMOR_LIVELINESS=`【传闻与传播 · 常驻活跃层】
传闻是持续存在的世界信息层，但默认沿用旧内容，不为了“活跃感”机械刷新。某分类为空、传播链到期/过旧，或本轮出现新的可传播公开事实时才更新。`;
    const PROMPT_DEFAULT_RUMOR_THROTTLE=`【传闻刷新节流】
一次真实触发每个公开分类最多更新1条；优先刷新同名相关传闻，否则追加并由程序淘汰最旧条目。普通行动、普通战斗、轻微数值变化不触发刷新；传闻维护失败不得拖死整轮。`;
    const PROMPT_DEFAULT_RUMOR_SOURCE=`【信息传播 · 世界侧事实】
传闻只能来自世界侧可传播事实、已有传播链与既有公开传闻。正文不是直接传播源；私密事实必须先经过目击、公开后果、调查、公告或泄露形成传播来源。公开内容不得超过来源与受众认知。`;
    const PROMPT_DEFAULT_RETRY_ACCEPTED_PLAN='严格按“补充清单”只补充或修正未通过的业务片段。已接受业务结果已经通过本地验收，默认全部保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。';
    const PROMPT_DEFAULT_RETRY_ACCEPTED='只补充或修正导致拒绝的业务片段。已接受业务结果默认保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。';
    const PROMPT_DEFAULT_RETRY_FRESH='修正格式或业务错误后重新输出一个 WorldResult JSON；不要解释错误，不要输出存储路径。';

    class WorldPromptRegistry {
        constructor(engine){this.engine=engine;}

        moduleDefinitions(){
            return [
                {key:'task',title:'任务只读',source:'TASK_AWARENESS_RULES',category:'运行模块',condition:'每次主世界推进请求',fallback:`【任务感知 · 只读】
任务.列表只作世界因果输入；事件可用“关联任务”引用已存在任务。不得创建、删除、改状态、交付或结算任务。情报购买与扣款由MVU处理；成就、击杀、奖励、惩罚不参与世界推进。`,legacy:()=>[TASK_AWARENESS_RULES]},
                {key:'chronology',title:'原著 / 数据库时间轴',source:'CHRONOLOGY_GUARD_RULES',category:'运行模块',condition:'每次主世界推进请求',fallback:`【原著/数据库时间轴硬约束】
宏观排期：已确认事实 > 明确世界书/数据库日期 > 常识。明确日期必须沿用；只有已确认且记录的因果偏移可改期。资料只到月份/时段/顺序时保持同级精度。先定“当前时间→下一节点”边界再推进区间细节；3~5个节点只是滚动窗口，不合并独立阶段。`,legacy:()=>[CHRONOLOGY_GUARD_RULES]},
                {key:'maintenance',title:'分级维护',source:'SOFT_MAINTENANCE_RULES',category:'运行模块',condition:'每次主世界推进请求',fallback:`【分级验收 · 软维护不拒绝整轮】
Schema、非法状态、因果引用、明确日期冲突是硬错误；排期补全、传闻补齐、传播复核可跨轮维护。事件有时间、条件或前因任一即可作为锚点。纠错只改被拒片段，不重写已通过内容。`,legacy:()=>[SOFT_MAINTENANCE_RULES]},
                {key:'exploration',title:'探索台账',source:'EXPLORATION_PROJECTION_RULES',category:'运行模块',condition:'每次主世界推进请求',fallback:`【玩家探索投影硬约束】
<user>实际到达整体区域时探索度至少10%；远方后台地区不自动记入；离开后保留已有探索。`,legacy:()=>[EXPLORATION_PROJECTION_RULES]},
                {key:'integrity',title:'因果与事实时间',source:'WORLD_INTEGRITY_GUARD_RULES',category:'运行模块',condition:'每次主世界推进请求',fallback:`【因果偏移与时间约束】
当前事实不得落在世界时间之后；未来计划写预计结束、下次检查或待发生事件。因果偏移不是每轮必填，只记录已实现且改变关键人物命运、重大事件结果、关键势力格局、主线可行性或异常污染规模的长期变化；本轮没有这种重大变化时省略偏移记录。稳定值由程序汇总，模型不得直接修改。`,legacy:()=>[WORLD_INTEGRITY_GUARD_RULES]},
                {key:'worldTime',title:'世界时间',source:'WORLD_TIME_RULES',category:'运行模块',condition:'每次主世界推进请求',fallback:`【世界时间所有权】
世界.时间由世界推进维护。为空时据已确认资料初始化；只有正文或明确资料表明确实经过合理时长才推进时段/日期。精确到月日使用 {yyy}年-{mm}月-{dd}日-{时间段}；时间段只能选：凌晨 / 黎明 / 清晨 / 早晨 / 上午 / 中午 / 午后 / 下午 / 傍晚 / 入夜 / 晚上 / 深夜。人物/地区更新时间由程序统一盖章。`,legacy:()=>[WORLD_TIME_RULES]},
                {key:'rumorLiveliness',title:'传闻常驻层',source:'RUMOR_LIVELINESS_RULES',category:'运行模块',condition:'每次主世界推进请求；无触发时要求保持原样',fallback:PROMPT_DEFAULT_RUMOR_LIVELINESS,legacy:()=>[RUMOR_LIVELINESS_RULES]},
                {key:'rumorThrottle',title:'传闻刷新节流',source:'RUMOR_THROTTLE_RULES',category:'运行模块',condition:'每次主世界推进请求；控制触发与数量',fallback:PROMPT_DEFAULT_RUMOR_THROTTLE,legacy:()=>[RUMOR_THROTTLE_RULES]},
                {key:'rumorSource',title:'传播来源边界',source:'RUMOR_WORLD_SOURCE_RULES',category:'运行模块',condition:'每次主世界推进请求',fallback:PROMPT_DEFAULT_RUMOR_SOURCE,legacy:()=>[RUMOR_WORLD_SOURCE_RULES]},
                {key:'worldActivity',title:'世界活动交付',source:'WORLD_ACTIVITY_DELIVERY_RULES',category:'运行模块',condition:'每次主世界推进请求；保证非异端世界活动继续推进',fallback:WORLD_ACTIVITY_DELIVERY_RULES,legacy:()=>[WORLD_ACTIVITY_DELIVERY_RULES]},
                {key:'historyMemory',title:'长期历史压缩',source:'HISTORY_MEMORY_SYSTEM',category:'辅助 AI',condition:'历史叶子达到压缩阈值时，单独发起历史摘要请求',fallback:HISTORY_MEMORY_SYSTEM,legacy:()=>[]},
                {key:'retryAcceptedWithPlan',title:'纠错重试 · 已接受结果 + 补充清单',source:'retryInput',category:'纠错重试',condition:'主请求重试，已有部分结果通过且存在补充清单',fallback:PROMPT_DEFAULT_RETRY_ACCEPTED_PLAN,legacy:()=>[]},
                {key:'retryAccepted',title:'纠错重试 · 已接受结果',source:'retryInput',category:'纠错重试',condition:'主请求重试，已有部分结果通过但无补充清单',fallback:PROMPT_DEFAULT_RETRY_ACCEPTED,legacy:()=>[]},
                {key:'retryFresh',title:'纠错重试 · 无已接受结果',source:'retryInput',category:'纠错重试',condition:'主请求重试，尚无部分结果通过',fallback:PROMPT_DEFAULT_RETRY_FRESH,legacy:()=>[]},
            ];
        }
        topDefinitions(){
            const auditDefault=typeof NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT==='string'?NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT:NPC_BUILD_AUDIT_RULES;
            return [
                {key:'corePrompt',title:'世界引擎核心边界',source:'CORE_WORLD_RULES / COMPACT_CORE_WORLD_RULES',category:'主流程',condition:'每次主世界推进请求',fallback:COMPACT_CORE_WORLD_RULES,configKey:'corePrompt'},
                {key:'macroPrompt',title:'宏观骨架交付',source:'DEFAULT_MACRO_PROMPT / COMPACT_MACRO_PROMPT',category:'条件提示',condition:'需要建立或补足宏观骨架时',fallback:COMPACT_MACRO_PROMPT,configKey:'macroPrompt'},
                {key:'stabilityPromptTemplate',title:'世界自救',source:'DEFAULT_STABILITY_PROMPT_TEMPLATE / COMPACT_STABILITY_PROMPT_TEMPLATE',category:'条件提示',condition:'稳定值低于100且未开启世界超稳时；支持 {{阶段}}/{{稳定值}}/{{规则}}',fallback:COMPACT_STABILITY_PROMPT_TEMPLATE,configKey:'stabilityPromptTemplate'},
                {key:'npcAuditPrompt',title:'NPC 构筑审计',source:'NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT',category:'条件提示',condition:'开启 NPC 构筑审计且本轮存在审计对象时',fallback:auditDefault,configKey:'npcAuditPrompt'},
                {key:'structurePrompt',title:'WorldResult 输出协议',source:'protocol()',category:'输出协议',condition:'每次主世界推进请求；程序 JSON Schema 仍固定只读',fallback:protocol().split('【Canonical WorldResult JSON Schema】')[0].trim(),configKey:'structurePrompt'},
            ];
        }
        definitions(){return [...this.topDefinitions(),...this.moduleDefinitions()];}
        moduleDefaults(){return Object.fromEntries(this.moduleDefinitions().map(item=>[item.key,item.fallback]));}
        moduleValues(){
            const defaults=this.moduleDefaults(),raw=plain(this.engine?.config?.modulePrompts)?this.engine.config.modulePrompts:{};
            const out={};
            for(const [key,value] of Object.entries(defaults))out[key]=typeof raw[key]==='string'?raw[key]:value;
            if(typeof raw.rumor==='string'&&!Object.hasOwn(raw,'rumorSource')){
                out.rumorSource=raw.rumor;
                out.rumorLiveliness='';
                out.rumorThrottle='';
            }
            return out;
        }
        initializeConfig(){
            const engine=this.engine,config=engine.config||(engine.config={});
            let dirty=false;
            const values=this.moduleValues();
            if(!same(config.modulePrompts,values)){config.modulePrompts=values;dirty=true;}
            if(Number(config.worldModulePromptVersion||0)<WORLD_PROMPT_REGISTRY_VERSION){
                config.worldModulePromptVersion=WORLD_PROMPT_REGISTRY_VERSION;dirty=true;
            }
            if(config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id){
                if(config.preset===DEFAULT_PRESET||Number(config.worldModulePromptVersion||0)<=WORLD_PROMPT_REGISTRY_VERSION){
                    config.preset=normalizeEditablePreset(COMPACT_DEFAULT_PRESET);
                    if(!config.corePrompt||config.corePrompt===CORE_WORLD_RULES)config.corePrompt=COMPACT_CORE_WORLD_RULES;
                    if(!config.macroPrompt||config.macroPrompt===DEFAULT_MACRO_PROMPT)config.macroPrompt=COMPACT_MACRO_PROMPT;
                    if(!config.stabilityPromptTemplate||config.stabilityPromptTemplate===DEFAULT_STABILITY_PROMPT_TEMPLATE)config.stabilityPromptTemplate=COMPACT_STABILITY_PROMPT_TEMPLATE;
                    dirty=true;
                }
            }
            if(dirty&&typeof engine.saveConfig==='function')engine.saveConfig();
            return dirty;
        }
        get(key){
            const top=this.topDefinitions().find(item=>item.key===key);
            if(top)return typeof this.engine.config?.[top.configKey]==='string'?this.engine.config[top.configKey]:top.fallback;
            const values=this.moduleValues();
            return typeof values[key]==='string'?values[key]:'';
        }
        describe(){
            return this.definitions().map(item=>({
                key:item.key,title:item.title,source:item.source,category:item.category,condition:item.condition,
                value:this.get(item.key),defaultValue:item.fallback,editable:true
            }));
        }
        readPromptEditor(settings){
            const next={...(settings||{})},modulePrompts=this.moduleValues(),panel=this.engine.panel;
            for(const item of this.definitions()){
                const field=panel?.querySelector?.('[data-prompt-key="'+item.key+'"]');
                if(!field)continue;
                const value=String(field.value??'');
                if(item.configKey)next[item.configKey]=value;
                else modulePrompts[item.key]=value;
            }
            next.modulePrompts=modulePrompts;
            return next;
        }
        prepareSettings(settings){
            const next={...(settings||{})};
            next.modulePrompts={...this.moduleValues(),...(plain(next.modulePrompts)?next.modulePrompts:{})};
            return next;
        }
        persistModulePrompts(settings){
            this.engine.config.modulePrompts=this.prepareSettings(settings).modulePrompts;
            this.engine.config.worldModulePromptVersion=WORLD_PROMPT_REGISTRY_VERSION;
            this.engine.saveConfig();
        }
        decorateSettings(settings){
            return {...(settings||{}),modulePrompts:{...this.moduleValues(),...(plain(settings?.modulePrompts)?settings.modulePrompts:{})}};
        }
        stripLegacy(system){
            let text=String(system||'');
            for(const item of this.moduleDefinitions()){
                for(const legacy of item.legacy()){
                    const block=String(legacy||'');
                    if(block)text=text.split(block).join('');
                }
            }
            return text.replace(/
{3,}/g,'

').trim();
        }
        composeMainSystem(system){
            let text=this.stripLegacy(system),used=[];
            const values=this.moduleValues();
            for(const item of this.moduleDefinitions().filter(item=>!['historyMemory','retryAcceptedWithPlan','retryAccepted','retryFresh'].includes(item.key))){
                const block=String(values[item.key]||'').trim();
                if(!block)continue;
                text+=(text?'

':'')+block;
                used.push({key:item.key,title:item.title,source:item.source,估算Tokens:estimateTokens(block)});
            }
            return {system:text,used};
        }
        historyMemorySystem(){return this.get('historyMemory')||HISTORY_MEMORY_SYSTEM;}
        retryPrompts(){
            return {
                acceptedWithPlan:this.get('retryAcceptedWithPlan')||PROMPT_DEFAULT_RETRY_ACCEPTED_PLAN,
                accepted:this.get('retryAccepted')||PROMPT_DEFAULT_RETRY_ACCEPTED,
                fresh:this.get('retryFresh')||PROMPT_DEFAULT_RETRY_FRESH,
            };
        }
    }
