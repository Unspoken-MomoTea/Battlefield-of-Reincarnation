from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative, old, new, marker=None):
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    if marker and marker in text:
        print(f'[history-memory] already patched: {relative}')
        return False
    if not marker and new in text:
        print(f'[history-memory] already patched: {relative}')
        return False
    if old not in text:
        raise RuntimeError(f'[history-memory] anchor not found: {relative}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'[history-memory] patched: {relative}')
    return True


# 1) History anchors are permanent facts. Remove the old normal 200-item deletion cap.
replace_once(
    'script/world-engine-src/00-foundation-prompt.part.js',
    '    const HISTORY_TARGET = 200;\n',
    '',
    marker='const HISTORY_MEMORY_L0_BATCH='
)

replace_once(
    'script/world-engine-src/10-world-state.part.js',
    """        const historyKeys=Object.keys(state.历史||{});
        if(historyKeys.length>HISTORY_TARGET)for(const key of historyKeys.slice(0,historyKeys.length-HISTORY_TARGET))delete state.历史[key];
        return archived;""",
    """        // 历史锚点是永久已确认事实，不再按固定数量删除；旧事实由分层历史总结退出热上下文。
        return archived;""",
    marker='历史锚点是永久已确认事实'
)

replace_once(
    'script/world-engine-src/10-world-state.part.js',
    "return { 版本:4, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{} };",
    "return { 版本:5, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 历史总结:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{} };",
    marker='版本:5, 已处理楼层'
)

replace_once(
    'script/world-engine-src/10-world-state.part.js',
    """        state.版本=Math.max(4,Number(state.版本)||0);
        for(const category of Object.keys(RECORDS)){""",
    """        state.版本=Math.max(5,Number(state.版本)||0);
        // v5：程序托管的可逆历史总结树；不属于模型可写 RECORDS。
        if(!plain(state.历史总结))state.历史总结={};
        for(const category of Object.keys(RECORDS)){""",
    marker='v5：程序托管的可逆历史总结树'
)

# 2) Long-term memory setting is local UI config, default off for prose AI.
replace_once(
    'script/world-engine-src/40-engine-runtime.part.js',
    """                promptDocuments:[],
                fontScale:'standard',
                dedicatedApi:{enabled:false,apiUrl:'',apiKey:'',model:'',apiPresets:[],fetchedModels:[]}""",
    """                promptDocuments:[],
                fontScale:'standard',
                // 仅控制是否把压缩后的长期历史发送给正文AI；世界推进自身始终读取。
                sendHistoryToProse:false,
                dedicatedApi:{enabled:false,apiUrl:'',apiKey:'',model:'',apiPresets:[],fetchedModels:[]}""",
    marker='sendHistoryToProse:false'
)

replace_once(
    'script/world-engine-src/40-engine-runtime.part.js',
    """            if(!['standard','large','xlarge'].includes(this.config.fontScale))this.config.fontScale='standard';
            this.config.dedicatedApi=this.normalizeDedicatedApi(this.config.dedicatedApi);""",
    """            if(!['standard','large','xlarge'].includes(this.config.fontScale))this.config.fontScale='standard';
            this.config.sendHistoryToProse=this.config.sendHistoryToProse===true;
            this.config.dedicatedApi=this.normalizeDedicatedApi(this.config.dedicatedApi);""",
    marker="this.config.sendHistoryToProse=this.config.sendHistoryToProse===true;"
)

replace_once(
    'script/world-engine-src/40-engine-runtime.part.js',
    "当前变量:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期历史与近期因果偏移。资产通过WorldResult.资产与同一顶层账簿双向同步；旧历史/旧偏移仍可留在MVU冷存档但默认不进入本轮上下文。未提供的任务/商城/纯结算数据不属于本引擎职责。',",
    "当前变量:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期因果偏移，以及“近期原始锚点 + 更早根总结”组成的分层长期历史记忆。原始历史永久留在MVU，已被上层总结收纳的旧节点不再重复进入热上下文。资产通过WorldResult.资产与同一顶层账簿双向同步；未提供的任务/商城/纯结算数据不属于本引擎职责。',",
    marker='分层长期历史记忆'
)

replace_once(
    'script/world-engine-src/59-auto-progress.part.js',
    "const maps=['事件','人物','势力地区','历史','传播'];",
    "const maps=['事件','人物','势力地区','历史','历史总结','传播'];",
    marker="'历史','历史总结','传播'"
)

# 3) Settings UI + bounded history inspector. Do not render thousands of permanent raw anchors.
replace_once(
    'script/world-engine-src/50-engine-ui.part.js',
    """                html+=section('历史锚点',entries(state.历史).reverse().map(([n,r])=>'<article class=\"we-card\"><div class=\"we-meta\">'+text(r.时间)+'</div><h3>'+text(n)+'</h3><p>'+text(r.事实)+'</p>'+fields({关联事件:r.关联事件})+'</article>').join('')||empty('尚无已确认的历史锚点'));""",
    """                const historyMemory=projectWorldHistoryMemory(state);
                html+=section('长期历史总结',(historyMemory.长期总结||[]).slice().reverse().map(r=>'<article class=\"we-card\"><div class=\"we-card-top\"><h3>'+text(r.名称)+'</h3>'+pill('L'+text(r.层级),'dim')+'</div><div class=\"we-meta\">'+text([r.起始时间,r.结束时间].filter(Boolean).join(' → '))+'</div><p>'+text(r.摘要)+'</p></article>').join('')||empty('尚无长期历史总结','历史锚点积累后会自动分层压缩；底层事实仍保留在MVU。'),(historyMemory.统计?.总结节点总数||0)+' 个总结节点 · 原始历史不删除');
                html+=section('近期历史锚点',entries(historyMemory.近期锚点).reverse().map(([n,r])=>'<article class=\"we-card\"><div class=\"we-meta\">'+text(r.时间)+'</div><h3>'+text(n)+'</h3><p>'+text(r.事实)+'</p>'+fields({关联事件:r.关联事件})+'</article>').join('')||empty('尚无未收纳的近期历史锚点'),(historyMemory.统计?.原始锚点总数||0)+' 条原始历史 · 仅展示当前热根节点');""",
    marker="section('长期历史总结'"
)

replace_once(
    'script/world-engine-src/50-engine-ui.part.js',
    """                html+=section('模型接口',
""",
    """                const historyToProse=this.config.sendHistoryToProse===true;
                html+=section('历史记忆','<div class=\"we-setting-row\"><div class=\"we-setting-copy\"><b>向正文提供历史记忆</b><small>开启后，正文AI额外读取“近期原始锚点 + 更早长期总结”；关闭只影响正文，世界推进自身仍始终使用完整的分层历史脉络。</small></div><div class=\"we-setting-actions\"><button class=\"we-setting-btn we-switch '+(historyToProse?'on':'')+'\" data-action=\"history-prose-toggle\"><span>'+text(historyToProse?'已启用':'未启用')+'</span><span class=\"we-switch-track\"><i></i></span></button></div></div>','默认关闭 · 原始历史事实不会因关闭而删除');
                html+=section('模型接口',
""",
    marker='向正文提供历史记忆'
)

# 4) MVU schema persists program-owned summary tree instead of stripping it after writeback.
replace_once(
    'script/ZOD脚本.js',
    """            版本: safeNum(4), 已处理楼层: safeStr(''), 已处理时间: safeStr(''),""",
    """            版本: safeNum(5), 已处理楼层: safeStr(''), 已处理时间: safeStr(''),""",
    marker='版本: safeNum(5)'
)
replace_once(
    'script/ZOD脚本.js',
    """            历史: z.record(z.string(), z.any()).prefault({}),
            传播: z.record(z.string(), z.any()).prefault({}),""",
    """            历史: z.record(z.string(), z.any()).prefault({}),
            // 程序托管的可逆历史总结树；正文只读取经过开关控制的根节点投影。
            历史总结: z.record(z.string(), z.any()).prefault({}),
            传播: z.record(z.string(), z.any()).prefault({}),""",
    marker='历史总结: z.record(z.string(), z.any()).prefault({})'
)

# 5) Prose projection reads the runtime-local switch, never exposes full backend.
replace_once(
    'World Book/[variables]当前变量.txt',
    """const isWorldEngineEnabled = (() => {
  try {
    const host = (typeof window !== 'undefined' && window.parent && window.parent !== window) ? window.parent : (typeof window !== 'undefined' ? window : null);
    const engine = host?.Samsara?.worldEngine;
    return typeof engine?.isEnabled === 'function' ? engine.isEnabled() : engine?.config?.enabled === true;
  } catch (_) { return false; }
})();""",
    """const worldEngine = (() => {
  try {
    const host = (typeof window !== 'undefined' && window.parent && window.parent !== window) ? window.parent : (typeof window !== 'undefined' ? window : null);
    return host?.Samsara?.worldEngine || null;
  } catch (_) { return null; }
})();
const isWorldEngineEnabled = typeof worldEngine?.isEnabled === 'function'
  ? worldEngine.isEnabled()
  : worldEngine?.config?.enabled === true;""",
    marker='const worldEngine = (() => {'
)

replace_once(
    'World Book/[variables]当前变量.txt',
    """readonly.世界 = {
  稳定: _.get(data, '世界.稳定', 100)
};

// 2. 角色只读信息""",
    """readonly.世界 = {
  稳定: _.get(data, '世界.稳定', 100)
};
// 长期历史只通过世界推进程序生成的根节点投影进入正文；完整后台与原始历史树仍保持隐藏。
if (isWorldEngineEnabled && worldEngine?.config?.sendHistoryToProse === true && !_.get(data, '系统状态.是否在主神空间', false)) {
  try {
    const historyMemory = typeof worldEngine?.proseHistoryMemory === 'function' ? worldEngine.proseHistoryMemory(data) : null;
    if (historyMemory && (Number(_.get(historyMemory, '统计.原始锚点总数', 0)) > 0 || Number(_.get(historyMemory, '统计.总结节点总数', 0)) > 0)) {
      readonly.世界.历史记忆 = _.cloneDeep(historyMemory);
    }
  } catch (_) { /* 世界推进脚本尚未完成初始化时静默跳过，不暴露后台。 */ }
}

// 2. 角色只读信息""",
    marker='readonly.世界.历史记忆 = _.cloneDeep(historyMemory);'
)

# 6) Documentation: history is now reversible, hierarchical, and has no normal 200-anchor deletion cap.
replace_once(
    'script/世界引擎接入说明.md',
    """`后台.事件` 现在采用生命周期回收，而不是等堆到约180条才清理。无人物/地区/传播/后续事件引用的“已完成/已取消”事件，在可比较世界时间下结束超过24小时后会压缩为历史锚点；作品内时间无法比较时，最多保留最近8条无引用结束事件。约180条仅保留为异常旧存档的硬兜底。历史锚点在MVU中仍可保留约200条，但副API热上下文默认只读取最近24条，因此冷历史不会长期占用提示词。模型本身仍不能直接删除普通事件或改写历史，清理由引擎在事务内完成。""",
    """`后台.事件` 采用生命周期回收，而不是等堆到约180条才清理。无人物/地区/传播/后续事件引用的“已完成/已取消”事件，在可比较世界时间下结束超过24小时后会压缩为历史锚点；作品内时间无法比较时，最多保留最近8条无引用结束事件。约180条仅保留为异常旧存档的事件硬兜底。历史锚点本身不再有约200条的正常删除上限：它们是永久已确认事实，持续留在MVU中。

历史上下文改为可逆的分层“历史记忆树”。L0 未收纳锚点达到18条时，程序把最旧12条交给副API压成一个L1总结并保留最近6条原始细节；6个未收纳L1继续压成L2，L2及更高层每3个根节点继续向上压缩，没有固定最高层。上层总结只记录 `子项` 引用，不删除任何底层锚点或旧总结，因此可以一直压缩、一直追溯。世界推进每轮只读取“未收纳的近期原始锚点 + 未被更高层收纳的根总结”；长期游戏的热上下文随历史长度近似对数增长，而不是把几百/几千条旧事实重复发送。历史总结请求显式携带各节点原有时间锚点，并禁止补写未来、隐藏真相或不存在的日期。""",
    marker='历史上下文改为可逆的分层“历史记忆树”'
)

replace_once(
    'script/世界引擎接入说明.md',
    """世界引擎保留独立「设置」页，但不再维护独立色调。面板直接读取主神终端共享主题键 `samsara_theme_v2`，因此暗夜、绯红、靛蓝、羊皮、樱白、抹茶均跟随状态栏当前选择；旧版世界引擎 `tone` 配置会自动清理。世界引擎仅保留自己的字号设置：默认「标准」为16px级别（正文约14px、辅助字不低于12px），「大字」为18px级别（正文约16px），「特大」为20px级别（正文约17px）；标题、正文、卡片说明、表单、按钮、标签、区域档案都会一起缩放。
""",
    """世界引擎保留独立「设置」页，但不再维护独立色调。面板直接读取主神终端共享主题键 `samsara_theme_v2`，因此暗夜、绯红、靛蓝、羊皮、樱白、抹茶均跟随状态栏当前选择；旧版世界引擎 `tone` 配置会自动清理。世界引擎仅保留自己的字号设置：默认「标准」为16px级别（正文约14px、辅助字不低于12px），「大字」为18px级别（正文约16px），「特大」为20px级别（正文约17px）；标题、正文、卡片说明、表单、按钮、标签、区域档案都会一起缩放。

设置页新增「向正文提供历史记忆」，默认关闭。开启后 `[variables]当前变量` 只向正文AI追加经过压缩的历史根视图（近期原始锚点 + 更早长期总结），不会暴露 `世界.后台`、历史树子节点或主持人私密字段；关闭只影响正文AI，世界推进副API始终读取分层历史记忆，长期连续性不会因此关闭。
""",
    marker='设置页新增「向正文提供历史记忆」'
)

print('[history-memory] done')
