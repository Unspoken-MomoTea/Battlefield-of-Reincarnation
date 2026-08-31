from pathlib import Path


def read_text(path):
    raw = Path(path).read_bytes().decode('utf-8')
    nl = '\r\n' if '\r\n' in raw else '\n'
    return raw.replace('\r\n', '\n'), nl


def write_text(path, text, nl):
    out = text if nl == '\n' else text.replace('\n', '\r\n')
    Path(path).write_bytes(out.encode('utf-8'))


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return text.replace(old, new, 1)


# 1) 状态栏：世界稳定度进度条 + 异端存活数 + 暂时隐藏异端详情
status_path = 'script/悬浮球状态栏.js'
status, status_nl = read_text(status_path)

css_anchor = "        .sam-alien-list { display:flex; flex-direction:column; gap:6px; }\n"
css_insert = """        /* 世界稳定度：0~120，100为正常基准线。 */
        .sam-world-stability { padding:8px 0 5px; }
        .sam-world-stability-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:5px; font-size:11px; }
        .sam-world-stability-head .k { color:var(--sam-sub); }
        .sam-world-stability-head .v { color:var(--sam-text); font-weight:900; font-size:12px; }
        .sam-world-stability-track { position:relative; height:12px; border-radius:7px; overflow:hidden; background:rgba(0,0,0,0.3); border:1px solid rgba(143,159,255,0.18); box-shadow:inset 0 1px 4px rgba(0,0,0,0.42); }
        .sam-world-stability-fill { height:100%; min-width:0; border-radius:6px; background:linear-gradient(90deg, var(--sam-hp), var(--sam-accent)); box-shadow:0 0 9px var(--sam-accent); transition:width .25s ease; }
        .sam-world-stability-fill.over { background:linear-gradient(90deg, var(--sam-accent), var(--sam-thp)); box-shadow:0 0 10px var(--sam-thp); }
        .sam-world-stability-mark100 { position:absolute; left:83.333333%; top:-2px; bottom:-2px; width:2px; background:rgba(255,255,255,0.82); box-shadow:0 0 5px rgba(255,255,255,0.65); pointer-events:none; }
        .sam-world-stability-scale { position:relative; height:14px; margin-top:2px; color:var(--sam-sub); font-size:9px; line-height:14px; }
        .sam-world-stability-scale .s0 { position:absolute; left:0; }
        .sam-world-stability-scale .s100 { position:absolute; left:83.333333%; transform:translateX(-50%); color:var(--sam-text); }
        .sam-world-stability-scale .s120 { position:absolute; right:0; }
""" + css_anchor
status = replace_once(status, css_anchor, css_insert, 'world stability css')

stable_field = "            {k:'稳定', path:'世界.稳定', type:'number', readonly:true},\n"
status = replace_once(status, stable_field, '', 'old stability row')

world_anchor = """        html += secBlock('🌍 世界介绍', introHtml);
        if (!isSingleWorld && !isInHub && alienNames.length) {
"""
world_new = """        var stabilityValue = Math.max(0, Math.min(120, safeNum(w.稳定, 100)));
        var stabilityPct = Math.max(0, Math.min(100, (stabilityValue / 120) * 100));
        var stabilityOverClass = stabilityValue > 100 ? ' over' : '';
        introHtml += '<div class="sam-world-stability">'
            + '<div class="sam-world-stability-head"><span class="k">稳定度</span><span class="v">'+esc(stabilityValue)+'</span></div>'
            + '<div class="sam-world-stability-track"><div class="sam-world-stability-fill'+stabilityOverClass+'" style="width:'+stabilityPct+'%"></div><span class="sam-world-stability-mark100"></span></div>'
            + '<div class="sam-world-stability-scale"><span class="s0">0</span><span class="s100">100</span><span class="s120">120</span></div>'
            + '</div>';
        if (!isSingleWorld && !isInHub) {
            introHtml += '<div class="sam-row"><span class="k">异端存活数量</span><span class="v"><span class="sam-edit-readonly">'+alienAliveCount+'</span></span></div>';
        }
        html += secBlock('🌍 世界介绍', introHtml);
        // 异端详情暂时对玩家隐藏；保留完整折叠栏代码，后续只需将此开关改为 true 即可恢复。
        var SHOW_ALIEN_ROSTER_DETAILS = false;
        if (SHOW_ALIEN_ROSTER_DETAILS && !isSingleWorld && !isInHub && alienNames.length) {
"""
status = replace_once(status, world_anchor, world_new, 'world intro block')

old_status = "                var status = ['未登场', '活跃', '死亡'].indexOf(alien.状态) >= 0 ? alien.状态 : '未登场';\n                var stateClass = status === '活跃' ? 'active' : (status === '死亡' ? 'dead' : 'waiting');\n"
new_status = "                var status = safeStr(alien.状态) === '死亡' ? '死亡' : '活跃';\n                var stateClass = status === '死亡' ? 'dead' : 'active';\n"
status = replace_once(status, old_status, new_status, 'alien status render')

write_text(status_path, status, status_nl)


# 2) 变量更新规则：异端状态只允许 活跃 / 死亡
rules_path = 'World Book/[mvu_update]变量更新规则.txt'
rules, rules_nl = read_text(rules_path)
rules = replace_once(
    rules,
    "              状态: '未登场'|'活跃'|'死亡'\n",
    "              状态: '活跃'|'死亡'\n",
    'alien status schema'
)
rules = replace_once(
    rules,
    "        - 异端首次实际登场时，精确 replace 状态【未登场】→【活跃】，并依照来源与经历生成完整NPC资料写入[关系列表]\n        - 逃离战场、撤退或隐藏不改变【活跃】；仅确认死亡时 replace 为【死亡】\n",
    "        - 名单初始化后默认【活跃】；【活跃】仅表示该异端仍存活且处于追踪中，不代表已在当前场景登场\n        - 异端实际登场时依照来源与经历生成完整NPC资料写入[关系列表]；逃离、撤退或隐藏仍保持【活跃】\n        - 仅确认死亡时 replace 为【死亡】\n",
    'alien status rules'
)
write_text(rules_path, rules, rules_nl)


# 3) 主神任务美化：新名单默认活跃；旧未登场兼容迁移为活跃
main_path = 'Regular/主神任务美化.html'
main, main_nl = read_text(main_path)
main = replace_once(
    main,
    "                    状态: ['未登场', '活跃', '死亡'].includes(oldStatus) ? oldStatus : '未登场'\n",
    "                    状态: oldStatus === '死亡' ? '死亡' : '活跃'\n",
    'god quest alien initialization'
)
write_text(main_path, main, main_nl)


# 4) 试炼任务美化：新名单默认活跃
trial_path = 'Regular/试炼任务美化.html'
trial, trial_nl = read_text(trial_path)
trial = replace_once(
    trial,
    "            q.aliens.forEach(function(a){ roster[a.name]={来源:a.source,经历:a.experience,阵营:a.faction,职业:a.job,层级:a.rank,状态:'未登场'}; });\n",
    "            q.aliens.forEach(function(a){ roster[a.name]={来源:a.source,经历:a.experience,阵营:a.faction,职业:a.job,层级:a.rank,状态:'活跃'}; });\n",
    'trial alien initialization'
)
write_text(trial_path, trial, trial_nl)


# 5) 旧存档兼容：下一次变量更新时把非死亡异端状态统一为活跃
zod_path = 'script/ZOD脚本.js'
zod, zod_nl = read_text(zod_path)
zod = replace_once(
    zod,
    "            cleanupLegacyReinforcementFields(statData);\n",
    "            cleanupLegacyReinforcementFields(statData);\n            normalizeAlienRosterStatuses(statData);\n",
    'alien migration call'
)
zod_anchor = "    /**\n     * 数据守卫：回滚被 AI 篡改的只读字段 + 规范化新增装备\n"
zod_helper = """    /** 兼容旧存档：异端状态已收敛为【活跃|死亡】，其余旧值统一视为活跃。 */
    function normalizeAlienRosterStatuses(statData) {
        const roster = statData && statData.世界 && statData.世界.异端雷达 && statData.世界.异端雷达.名单;
        if (!roster || typeof roster !== 'object' || Array.isArray(roster)) return;
        Object.values(roster).forEach(alien => {
            if (!alien || typeof alien !== 'object') return;
            alien.状态 = alien.状态 === '死亡' ? '死亡' : '活跃';
        });
    }

""" + zod_anchor
zod = replace_once(zod, zod_anchor, zod_helper, 'alien migration helper')
write_text(zod_path, zod, zod_nl)


# 语义回归检查
checks = {
    status_path: [
        'sam-world-stability-track',
        'sam-world-stability-mark100',
        '异端存活数量',
        'var SHOW_ALIEN_ROSTER_DETAILS = false;',
        "var status = safeStr(alien.状态) === '死亡' ? '死亡' : '活跃';",
    ],
    rules_path: [
        "状态: '活跃'|'死亡'",
        '【活跃】仅表示该异端仍存活且处于追踪中，不代表已在当前场景登场',
    ],
    main_path: ["状态: oldStatus === '死亡' ? '死亡' : '活跃'"],
    trial_path: ["状态:'活跃'"],
    zod_path: ['normalizeAlienRosterStatuses(statData);'],
}
for path, needles in checks.items():
    text = Path(path).read_text(encoding='utf-8')
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'missing semantic marker in {path}: {needle}')

if "{k:'稳定', path:'世界.稳定'" in Path(status_path).read_text(encoding='utf-8'):
    raise SystemExit('old plain stability row still present')
if "状态: '未登场'|'活跃'|'死亡'" in Path(rules_path).read_text(encoding='utf-8'):
    raise SystemExit('old three-state alien schema still present')

print('world panel + alien visibility/status patch: OK')
