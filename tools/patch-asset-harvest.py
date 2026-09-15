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


aux = read(AUX)

# 世界推进提交若改变了世界日期，同一提交内推进一次隐藏游玩日并刷新收菜。
old_world_commit = """                guardTaskGenerationLock(statData);\n                calcWorldStability(statData);\n                return;"""
new_world_commit = """                guardTaskGenerationLock(statData);\n                // 世界推进提交若推进了日期，只刷新程序时钟/收菜，不消耗战斗状态或冷却。\n                updatePlayDays(statData);\n                autoHarvestAssets(statData, statDataBefore);\n                calcWorldStability(statData);\n                return;"""
if 'autoHarvestAssets(statData, statDataBefore);' not in aux.split('// ★ 任务生成当层整块锁', 1)[0]:
    aux = replace_once(aux, old_world_commit, new_world_commit, 'world commit harvest refresh')
else:
    print('[asset-harvest] already patched: world commit harvest refresh')

# 游玩日是“日期发生变化次数”，不是世界实际经过天数；纪年文本允许古代/异世界格式。
old_clock = """        const DATE_RE = /(\\d+)\\s*年\\s*-?\\s*(\\d+)\\s*月\\s*-?\\s*(\\d+)\\s*日/;\n        const m = String(worldTime).match(DATE_RE);\n        if (!m) return;\n\n        // 规范化日期锚点: 仅取年月日(忽略\"清晨/傍晚\"等时辰, 同一游戏日内多次更新不重复计数)\n        const dateKey = `${+m[1]}-${+m[2]}-${+m[3]}`;"""
new_clock = """        // 只判断“日期是否变了”，不按实际跨越天数累计；纪年允许古代/异世界文本。\n        const DATE_RE = /([^年月日]+?)\\s*年\\s*-?\\s*(\\d+)\\s*月\\s*-?\\s*(\\d+)\\s*日/;\n        const m = String(worldTime).match(DATE_RE);\n        if (!m) return;\n\n        // 仅取纪年/月/日；同一日期内改变时辰不重复计数。\n        const dateKey = `${String(m[1] || '').trim()}-${+m[2]}-${+m[3]}`;"""
if '不按实际跨越天数累计' not in aux:
    if '纪年不要求阿拉伯数字；只要“年/月/日”结构成立' in aux:
        aux = aux.replace(
            """        // 纪年不要求阿拉伯数字；只要“年/月/日”结构成立，就能推进隐藏的游玩天数轴。\n        const DATE_RE = /([^年月日]+?)\\s*年\\s*-?\\s*(\\d+)\\s*月\\s*-?\\s*(\\d+)\\s*日/;\n        const m = String(worldTime).match(DATE_RE);\n        if (!m) return;\n\n        // 规范化日期锚点: 仅取纪年/月/日(忽略\"清晨/傍晚\"等时辰, 同一游戏日内多次更新不重复计数)\n        const dateKey = `${String(m[1] || '').trim()}-${+m[2]}-${+m[3]}`;""",
            new_clock,
            1,
        )
        print('[asset-harvest] patched: play-day semantics comment')
    else:
        aux = replace_once(aux, old_clock, new_clock, 'custom-era play-day identity')
else:
    print('[asset-harvest] already patched: play-day semantics comment')

# 收菜调度完全与世界历法解耦；下次产出日期仅作为“还有多少游玩日”的展示字段。
new_harvest = r'''    /** 资产自动收菜：只按系统状态.游玩天数调度；到期只生成待办。 */
    function autoHarvestAssets(statData, statDataBefore) {
        const assets = statData?.资产;
        const sys = statData?.系统状态;
        if (!assets || typeof assets !== 'object' || !sys) return;

        const playDays = Number(sys.游玩天数 || 0);
        if (!(playDays > 0)) return;
        const cycle = 7;
        const formatRemaining = (nextPlay) => `${Math.max(0, Math.ceil(nextPlay - playDays))}天后`;

        Object.entries(assets).forEach(([assetName, asset]) => {
            if (!asset || typeof asset !== 'object' || !isPlayerOwnedAsset(asset)) return;
            const seqs = asset.建设序列;
            if (!seqs || typeof seqs !== 'object') return;
            if (!Array.isArray(asset.待办事件)) asset.待办事件 = [];

            Object.entries(seqs).forEach(([seqName, seq]) => {
                if (!seq || typeof seq !== 'object') return;
                const output = String(seq.产出 || '').trim();
                if (!output || output === '无' || output === '待定') {
                    seq.下次产出日期 = '';
                    seq.下次产出游天 = 0;
                    return;
                }

                let nextPlay = Number(seq.下次产出游天);
                if (!Number.isFinite(nextPlay) || nextPlay <= 0) {
                    // 兼容旧的相对/游玩日展示；旧世界绝对日期不再参与调度。
                    const shown = String(seq.下次产出日期 || '').trim();
                    const remainingMatch = shown.match(/^(\d+)\s*天后$/);
                    const legacyPlayMatch = shown.match(/^第?\s*(\d+)\s*游玩日$/);
                    if (remainingMatch) nextPlay = playDays + Number(remainingMatch[1]);
                    else if (legacyPlayMatch) nextPlay = Number(legacyPlayMatch[1]);
                    else nextPlay = playDays + cycle;
                }

                seq.下次产出游天 = nextPlay;

                if (playDays >= nextPlay) {
                    const harvestCount = Math.floor((playDays - nextPlay) / cycle) + 1;
                    const prefix = `【自动收菜】${assetName}-${seqName}`;
                    const pendingIndex = asset.待办事件.findIndex(item => String(item || '').startsWith(prefix));
                    let totalCount = harvestCount;
                    if (pendingIndex >= 0) {
                        const oldCount = String(asset.待办事件[pendingIndex] || '').match(/共\s*(\d+)\s*份/);
                        if (oldCount) totalCount += Number(oldCount[1]);
                    }
                    const todoMsg = `${prefix}：${output}（共${totalCount}份，待玩家领取）`;
                    if (pendingIndex >= 0) asset.待办事件[pendingIndex] = todoMsg;
                    else asset.待办事件.push(todoMsg);

                    nextPlay += harvestCount * cycle;
                    seq.下次产出游天 = nextPlay;
                }

                seq.下次产出日期 = formatRemaining(nextPlay);
            });
        });
    };

'''
if 'const formatRemaining = (nextPlay) =>' not in aux:
    pattern = r"    /\*\* 资产全自动收菜系统[\s\S]*?(?=    /\*\* 传入防御总值与角色当前层级 \*/)"
    aux2, count = re.subn(pattern, new_harvest, aux, count=1)
    if count != 1:
        raise RuntimeError(f'[asset-harvest] harvest function anchor not found or ambiguous ({count})')
    aux = aux2
    print('[asset-harvest] patched: relative harvest countdown')
else:
    print('[asset-harvest] already patched: relative harvest countdown')

write(AUX, aux)

rules = read(RULES)
verbose_rules = """待办事件（收件箱机制）:\n  - 触发条件:当角色在外且经过合理时间跨度后触发\n  - 生成与积压:普通经营事件每周可生成1~2条红点并积压；自动收菜到期只新增【自动收菜】待办\n  - 玩家主权:【自动收菜】绝不直接写入背包、货币或库存；只有<user>明确办理/领取对应待办时才结算产物并清除该条，AI不得代替玩家自动办理\n  - 结算机制:其他事件仅在实际解决后清空对应记录，并按结果发放金币、道具或应用BUFF\n\n产出记录: 产出周期统一由程序按每7个【系统状态.游玩天数】形成1份；产出字段只写每份的本地货币或物资“名称×数量”，不写周期；无产出填“无”。到期只进入待办，不自动入账。主神空间资产按空间经济结算，任务世界不得产出空间币。"""
concise_rules = """待办事件（收件箱机制）:\n  - 角色在外经过合理时间后，可生成1~2条经营事件并积压；办理后清除。\n\n产出记录: 只写“名称×数量”；无产出填“无”。自动收菜由程序处理；任务世界不得产出空间币。"""
if concise_rules not in rules:
    rules = replace_once(rules, verbose_rules, concise_rules, 'concise asset prompt')
else:
    print('[asset-harvest] already patched: concise asset prompt')
write(RULES, rules)

print('[asset-harvest] done')
