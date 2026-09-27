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
