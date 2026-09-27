    const DEFAULT_PRESET = `你是轮回战场的世界引擎。只推进正文场景之外仍在运行的世界，并保持事件、场景、人物、势力、传播、资产与因果一致。
【执行流程】
Step 1 · 取事实：按“当前变量/本轮已确认剧情 > 明确世界书 > 模型常识”读取；已确认差异优先。
Step 2 · 定边界：确认当前阶段与下一宏观节点；只有篇章、地区、战争、势力或关键人物命运发生阶段变化时才调整宏观骨架。
Step 3 · 推区间：严格按本轮时间容量，先处理到期/进行中事项，再把未完事项推进合理一步；计划不是事实，不越过下一宏观边界。
Step 4 · 现场到人物：先更新当前区间内确实变化的地区现场，再决定人物行动。人物受地点、路程、能力、认知、职责、资产与地区条件约束。模型看到正文楼层/当前变量不等于人物知情；场外人物若因<user>新行为改变目标或行动，必须已有相应认知，或本轮经观察、目击、通讯、传播获得并同步人物.认知/认知来源；没有来源则维持原目标/行动，只推进其自身事务。同场正文未决时停在交互前。活跃异端只有在活动缺失、复核到期、关联事件/所在地区变化或长期未复核时才更新；无触发时沿用既有目标与行动，禁止为了刷新而凭空改策。
Step 5 · 结算玩家影响：只按<user>已确认行为结算探索、势力与重大因果偏移；这是客观世界结算，不得据此让未获知情报的场外人物自动追踪、伏击或改策。必要时重构宏观骨架。
Step 6 · 更新传播：只维护本轮真实变化的传播、货币与历法；结束/过期传播不复活。
Step 7 · 输出差分：先按“历史摘要”规则写摘要，再只输出本轮新增或变化的 WorldResult；无业务变化也要客观说明本轮没有新增世界事实。
【执行检查】
时间/路程可实现；人物知识有来源；同一人物同一时段只在一处；不替<user>行动；不复述已演出琐事；世界不会因<user>停下而暂停。`;
    const BUILTIN_DEFAULT_SELECTED_ENTRIES = [
            "[\"轮回战场V3.6.1\",\"915830\"]",
            "[\"轮回战场V3.6.1\",\"196248\"]",
            "[\"轮回战场V3.6.1\",\"503929\"]",
            "[\"轮回战场V3.6.1\",\"931853\"]",
            "[\"轮回战场V3.6.1\",\"446543\"]",
            "[\"轮回战场V3.6.1\",\"381583\"]",
            "[\"轮回战场V3.6.1\",\"965161\"]",
            "[\"轮回战场V3.6.1\",\"556346\"]",
            "[\"轮回战场V3.6.1\",\"122086\"]",
            "[\"轮回战场V3.6.1\",\"2\"]",
            "[\"轮回战场V3.6.1\",\"562289\"]",
            "[\"轮回战场V3.6.1\",\"937185\"]",
            "[\"轮回战场V3.6.1\",\"612483\"]",
            "[\"轮回战场V3.6.1\",\"544521\"]",
            "[\"轮回战场V3.6.1\",\"454622\"]",
            "[\"轮回战场V3.6.1\",\"671885\"]",
            "[\"轮回战场V3.6.1\",\"345604\"]",
            "[\"轮回战场V3.6.1\",\"558862\"]",
            "[\"轮回战场V3.6.1\",\"78614\"]",
            "[\"轮回战场V3.6.1\",\"229663\"]",
            "[\"轮回战场V3.6.1\",\"985921\"]",
            "[\"轮回战场V3.6.1\",\"625413\"]",
            "[\"轮回战场V3.6.1\",\"8412\"]",
            "[\"轮回战场V3.6.1\",\"559085\"]"
        ];
    const BUILTIN_DEFAULT_WORLD_BOOK_EXCLUSIONS = new Set(['任务与委托系统']);
    const USER_DEFAULT_PROMPT_DOCUMENT_ID='user-default';
    const CORE_WORLD_RULES = `【世界引擎核心约束】
1. 事实：当前变量与已确认剧情 > 明确世界书 > 模型常识；计划不是事实，已确认差异不得被原著常识覆盖。
2. 宏观与时间：只用世界.时间计算本世界进展；宏观顺序保持3~5个阶段级节点，细节只推进到下一宏观边界。待发生/进行中事件必须有可排序时间或明确因果时间；无法确认跨度时只推进一步。
3. 现场与认知：现场群体与环境事实属于势力地区，同一现场事实不得复制进人物。先更新地区现场再决定人物行动；模型看到正文楼层、当前变量和<user>已确认行为，只代表世界事实，不等于任何场外人物知情。人物只能依据在场观察、既有认知、可信通讯/传播链行动；若因<user>新行为改变目标或行动，必须有可追溯的认知来源（已有或本轮写入人物.认知/认知来源），没有来源不得针对<user>即时反应。
4. 人物边界：活跃异端按触发条件复核，未触发时延续既有活动；死亡不可恢复。普通人物只保留真正热记录。不得替<user>建立后台行动。主神任务、晋升试炼、任务状态、副本成就不读取、不更新、不据此驱动世界。普通副本返回主神空间后停止本世界推演；单一世界局部结算不重置世界。
5. 资产：仅限固定地产、大型载具或要塞；药剂、材料、消耗品、钥匙、剧情物品、单兵装备/形态不得写入资产。顶层资产是唯一资产账簿；所属对象为数组，可按已确认场外事实新增、更新、转移或移除；删除保护中的同名资产不得重建，正文/MVU已结算变化不重复结算。
6. 玩家台账：探索只结算<user>实际到达、调查或可靠获知的整体区域；探索度以0/10/30/60/90/100为阶段锚点且无因不回退。势力声望只因<user>真实关系结果变化，同一结果只结算一次，单轮绝对变化≤1000，超过500仅限重大事件。
7. 因果：只在关键人物命运、重大事件结果、势力格局或主线可行性实质改变时记偏移；负值=因果破坏，正值=修复/强化。世界超稳不新增偏移；旧轨道失效时同轮重构宏观顺序。
8. 公开与基础：当前事件公开字段只写已成为现实且可合理感知的信息。货币只随真实流通体系变化，任务世界不用空间币作本地货币；历法只在可靠设定明确时维护。
9. 历史摘要：摘要只写本轮已确认的主体、动作、结果、关键状态变化与持续影响；区分计划、进行与完成，禁止“已建立骨架”“已完成推演”“局势暗涌”等运行话术或空泛概括。`;
    const DEFAULT_MACRO_PROMPT = `【本轮宏观骨架交付】
先完成输入“本轮必须完成的宏观骨架”，再推演近期细节。至少3个可推进宏观节点是合并后的交付底线，进行中+待发生合计。未来规划可以跨越下一宏观边界，实际发生与细节推进不能越界；只输出差分不意味着可以省略尚未建立的骨架。提交前检查事件实体、分类、状态、时间、前因与因果.宏观顺序相互对应。`;
    const DEFAULT_STABILITY_PROMPT_TEMPLATE = `【世界自救 · {{阶段}}】
当前稳定值：{{稳定值}}。{{规则}}
排异必须借世界观内合理载体发生，优先针对造成异常的轮回者及其据点、关系网、资源与行动路径；NPC仍只能依据自身认知和传播链行动，不得凭空全知。法则越破不代表主动排异越弱。`;
    const BUILTIN_DEFAULT_PROMPT_DOCUMENT = {
        id:'builtin-default',
        type:'samsara-world-prompt-document',
        version:21,
        builtin:true,
        name:'默认设置',
        exportedAt:'2026-09-14T13:00:00.000Z',
        createdAt:'2026-09-08T13:09:45.350Z',
        updatedAt:'2026-09-25T08:30:00.000Z',
        settings:{
            corePrompt:CORE_WORLD_RULES,
            macroPrompt:DEFAULT_MACRO_PROMPT,
            stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,
            preset:normalizeEditablePreset(DEFAULT_PRESET),
            contextTurns:3,
            activationMode:'respect_activation',
            selectedEntries:copy(BUILTIN_DEFAULT_SELECTED_ENTRIES)
        }
    };
    const BUILTIN_DEFAULT_PROMPT_VERSION = BUILTIN_DEFAULT_PROMPT_DOCUMENT.version;
    const WORLD_STABILITY_DEFENSE_STAGES = [
        {min:90,title:'因果警觉',rule:'异常线索、调查、误会与既有敌意开始沿合理因果链向轮回者及其直接关系网汇聚；仍以自然事件表现，不形成公开围剿。'},
        {min:80,title:'定向排异',rule:'藏身处、计划、联系人、资源链与行动路径持续受压；压力优先集中到轮回者本人及其直接关系网。'},
        {min:70,title:'因果追猎',rule:'原生强者、组织与主线冲突逐步被因果收束引向轮回者；据点、盟友、补给与撤退路线开始被系统性破坏。'},
        {min:60,title:'全面围剿',rule:'多个原生势力可基于各自合理动机同时追捕、封锁或攻击轮回者；普通安全生活基本结束。'},
        {min:50,title:'世界武器化',rule:'战争、灾害、怪物潮与原生顶级强者可沿因果链压向轮回者活动区；世界开始接受区域毁灭与大规模误伤作为清除代价。'},
        {min:40,title:'猎杀现实',rule:'环境、空间、时间与残存原生规则都可成为猎杀载体；世界接受永久区域毁灭，只求把入侵源一并埋葬。'},
        {min:30,title:'献祭式清除',rule:'世界进入免疫风暴，可牺牲主线人物、城市、国家乃至文明结构换取清除轮回者。'},
        {min:10,title:'终焉围猎',rule:'毁灭性事件持续向轮回者及其停留区域收束；长期停留会把灾难引向当前位置。'},
        {min:1,title:'同归于尽',rule:'世界放弃自保，主动牺牲法则、时间线与现实结构清除轮回者。'},
        {min:0,title:'世界毁灭',rule:'因果链、世界法则、时间线与现实结构均已终止，不再生成常规世界推进。'}
    ];
    function worldStabilityPrompt(stat, template=DEFAULT_STABILITY_PROMPT_TEMPLATE) {
        if(stat?.设置?.世界超稳===true)return '';
        const raw=Number(stat?.世界?.稳定),stable=Number.isFinite(raw)?Math.max(0,Math.min(120,raw)):100;
        if(stable>=100)return '';
        const stage=WORLD_STABILITY_DEFENSE_STAGES.find(item=>stable>=item.min)||WORLD_STABILITY_DEFENSE_STAGES.at(-1);
        const source=String(template??DEFAULT_STABILITY_PROMPT_TEMPLATE);
        if(!source.trim())return '';
        return source.split('{{阶段}}').join(stage.title).split('{{稳定值}}').join(String(stable)).split('{{规则}}').join(stage.rule);
    }
    function splitPresetSegments(value) {
        return String(value||'').split(/\n(?=【)/).filter(Boolean).map(part=>{
            const m=part.match(/^【([^】]+)】\s*\n?/);
            return m?{title:m[1],body:part.slice(m[0].length)}:{title:'',body:part};
        });
    }
    function cleanSegmentTitle(value) {
        return String(value||'').replace(/[【】\r\n]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
    }
    function segmentText(segment) {
        const title=cleanSegmentTitle(segment.title);
        return title?'【'+title+'】\n'+String(segment.body||'').trim():String(segment.body||'').trim();
    }
    function normalizeEditablePreset(value) {
        return splitPresetSegments(value).map(segment=>({
            title:cleanSegmentTitle(segment.title),
            body:String(segment.body||'')
        })).map(segmentText).filter(Boolean).join('\n');
    }
    function ensurePresetStructure(value) {
        const current=splitPresetSegments(value||DEFAULT_PRESET).map(segment=>segment.title==='势力与地区'?{...segment,title:'探索与势力'}:segment);
        const defaults=splitPresetSegments(DEFAULT_PRESET);
        const titles=new Set(current.map(s=>s.title).filter(Boolean));
        for(const segment of defaults)if(segment.title&&!titles.has(segment.title))current.push(segment);
        return current.map(segmentText).filter(Boolean).join('\n');
    }