    // 世界时间段别名兼容：自然语言同义词先归一化，再交给统一时间比较器。
    // 只处理明确属于同一日内时段的别名；“午夜”等跨日语义不在这里猜测。
    const WORLD_DAYPART_ALIASES=Object.freeze({
        '清早':'清晨',
        '早上':'早晨',
        '黄昏':'傍晚',
        '夜晚':'晚上',
        '夜间':'晚上',
        '夜里':'晚上',
        '晚间':'晚上'
    });
    function normalizeWorldDaypartAlias(value) {
        let source=String(value||'');
        for(const [alias,canonical] of Object.entries(WORLD_DAYPART_ALIASES))source=source.replaceAll(alias,canonical);
        return source;
    }
    const worldDateKeyBeforeDaypartAliases=worldDateKey;
    worldDateKey=function(value) {
        return worldDateKeyBeforeDaypartAliases(normalizeWorldDaypartAlias(value));
    };
