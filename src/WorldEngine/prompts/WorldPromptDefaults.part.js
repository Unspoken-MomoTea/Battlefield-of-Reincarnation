    // Canonical editable prompt defaults and built-in prompt migrations.
    // Moved from legacy world-engine source parts; behavior intentionally unchanged.

    // Legacy NPC audit prompt retained only to migrate older prompt documents/config defaults.
    const NPC_BUILD_AUDIT_RULES=`【角色管理 · NPC构筑审计】
只处理“角色管理.NPC构筑审计”列出的既有 NPC；目标是补真实缺口，不是提难度或重做角色。
1. 不改人物层级、HP_MAX/EP_MAX；不覆盖已完整组件，不用改名制造重复能力。
2. 最低构筑：杂兵=血统1/装备1/技能可0；精英=血统1/装备2/技能1；Boss=血统1/装备3/技能2；上限为血统2/装备6/技能4。精英需有杀伤、生存、机动/控制，Boss另有阶段或形态机制。
3. 能力只归一个主要组件：血统=本体条件，装备=实体，技能=执行方式，状态=当前结果，形态=独立战斗模式。
4. 只用 WorldResult.关系 更新既有 NPC；只提交新增/修正项。不得输出真属性、最终属性或强化缓存；血统/形态五维必须齐全，技能不写基础/衍生属性。
5. 效果必须可结算，不写随机概率词条；每个审计对象至少修复一个与现有身份、职业、层级和已演出能力一致的缺口，资料不足时做最小补全。`;

    // ---- migrated from script/world-engine-src/55-npc-narrative-audit.part.js ----
    // NPC 构筑份量与生命层级解耦：份量由人物资料中的剧情定位决定，层级只描述本体强度。
    const NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT=`【角色管理 · NPC构筑审计】
只处理“角色管理.NPC构筑审计”列出的既有 NPC；目标是补真实缺口，不是提难度、改层级或重做角色。
1. 审计级别与人物层级独立，是世界推进私有信息，只允许保存在“世界.后台.人物.审计级别”，禁止写入关系列表/NPC公开面板。新建的非队友NPC首次进入后台人物时，由你按剧情身份、叙事地位、已演出能力与遭遇需求填写杂兵级/精英级/首领/Boss级；活跃异端首次建档默认首领/Boss级；队友不定级、不参与NPC构筑审计。
2. 已有合法私有审计级别时优先沿用。只有角色获得/失去关键力量、战斗职责或剧情地位发生实质变化时，才通过 WorldResult.人物 更新审计级别；普通受伤、单次胜负、临时状态或单纯层级高低不得改级。旧档或漏填时由程序按异端身份及既有身份/职业/背景故事/态度兜底推断。
3. 最低构筑：杂兵=血统1/装备2/技能1；精英=血统1/装备4/技能2；Boss=血统1/装备6/技能4。血统默认1项；只有明确多重血统设定才增加。装备与技能可按真实设定超过最低数，但不得拆分、复制或堆同义能力凑数。最低装备数只统计状态=1的已装备项；状态0/2不计入构筑数量。
4. 审计新增装备统一写状态=1并视为已装备；状态0仅用于剧情明确的随身未装备物，状态2仅用于仓库物，不得用0/2凑最低装备数。
5. 精英需有杀伤、生存、机动/控制手段；Boss另有阶段、形态、状态切换或等价战斗机制。
6. 能力只归一个主要组件：血统=本体条件，装备=实体，技能=执行方式，状态=当前结果，形态=独立战斗模式。
7. 构筑补全只用 WorldResult.关系 更新既有 NPC；审计级别只用 WorldResult.人物 写入世界后台。只提交新增/修正项，不得输出真属性、最终属性或强化缓存；血统/形态五维必须齐全，技能不写基础/衍生属性。
8. 效果必须可结算，不写随机概率词条；每个审计对象至少修复一个与现有身份、职业、剧情定位、层级和已演出能力一致的缺口，资料不足时做最小补全。`;

    // 审计新增装备默认状态=1的编译规则已迁移至 WorldNpcAuditService。

    // 默认审计提示词迁移由 WorldNpcAuditPromptFeature.initialize() 负责。


    // ---- migrated from script/world-engine-src/57-task-awareness.part.js ----
    // 任务感知层：任务.列表是现有 MVU 的唯一正式任务账簿；世界引擎只读消费，不建立第二套后台任务库。
    const TASK_AWARENESS_RULES=`【任务感知 · 只读】
任务列表是世界因果来源之一。世界推进不得创建、删除或修改任务，也不得推进任务状态、交付、结算或奖励；任务影响只通过事件、人物行动、势力地区、探索与传播表现。事件可用“关联任务”引用当前任务.列表中已存在的任务名，作为因果来源；禁止引用不存在的任务。
情报交易由世界引擎生成或刷新；购买、扣款、消费性删除及购买后创建任务由MVU/变量AI处理，世界引擎下一轮只读接续。副本成就、击杀、奖励与惩罚不进入世界推进上下文。`;
    const TASK_WORLD_BOOK_TITLE='任务与委托系统';
    // 旧版曾把正式任务规则从内置默认资料中排除；现在恢复为可读取的权威规则。
    BUILTIN_DEFAULT_WORLD_BOOK_EXCLUSIONS.delete(TASK_WORLD_BOOK_TITLE);

    // 任务只读投影与事件关联校验已迁移至 WorldTaskAwarenessService。\n\n    // 请求、世界书目录恢复已迁移至 WorldTaskAwarenessFeature。


    // ---- migrated from script/world-engine-src/58-chronology-guard.part.js ----
    // 原著/数据库时间轴保护层：宏观节点先服从权威时间资料，再展开区间细节。
    const CHRONOLOGY_GUARD_RULES=`【原著/数据库时间轴硬约束】
1. 宏观节点的日期与跨度必须先服从当前已确认事实和明确世界书/数据库中的原著时间资料，再使用模型已有原著知识补足；不得为了推动剧情、制造冲突、维持紧张感或让<user>尽快参与而主动提前关键事件。
2. 世界书/数据库已给出某宏观事件的明确日期时，必须沿用该日期/时段；只有已确认剧情造成足以改线的因果偏移，且同轮因果.偏移记录明确关联该节点并说明提前/延后原因时，才允许改期。
3. 原著只给月份、时段、事件顺序或大致间隔时，沿用同级时间精度并按原著节奏保守留白；不确定跨度就使用可理解的相对/因果时间，只推进必要一步，不得擅自补成过近的具体日期。
4. 先确定“当前世界时间 → 下一宏观节点”的合理时间边界，再在该区间内生成当前事件与近期节点；不能先决定下一章要发生什么，再倒推一个过近日期。
5. 3~5个宏观节点只是滚动规划窗口，不代表必须覆盖完整原著篇章。一个宏观节点只表达一个阶段转折；不得为了凑节点数量，把远行、集结、连续战役或多个独立剧情阶段合并成一个节点。
6. 排期相邻宏观节点前，先检查两者之间现实上需要经历的旅行、准备、组织动员、战役推进与因果发展；若中间包含多个独立阶段，就拆分节点或拉开跨度。`;
    const CHRONOLOGY_PRESET_STEP_OLD='Step 2 · 定边界：确认当前阶段与下一宏观节点；只有篇章、地区、战争、势力或关键人物命运发生阶段变化时才调整宏观骨架。';
    const CHRONOLOGY_PRESET_STEP_V1='Step 2 · 定边界与日期：以当前世界时间为起点，先按明确世界书/数据库时间资料与原著节奏确定下一宏观节点及合理跨度；只有已确认因果偏移才能改期，再决定是否调整宏观骨架。';
    const CHRONOLOGY_PRESET_STEP_V2='Step 2 · 定边界与日期：以当前世界时间为起点，按明确资料与原著节奏规划接下来3~5个滚动宏观节点；每个节点只表达一个阶段转折，并为相邻节点间的旅行、准备与因果发展留足时间；只有已确认因果偏移才能改期。';
    const upgradeChronologyPreset=value=>{
        const text=String(value||'');
        for(const previous of [CHRONOLOGY_PRESET_STEP_OLD,CHRONOLOGY_PRESET_STEP_V1])if(text.includes(previous))return text.replace(previous,CHRONOLOGY_PRESET_STEP_V2);
        return text;
    };
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings))BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=upgradeChronologyPreset(BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset);

    // 日级时间证据、编译硬校验与纠错动作已迁移至 WorldChronologyPolicy。\n\n    // 时间轴请求装饰与默认预设迁移已迁移至 WorldChronologyFeature。


    // ---- migrated from script/world-engine-src/59-world-integrity-guard.part.js ----
    // 世界完整性保护：统一精确时钟；因果偏移采用软归一化，不因语义或幅度问题拖死整轮推进。
    const WORLD_INTEGRITY_GUARD_RULES=`【因果偏移与时间约束】
1. 时间校验按字段粒度处理：事件、地区、历史、传播等宏观事实只按“自然日”硬校验；同一自然日内的上午/下午/HH:mm差异不算未来越界，只有跨日未来事实才拒绝。
2. 人物当前动态仅在“当前世界时间”和“人物更新时间”双方都明确到 HH:mm 时做分钟级先后校验；任一侧只有清晨/上午/下午等粗粒度时，同日视为合法。当前状态仍优先复用世界.时间原文，未来计划放预计结束、下次检查或待发生事件。
3. 偏移记录不是每轮必填，也不是剧情日志、剧情总结或章节小结。只记录已经发生、已经确认，并且现实结果已经改变关键人物命运、重大事件结果、关键势力格局、主线可行性或异常污染规模的长期偏移；本轮没有这种重大世界级变化时，省略“因果.偏移记录”，不得为了让稳定值变化而硬造记录。
4. 判定依据是已经实现的结果，不是危险程度、能力强弱、计划、意图或潜在上限。即使持有足以影响整个世界的高危装置，只要尚未使用且尚未造成现实结果，就不产生偏移。
5. 同一已确认根因及其连锁后果只记一条，优先更新已有偏移；只有形成新的、独立的长期偏移方向才新增。禁止把同一条因果链拆成剧情小总结连续累计。
6. 预测、风险、可能、潜在或未来尚未发生的后果不产生偏移；位置暴露、敌人警觉、受伤、逃脱、生存/行动难度变化等局部战术后果不产生偏移；稳定下降及其后续世界响应也不能反过来成为新的负偏移。
7. 负值锚点：关键人物命运不可逆改写 -3~-12；重大事件结果不可逆改变 -3~-10；关键势力格局或主线可行性实质破坏 -2~-8；异常污染持续扩大 -1~-10。普通变化不记录。
8. 正值只来自真实修复：关键人物/重大事件修复 +3~+10；异常清除 +1~+15；势力格局或主线结构修复 +2~+8。高于100不能来自普通善行、胜利或奖励。
9. 单条建议范围 -12~-1 或 +1~+15，0 不建新记录；同一引发者同轮负向总量最多 -12、正向总量最多 +15。程序对越界、同根拆分、局部后果或尚未产生现实结果的偏移执行软归一化/忽略，不触发重试，也不驳回本轮其它世界推进结果。
10. 世界.稳定是偏移台账的派生值，由程序汇总；模型不得直接修改，也不需要每轮“更新稳定值”。`;

    // 精确时钟解析、同日粗粒度放行与人物分钟级保护已迁移至 WorldTimePolicy + WorldTimelinePolicy。

    // 因果偏移软归一化与世界尺度过滤已迁移至 WorldCausalService。

    // 时间一致性纠错动作已迁移至 WorldRetryGuidanceService。\n\n    // 请求 manifest / system 装饰已迁移至 WorldIntegrityRequestFeature + WorldPromptRegistry。


    // ---- migrated from script/world-engine-src/59-world-time-ownership.part.js ----
    // 世界时间单一所有权：世界推进 AI 负责初始化/推进世界.时间；变量 AI 的写入在事件层被回滚。
    const WORLD_TIME_RULES=`【世界时间所有权】
1. 世界.时间由世界推进独占维护。顶层“时间”只用于初始化或实际推进当前世界时钟；人物更新时间、事件计划时间不能代替世界时钟。
2. 当前时间为空/待初始化时，先用“最新已确认正文 + 当前阶段 + 当前地点”定位玩家此刻处于任务世界时间线的哪个位置，再对照已读取的时间线/年表/章节资料建立当前时间锚点。下一宏观节点、任务期限和未来事件日期只能作为未来边界，禁止直接拿来当当前时间。
3. 资料只能确定年份、月份、季节、阶段或时段时保持同级精度，不为格式完整编造月日；明确资料与当前剧情无法唯一对应时，宁可保留较粗时间，也不要伪造精确日期。
4. 每轮先对比最新正文与现有世界.时间。正文明确发生过夜、数小时后、次日、跨日旅行，或明确出现新的日期/时段时，必须提交顶层“时间”同步推进；禁止保持旧世界时钟，却把已经发生的事件/人物动态写到旧时钟之后。
5. 精确到月日时统一写 {yyy}年-{mm}月-{dd}日-{时间段}；月份必须为数字。时间段只能选：凌晨 / 黎明 / 清晨 / 早晨 / 上午 / 中午 / 午后 / 下午 / 傍晚 / 入夜 / 晚上 / 深夜。不要输出“夜晚/黄昏/早上”等其它同义词。
6. 时间段是粗粒度时间锚点，不是每轮计数器。没有足够时间流逝跨过当前时段时，省略“时间”并保持原值；只有正文或明确时间资料表明确实经过了合理时长，才推进到后续时段或日期。禁止仅因本轮执行了世界推进就机械跳时段。
7. 世界时间不得回退，也不得把待发生事件的计划时间提前写成当前时间。人物/地区等“更新时间”由程序按本轮最终世界时间统一盖章。从主神空间进入新副本时，程序会先清空世界.时间与旧历法；必须把这视为全新世界的时间初始化，严禁继承上一副本或主神空间“轮回历”的日期。`;

    // 世界时间结果策略、Schema、编译事务与 replay 范围已迁移至 WorldTimePolicy / canonical services。
    // 本文件仅保留可编辑的 WORLD_TIME_RULES 提示词常量。\n

    // ---- migrated from script/world-engine-src/59-editable-module-prompts.part.js ----
    // 提示词工作台最终层：只暴露真正发送给世界 AI 的文字模块；程序 Schema/校验仍由代码负责。
    const WORLD_MODULE_PROMPT_VERSION=5;
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

    const WORLD_PROMPT_MODULE_DEFS=Object.freeze([
        Object.freeze({key:'task',title:'任务只读',source:'TASK_AWARENESS_RULES',legacy:()=>[TASK_AWARENESS_RULES],fallback:`【任务感知 · 只读】
任务.列表只作世界因果输入；事件可用“关联任务”引用已存在任务。不得创建、删除、改状态、交付或结算任务。情报购买与扣款由MVU处理；成就、击杀、奖励、惩罚不参与世界推进。`}),
        Object.freeze({key:'chronology',title:'原著 / 数据库时间轴',source:'CHRONOLOGY_GUARD_RULES',legacy:()=>[CHRONOLOGY_GUARD_RULES],fallback:`【原著/数据库时间轴硬约束】
宏观排期：已确认事实 > 明确世界书/数据库日期 > 常识。明确日期必须沿用；只有已确认且记录的因果偏移可改期。资料只到月份/时段/顺序时保持同级精度。先定“当前时间→下一节点”边界再推进区间细节；3~5个节点只是滚动窗口，不合并独立阶段。`}),
        Object.freeze({key:'maintenance',title:'分级维护',source:'SOFT_MAINTENANCE_RULES',legacy:()=>[SOFT_MAINTENANCE_RULES],fallback:`【分级验收 · 软维护不拒绝整轮】
Schema、非法状态、因果引用、明确日期冲突是硬错误；排期补全、传闻补齐、传播复核可跨轮维护。事件有时间、条件或前因任一即可作为锚点。纠错只改被拒片段，不重写已通过内容。`}),
        Object.freeze({key:'exploration',title:'探索台账',source:'EXPLORATION_PROJECTION_RULES',legacy:()=>[EXPLORATION_PROJECTION_RULES],fallback:`【玩家探索投影硬约束】
<user>实际到达整体区域时探索度至少10%；远方后台地区不自动记入；离开后保留已有探索。`}),
        Object.freeze({key:'integrity',title:'因果与事实时间',source:'WORLD_INTEGRITY_GUARD_RULES',legacy:()=>[WORLD_INTEGRITY_GUARD_RULES],fallback:`【因果偏移与时间约束】
当前事实不得落在世界时间之后；未来计划写预计结束、下次检查或待发生事件。因果偏移不是每轮必填，只记录已实现且改变关键人物命运、重大事件结果、关键势力格局、主线可行性或异常污染规模的长期变化；本轮没有这种重大变化时，省略“因果.偏移记录”，不得为了让稳定值变化而硬造记录。位置暴露、敌人警觉、受伤、逃脱、行动/生存难度变化等局部后果不记。计划、风险、能力上限不记；同根因优先更新同一条。稳定值由程序根据有效偏移汇总，模型不得直接修改。`}),
        Object.freeze({key:'worldTime',title:'世界时间',source:'WORLD_TIME_RULES',legacy:()=>[WORLD_TIME_RULES],fallback:`【世界时间所有权】
世界.时间由世界推进维护。为空时据已确认资料初始化；没有足够时间流逝跨过当前时段就保持原值，不因每轮推进而机械跳时段。精确到月日使用 {yyy}年-{mm}月-{dd}日-{时间段}；时间段只能选：凌晨 / 黎明 / 清晨 / 早晨 / 上午 / 中午 / 午后 / 下午 / 傍晚 / 入夜 / 晚上 / 深夜。只有正文或明确资料表明确实经过合理时长才推进时段/日期；不得回退或把未来计划时间当当前时间。人物/地区更新时间由程序统一盖章。`}),
        Object.freeze({key:'rumor',title:'传闻与传播',source:'RUMOR_THROTTLE_RULES / RUMOR_WORLD_SOURCE_RULES',legacy:()=>[RUMOR_LIVELINESS_RULES,RUMOR_THROTTLE_RULES,RUMOR_WORLD_SOURCE_RULES],fallback:`【信息传播 · 世界侧事实】
传闻只来自“世界侧可传播事实”、已有传播链和既有公开传闻；正文不是直接传播源。私密事实必须先形成目击、公开后果、调查、公告或泄露。公开内容不得超过来源/受众认知，传播按时间与空间扩散。无触发保持原样；空分类、传播复核或新公开事实时按需更新，每个触发每类最多1条。普通行动/战斗本身不触发；传闻失败不重跑整轮。购买、扣款与消费性删除由MVU处理。`})
    ]);
    function worldModulePromptDefaults(){
        return Object.fromEntries(WORLD_PROMPT_MODULE_DEFS.map(item=>[item.key,item.fallback]));
    }
    function normalizeWorldModulePrompts(value){
        const source=plain(value)?value:{};
        const out={};
        for(const item of WORLD_PROMPT_MODULE_DEFS)out[item.key]=typeof source[item.key]==='string'?source[item.key]:item.fallback;
        return out;
    }
    function stripLegacyWorldModulePrompts(system){
        let text=String(system||'');
        for(const item of WORLD_PROMPT_MODULE_DEFS){
            for(const legacy of item.legacy()){
                const block=String(legacy||'');
                if(block)text=text.split(block).join('');
            }
        }
        return text.replace(/\n{3,}/g,'\n\n').trim();
    }
    function appendConfiguredWorldModulePrompts(system,modulePrompts){
        let text=stripLegacyWorldModulePrompts(system);
        const prompts=normalizeWorldModulePrompts(modulePrompts),used=[];
        for(const item of WORLD_PROMPT_MODULE_DEFS){
            const block=String(prompts[item.key]||'').trim();
            if(!block)continue;
            text+=(text?'\n\n':'')+block;
            used.push({key:item.key,title:item.title,source:item.source,估算Tokens:estimateTokens(block)});
        }
        return {system:text,used};
    }

    // 内置默认直接展示精简版；旧用户只在仍使用内置默认时迁移一次，自定义文档不强制覆盖。
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings)){
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=normalizeEditablePreset(COMPACT_DEFAULT_PRESET);
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.corePrompt=COMPACT_CORE_WORLD_RULES;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.macroPrompt=COMPACT_MACRO_PROMPT;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.stabilityPromptTemplate=COMPACT_STABILITY_PROMPT_TEMPLATE;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.modulePrompts=worldModulePromptDefaults();
    }

    // 运行时读写、预设持久化与最终请求重写已迁移到 WorldPromptRegistry + WorldEngineClassBridge。
