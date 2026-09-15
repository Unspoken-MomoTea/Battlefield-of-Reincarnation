from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
AUX = ROOT / 'script/辅助计算脚本.js'
RULES = ROOT / 'World Book/⚙️资产与载具规则.txt'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        print(f'[asset-harvest] already patched: {label}')
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'[asset-harvest] anchor not found or ambiguous: {label} ({count})')
    print(f'[asset-harvest] patched: {label}')
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str, new_marker: str) -> str:
    if new_marker in text:
        print(f'[asset-harvest] already patched: {label}')
        return text
    text2, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError(f'[asset-harvest] anchor not found or ambiguous: {label} ({count})')
    print(f'[asset-harvest] patched: {label}')
    return text2


aux = read(AUX)

# 1) 世界推进自己的时间提交就是程序时钟的权威来源：同一提交内先推进游玩天数，再执行收菜。
aux = replace_once(
    aux,
    """                guardTaskGenerationLock(statData);\n                calcWorldStability(statData);\n                return;""",
    """                guardTaskGenerationLock(statData);\n                // 世界推进提交若推进了日期，程序时钟与资产收菜必须在同一提交内结算；\n                // 这里只维护时间/待办，不消耗战斗状态或冷却。\n                updatePlayDays(statData);\n                autoHarvestAssets(statData, statDataBefore);\n                calcWorldStability(statData);\n                return;""",
    'world commit advances play-day harvest clock',
)

# 2) 游玩天数只要求“纪年 + 月 + 日”可识别；纪年允许大业十三、斗罗历2643、轮回历1等任意文本。
aux = replace_once(
    aux,
    """        const DATE_RE = /(\\d+)\\s*年\\s*-?\\s*(\\d+)\\s*月\\s*-?\\s*(\\d+)\\s*日/;\n        const m = String(worldTime).match(DATE_RE);\n        if (!m) return;\n\n        // 规范化日期锚点: 仅取年月日(忽略\"清晨/傍晚\"等时辰, 同一游戏日内多次更新不重复计数)\n        const dateKey = `${+m[1]}-${+m[2]}-${+m[3]}`;""",
    """        // 纪年不要求阿拉伯数字；只要“年/月/日”结构成立，就能推进隐藏的游玩天数轴。\n        const DATE_RE = /([^年月日]+?)\\s*年\\s*-?\\s*(\\d+)\\s*月\\s*-?\\s*(\\d+)\\s*日/;\n        const m = String(worldTime).match(DATE_RE);\n        if (!m) return;\n\n        // 规范化日期锚点: 仅取纪年/月/日(忽略\"清晨/傍晚\"等时辰, 同一游戏日内多次更新不重复计数)\n        const dateKey = `${String(m[1] || '').trim()}-${+m[2]}-${+m[3]}`;""",
    'custom-era play-day date identity',
)

# 3) 收菜触发只依赖系统状态.游玩天数。世界日期仅负责可选的展示换算，解析失败绝不能阻断调度。
aux = replace_once(
    aux,
    """        if (!assets || typeof assets !== 'object' || !worldTime || !sys) return;""",
    """        if (!assets || typeof assets !== 'object' || !sys) return;""",
    'harvest no longer requires parseable world time',
)

aux = replace_once(
    aux,
    """        // 解析世界时间: \"2026年-06月-23日-清晨\"\n        const timeMatch = String(worldTime).match(DATE_RE);\n        if (!timeMatch) return;\n        const currentDays = toDays(+timeMatch[1], +timeMatch[2], +timeMatch[3]);\n\n        // 展示换算: 游玩天数轴第 n 天 → 以当前世界日期为基准的历法日期(仅供查看)\n        const fmtByPlay = (n) => fmtDate(currentDays + (n - playDays));""",
    """        // 世界日期只用于展示换算；自定义纪年无法数值换算时，回退显示“第N游玩日”。\n        const timeMatch = String(worldTime || '').match(DATE_RE);\n        const currentDays = timeMatch ? toDays(+timeMatch[1], +timeMatch[2], +timeMatch[3]) : null;\n        const parseScheduledPlayDay = (value) => {\n            const raw = String(value || '').trim();\n            const playMatch = raw.match(/^第?\\s*(\\d+)\\s*游玩日$/);\n            if (playMatch) return +playMatch[1];\n            if (!Number.isFinite(currentDays)) return null;\n            const dateMatch = raw.match(DATE_RE);\n            if (!dateMatch) return null;\n            return playDays + (toDays(+dateMatch[1], +dateMatch[2], +dateMatch[3]) - currentDays);\n        };\n\n        // 展示字段不是调度依据；无法换算世界历法时仍给玩家明确的游玩日锚点。\n        const fmtByPlay = (n) => Number.isFinite(currentDays)\n            ? fmtDate(currentDays + (n - playDays))\n            : `第${n}游玩日`;""",
    'harvest display date becomes optional',
)

aux = regex_once(
    aux,
    r"""                let nextPlay = Number\(seq\.下次产出游天\);\n                if \(!Number\.isFinite\(nextPlay\) \|\| nextPlay <= 0\) \{\n                    // 首次初始化/旧数据迁移: 有旧日期 → 按剩余天数平移到游天轴\(负值=已欠收, 保留份额\); 无旧值 → 7天后产出\n                    const nextMatch = String\(seq\.下次产出日期 \|\| ''\)\.match\(DATE_RE\);\n                    nextPlay = nextMatch\n                        \? playDays \+ \(toDays\(\+nextMatch\[1\], \+nextMatch\[2\], \+nextMatch\[3\]\) - currentDays\)\n                        : playDays \+ 7;\n                \} else if \(extEdited\) \{\n                    // 新日期合法 → 平移锚点; 非法\(被清空\) → 重置为7天后\n                    const reMatch = String\(seq\.下次产出日期 \|\| ''\)\.match\(DATE_RE\);\n                    nextPlay = reMatch\n                        \? playDays \+ \(toDays\(\+reMatch\[1\], \+reMatch\[2\], \+reMatch\[3\]\) - currentDays\)\n                        : playDays \+ 7;\n                \}""",
    """                let nextPlay = Number(seq.下次产出游天);\n                if (!Number.isFinite(nextPlay) || nextPlay <= 0) {\n                    // 首次初始化/旧数据迁移：展示日期能换算就沿用；否则统一从当前游玩日+7起算。\n                    const migratedPlay = parseScheduledPlayDay(seq.下次产出日期);\n                    nextPlay = Number.isFinite(migratedPlay) ? migratedPlay : playDays + 7;\n                } else if (extEdited) {\n                    // 手动改写展示日期时尽量重锚；无法换算或被清空则重置为7个游玩日后。\n                    const editedPlay = parseScheduledPlayDay(seq.下次产出日期);\n                    nextPlay = Number.isFinite(editedPlay) ? editedPlay : playDays + 7;\n                }""",
    'harvest schedule migrates without world-calendar dependency',
    'const migratedPlay = parseScheduledPlayDay(seq.下次产出日期);',
)

aux = replace_once(
    aux,
    """                    const todoMsg = `【自动收菜】${assetName}-${seqName} 经过了${daysPassed}天，产出了：${seq.产出} (共${harvestCount}份，请查收并清空此条待办)`;""",
    """                    // 硬核规则：自动收菜只形成待办，绝不直接写入背包、货币或库存。\n                    const todoMsg = `【自动收菜】${assetName}-${seqName} 已累计产出：${seq.产出}（共${harvestCount}份）。请由玩家主动办理领取；未办理前不得自动写入背包、货币或库存。`;""",
    'harvest is inbox-only and player-claimed',
)

write(AUX, aux)

rules = read(RULES)
rules = replace_once(
    rules,
    """待办事件（收件箱机制）:\n  - 触发条件:当角色在外且经过合理时间跨度后触发\n  - 生成与积压:每周一生成1~2条红点事件积压至待办事件列表\n  - 结算机制:事件解决后清空对应记录,并发放金币、道具或应用BUFF\n\n产出记录: 写明本地货币或物资的名称、数量与周期；无产出填“无”。主神空间资产按空间经济结算，任务世界不得产出空间币。""",
    """待办事件（收件箱机制）:\n  - 触发条件:当角色在外且经过合理时间跨度后触发\n  - 生成与积压:普通经营事件每周可生成1~2条红点并积压；自动收菜到期只新增【自动收菜】待办\n  - 玩家主权:【自动收菜】绝不直接写入背包、货币或库存；只有<user>明确办理/领取对应待办时才结算产物并清除该条，AI不得代替玩家自动办理\n  - 结算机制:其他事件仅在实际解决后清空对应记录，并按结果发放金币、道具或应用BUFF\n\n产出记录: 产出周期统一由程序按每7个【系统状态.游玩天数】形成1份；产出字段只写每份的本地货币或物资“名称×数量”，不写周期；无产出填“无”。到期只进入待办，不自动入账。主神空间资产按空间经济结算，任务世界不得产出空间币。""",
    'prompt fixes seven-play-day cycle and player-claimed harvest',
)
write(RULES, rules)

print('[asset-harvest] done')
