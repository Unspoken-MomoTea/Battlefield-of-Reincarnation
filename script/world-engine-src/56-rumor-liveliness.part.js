    // 传闻是常驻活跃层：公开传闻保证世界始终有可见动向，后台传播负责其因果来源与人物知情链。
    const RUMOR_LIVELINESS_RULES=`【传闻与传播 · 常驻活跃层】
1. 街头巷议、情报交易、布告与檄文各自展示最近3条；某类为空时本轮补2条。单条约60字，除非影响重大，不围绕<user>。
   可直接追加新名称，程序会在合并后自动滚动淘汰最旧条目，不需要为容量主动提交「操作:移除」。沿用原名称视为刷新该条传闻，并优先保留；仅在传闻本身已失效、撤销或需要明确删除时使用「操作:移除」。
2. 街头巷议随当前地区、说书人/目击者和局势替换1~2条；情报交易有卖家时更新1~2条，购买、付款与消费性删除由MVU按正文结果处理；布告与檄文随当前地区与发布势力替换。
3. 后台传播是人物知情与公开传闻的因果链。新可传播事实建立或推进传播；关联事件变化、传播陈旧或到期时复核范围、受众、内容与引发行动，结束/过期传播不复活。
4. 优先话题：${RUMOR_LIVELINESS_TOPICS.join(' / ')}。`;
    const RUMOR_PRESET_STEP_OLD='Step 6 · 更新传播：只维护本轮真实变化的传播、货币与历法；结束/过期传播不复活。';
    const RUMOR_PRESET_STEP_NEW='Step 6 · 信息传播：传闻是常驻活跃层；三类公开传闻为空时补2条，并随地区、卖家、发布势力与局势替换。新可传播事实建立或推进传播链，关联事件变化、陈旧或到期时复核。';
    const upgradeRumorPreset=value=>String(value||'').includes(RUMOR_PRESET_STEP_OLD)?String(value).replace(RUMOR_PRESET_STEP_OLD,RUMOR_PRESET_STEP_NEW):String(value||'');
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings))BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=upgradeRumorPreset(BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset);
    // 传闻维护、容量与验收算法已迁入 WorldRumorService。
