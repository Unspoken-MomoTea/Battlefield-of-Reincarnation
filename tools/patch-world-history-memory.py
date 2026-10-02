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


def replace_once_any(relatives, old, new, marker=None):
    paths = [(relative, ROOT / relative) for relative in relatives]
    for relative, path in paths:
        if not path.is_file():
            continue
        text = path.read_text(encoding='utf-8')
        if marker and marker in text:
            print(f'[history-memory] already patched: {relative}')
            return False
        if not marker and new in text:
            print(f'[history-memory] already patched: {relative}')
            return False
    for relative, path in paths:
        if not path.is_file():
            continue
        text = path.read_text(encoding='utf-8')
        if old not in text:
            continue
        path.write_text(text.replace(old, new, 1), encoding='utf-8')
        print(f'[history-memory] patched: {relative}')
        return True
    raise RuntimeError('[history-memory] anchor not found in candidates: ' + ', '.join(relatives))


def remove_once(relative, old):
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    if old not in text:
        print(f'[history-memory] already removed: {relative}')
        return False
    path.write_text(text.replace(old, '', 1), encoding='utf-8')
    print(f'[history-memory] removed legacy anchor: {relative}')
    return True


# 1) History anchors are permanent facts. Remove the old normal 200-item deletion cap.
remove_once(
    'src/WorldEngine/core/WorldEngineFoundation.part.js',
    '    const HISTORY_TARGET = 200;\n',
)

replace_once_any(
    [
        'src/WorldEngine/domains/WorldLifecycleService.part.js',
    ],
    """        const historyKeys=Object.keys(state.历史||{});
        if(historyKeys.length>HISTORY_TARGET)for(const key of historyKeys.slice(0,historyKeys.length-HISTORY_TARGET))delete state.历史[key];
        return archived;""",
    """        // 历史锚点是永久已确认事实，不再按固定数量删除；旧事实由分层历史总结退出热上下文。
        return archived;""",
    marker='历史锚点是永久已确认事实'
)

replace_once_any(
    [
        'src/WorldEngine/domains/WorldStateFactory.part.js',
    ],
    "return { 版本:4, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{} };",
    "return { 版本:5, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 历史总结:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{} };",
    marker='版本:5'
)

replace_once_any(
    [
        'src/WorldEngine/domains/WorldStateNormalizer.part.js',
    ],
    """        state.版本=Math.max(4,Number(state.版本)||0);
        for(const category of Object.keys(RECORDS)){""",
    """        state.版本=Math.max(5,Number(state.版本)||0);
        // v5：程序托管的可逆历史总结树；不属于模型可写 RECORDS。
        if(!plain(state.历史总结))state.历史总结={};
        for(const category of Object.keys(RECORDS)){""",
    marker='state.版本=Math.max(5,Number(state.版本)||0);'
)

# 2) Long-term memory setting is local UI config, default off for prose AI.
replace_once(
    'src/WorldEngine/core/WorldEngineConfigService.part.js',
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
    'src/WorldEngine/core/WorldEngineConfigService.part.js',
    """            if(!['standard','large','xlarge'].includes(this.config.fontScale))this.config.fontScale='standard';
            this.config.dedicatedApi=this.normalizeDedicatedApi(this.config.dedicatedApi);""",
    """            if(!['standard','large','xlarge'].includes(this.config.fontScale))this.config.fontScale='standard';
            this.config.sendHistoryToProse=this.config.sendHistoryToProse===true;
            this.config.dedicatedApi=this.normalizeDedicatedApi(this.config.dedicatedApi);""",
    marker="config.sendHistoryToProse=config.sendHistoryToProse===true;"
)

replace_once_any(
    [
        'src/WorldEngine/domains/WorldRequestBuilder.part.js',
        'src/WorldEngine/core/SamsaraWorldEngine.part.js',
    ],
    "当前变量:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期历史与近期因果偏移。资产通过WorldResult.资产与同一顶层账簿双向同步；旧历史/旧偏移仍可留在MVU冷存档但默认不进入本轮上下文。未提供的任务/商城/纯结算数据不属于本引擎职责。',",
    "当前变量:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期因果偏移，以及“近期原始锚点 + 更早根总结”组成的分层长期历史记忆。原始历史永久留在MVU，已被上层总结收纳的旧节点不再重复进入热上下文。资产通过WorldResult.资产与同一顶层账簿双向同步；未提供的任务/商城/纯结算数据不属于本引擎职责。',",
    marker='分层长期历史记忆'
)

replace_once_any(
    [
        'src/WorldEngine/domains/WorldAutoProgressController.part.js',
    ],
    "const maps=['事件','人物','势力地区','历史','传播'];",
    "const maps=['事件','人物','势力地区','历史','历史总结','传播'];",
    marker="'历史','历史总结','传播'"
)

# 3) Settings UI + bounded history inspector. Do not render thousands of permanent raw anchors.
replace_once_any(
    [
        'src/WorldEngine/ui/views/WorldHistoryView.part.js',
    ],
    """                html+=section('历史锚点',entries(state.历史).reverse().map(([n,r])=>'<article class=\"we-card\"><div class=\"we-meta\">'+text(r.时间)+'</div><h3>'+text(n)+'</h3><p>'+text(r.事实)+'</p>'+fields({关联事件:r.关联事件})+'</article>').join('')||empty('尚无已确认的历史锚点'));""",
    """                const historyMemory=projectWorldHistoryMemory(state);
                html+=section('长期历史总结',(historyMemory.长期总结||[]).slice().reverse().map(r=>'<article class=\"we-card\"><div class=\"we-card-top\"><h3>'+text(r.名称)+'</h3>'+pill('L'+text(r.层级),'dim')+'</div><div class=\"we-meta\">'+text([r.起始时间,r.结束时间].filter(Boolean).join(' → '))+'</div><p>'+text(r.摘要)+'</p></article>').join('')||empty('尚无长期历史总结','历史锚点积累后会自动分层压缩；底层事实仍保留在MVU。'),(historyMemory.统计?.总结节点总数||0)+' 个总结节点 · 原始历史不删除');
                html+=section('近期历史锚点',entries(historyMemory.近期锚点).reverse().map(([n,r])=>'<article class=\"we-card\"><div class=\"we-meta\">'+text(r.时间)+'</div><h3>'+text(n)+'</h3><p>'+text(r.事实)+'</p>'+fields({关联事件:r.关联事件})+'</article>').join('')||empty('尚无未收纳的近期历史锚点'),(historyMemory.统计?.原始锚点总数||0)+' 条原始历史 · 仅展示当前热根节点');""",
    marker="section('长期历史总结'"
)

replace_once_any(
    [
        'src/WorldEngine/ui/views/WorldSettingsView.part.js',
    ],
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

# 6) Documentation is maintained as current-state docs under src/WorldEngine/.
# Historical migration prose is intentionally not patched back into the concise integration guide.

print('[history-memory] done')
