from pathlib import Path
import re

status_path = Path('script/悬浮球状态栏.js')
baseline_path = Path('dist/V20260826/悬浮球状态栏.js')
rules_path = Path('World Book/⚙️实体生成规则.txt')
calc_path = Path('script/ZOD脚本.js')
vars_path = Path('World Book/[variables]当前变量.txt')


def read_raw(path: Path) -> str:
    return path.read_bytes().decode('utf-8-sig')


def write_raw(path: Path, text: str) -> None:
    path.write_bytes(text.encode('utf-8'))


def replace_range(cur: str, base: str, start_token: str, end_token: str, label: str) -> str:
    try:
        a = cur.index(start_token)
        b = cur.index(end_token, a)
        x = base.index(start_token)
        y = base.index(end_token, x)
    except ValueError as exc:
        raise SystemExit(f'无法定位 {label} 回退边界: {exc}')
    return cur[:a] + base[x:y] + cur[b:]


current = read_raw(status_path)
baseline = read_raw(baseline_path)

# 商城核心定向回退到 2026-08-26：该版本已经有多角色商城、形态商品、血统融合，
# 但还没有实体顶层「强化:+N」字段与基于该字段的商城资格锁。
current = replace_range(
    current,
    baseline,
    '/* ===== 32c2. 商城市场区:',
    '/* ===== 32d. 形态激活',
    '商城 32c2~32d',
)

# 卡片显示也恢复到字段引入前，不再读取实体顶层强化计数。
current = replace_range(
    current,
    baseline,
    '    function samDelBtn(',
    '    function fcRow(',
    '实体卡片 fullCard',
)

# 清理强化字段引入后，为血统融合额外增加的 AI 视图过滤器。
current = re.sub(
    r'(?ms)^\s*function fusionAiView\(source\) \{.*?^\s*return view;\s*\r?\n\s*\}\s*\r?\n',
    '',
    current,
    count=1,
)
current = current.replace('JSON.stringify(fusionAiView(a))', 'JSON.stringify(a)')
current = current.replace('JSON.stringify(fusionAiView(b))', 'JSON.stringify(b)')
current = re.sub(r'^[^\r\n]*强化次数仅供商城AI读取[^\r\n]*(?:\r?\n)?', '', current, flags=re.M)

# fullCard 第六参数只用于强化计数显示。
current = re.sub(r',\s*([A-Za-z_$][\w$]*)\.强化\)', ')', current)

# NPC 通用详情恢复：不把「强化」视作现行结构字段，也不拼接 +N 标题。
current = current.replace("['隐藏真相','真实内幕','真属性','强化']", "['隐藏真相','真实内幕','真属性']")
current = current.replace("['隐藏真相', '真实内幕', '真属性', '强化']", "['隐藏真相', '真实内幕', '真属性']")
current = re.sub(
    r"(?ms)^\s*var subLabel = k;\s*\r?\n\s*var parentKey = ancestors\.length \? ancestors\[ancestors\.length - 1\] : '';\s*\r?\n\s*if \(\['血统','技能','装备','形态库'\]\.indexOf\(parentKey\) >= 0\) \{.*?^\s*\}\s*\r?\n\s*subBlocks \+= detailSub\(subLabel,",
    "                        subBlocks += detailSub(k,",
    current,
    count=1,
)
current = re.sub(r'^[^\r\n]*\.sam-fc-reinforce[^\r\n]*(?:\r?\n)?', '', current, flags=re.M)

# 程序强化锁/计数字段不得残留；自然语言中的「强化」概念仍属于旧商城升级方案的一部分。
forbidden = [
    'shopReinforcementValue',
    'shopInspectUpgrade',
    'shopFilterRawUpgrades',
    '_source_reinforcement',
    '_result_reinforcement',
    'samReinforcementLabel',
    '.强化',
]
leftovers = [token for token in forbidden if token in current]
if leftovers:
    raise SystemExit('商城强化程序残留未清理: ' + ', '.join(leftovers))

required_prompt = [
    '3. 升级重铸机制:',
    '每个阶位最多完成3次：强化Ⅰ → 强化Ⅱ → 强化Ⅲ。',
    '商城可以提前展示未解锁的跨阶方案，但不得在未满足前置时购买或结算。',
    '同阶强化保留当前正式名称，仅允许追加“·强化Ⅰ/Ⅱ/Ⅲ”',
]
missing = [text for text in required_prompt if text not in current]
if missing:
    raise SystemExit('旧商城提示词未完整恢复: ' + ' | '.join(missing))

write_raw(status_path, current)

# 品质锚定：只管实体自身品质与来源/场景产出上限，不得再外推成原始属性硬上限。
rules = read_raw(rules_path)
old_rule_crlf = (
    '品质锚定\r\n'
    '    可选值: [F, E, D, C, B, A, S, SS, SSS]\r\n'
    '    约束: 必须严格继承来源品质，严禁超阶生成'
)
old_rule_lf = old_rule_crlf.replace('\r\n', '\n')
old_rule = old_rule_crlf if old_rule_crlf in rules else old_rule_lf
if old_rule not in rules:
    raise SystemExit('未找到待替换的「品质锚定」原文')
nl = '\r\n' if '\r\n' in old_rule else '\n'
new_rule = nl.join([
    '品质锚定',
    '    可选值: [F, E, D, C, B, A, S, SS, SSS]',
    '    约束:',
    '      - 本字段仅约束【实体自身的品质】以及其来源/场景允许产出的品质档位或上限，禁止无依据跨阶生成实体。',
    '      - “严禁超阶生成”不得解释为“实体内部每项原始属性的品质标记不得高于实体品质”；原始属性按对应属性与数值规则独立生成，不受本条做同名档位硬截断。',
    '      - 示例: Ⅰ阶世界不得无规则依据直接产出C级、S级实体；但F级装备、血统等实体，并不因此被强制要求所有原始属性都只能填写F或以下。',
])
rules = rules.replace(old_rule, new_rule, 1)
write_raw(rules_path, rules)

# 旧存档迁移：真正删除角色实体顶层的历史「强化」字段。
# 只清理 血统/技能/装备/形态库 条目顶层，不碰效果对象中可能正常存在的同名词条。
calc = read_raw(calc_path)
if 'function cleanupLegacyReinforcementFields' not in calc:
    call_anchor_lf = '            // ★ 先回滚受保护字段，再执行后续计算\n            guardProtectedFields(statData, statDataBefore);\n'
    call_anchor_crlf = call_anchor_lf.replace('\n', '\r\n')
    call_anchor = call_anchor_crlf if call_anchor_crlf in calc else call_anchor_lf
    if call_anchor not in calc:
        raise SystemExit('未找到 ZOD onUpdateData 插入点')
    call_nl = '\r\n' if '\r\n' in call_anchor else '\n'
    call_text = call_anchor + call_nl.join([
        '',
        '            // 兼容清理：商城已撤销强化计数字段，旧存档中的实体顶层「强化」在更新时直接删除。',
        '            cleanupLegacyReinforcementFields(statData);',
    ]) + call_nl
    calc = calc.replace(call_anchor, call_text, 1)

    func_anchor_lf = '    /**\n     * 数据守卫：回滚被 AI 篡改的只读字段 + 规范化新增装备\n'
    func_anchor_crlf = func_anchor_lf.replace('\n', '\r\n')
    func_anchor = func_anchor_crlf if func_anchor_crlf in calc else func_anchor_lf
    if func_anchor not in calc:
        raise SystemExit('未找到 ZOD 清理函数插入点')
    fn_nl = '\r\n' if '\r\n' in func_anchor else '\n'
    cleanup_fn = fn_nl.join([
        '    /** 删除旧商城强化系统遗留的实体顶层「强化」字段。 */',
        '    function cleanupLegacyReinforcementFields(statData) {',
        '        const cleanCharacter = (char) => {',
        "            if (!char || typeof char !== 'object') return;",
        "            ['血统', '技能', '装备', '形态库'].forEach(groupKey => {",
        '                const group = char[groupKey];',
        "                if (!group || typeof group !== 'object') return;",
        '                Object.values(group).forEach(entry => {',
        "                    if (entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, '强化')) {",
        '                        delete entry.强化;',
        '                    }',
        '                });',
        '            });',
        '        };',
        '        cleanCharacter(statData && statData.主角);',
        '        Object.values((statData && statData.关系列表) || {}).forEach(cleanCharacter);',
        '    }',
        '',
    ])
    calc = calc.replace(func_anchor, cleanup_fn + func_anchor, 1)
write_raw(calc_path, calc)

# 在迁移彻底跑过旧存档之前，当前变量模板继续把历史字段从 AI 上下文剔除；
# 这只是兼容层，不再属于商城机制。
vars_text = read_raw(vars_path)
vars_text = vars_text.replace(
    '// 仅隐藏实体顶层的强化计数，避免误删效果表中恰好名为“强化”的正常词条。',
    '// 旧存档兼容：实体顶层「强化」已废弃；在后台迁移完成前仅从AI视野剔除，避免污染上下文。',
)
write_raw(vars_path, vars_text)

print('商城回退、字段迁移与品质锚定修正已生成。')
