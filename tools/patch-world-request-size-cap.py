from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

SOURCE_FILES = [
    ROOT / 'script' / 'world-engine-src' / '40-engine-runtime.part.js',
    ROOT / 'script' / 'world-engine-src' / '56-rumor-liveliness.part.js',
    ROOT / 'script' / 'world-engine-src' / '57-task-awareness.part.js',
    ROOT / 'script' / 'world-engine-src' / '58-chronology-guard.part.js',
    ROOT / 'script' / 'world-engine-src' / '59-soft-maintenance.part.js',
]
TEST_FILE = ROOT / 'tests' / 'world-engine-observability.cjs'
DOC_FILE = ROOT / 'docs' / '世界引擎V2审计.md'
AUX_FILE = ROOT / 'script' / '辅助计算脚本.js'
STATUSBAR_FILE = ROOT / 'script' / '悬浮球状态栏.js'


def remove_request_cap(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    lines = text.splitlines(keepends=True)
    matches = [
        index for index, line in enumerate(lines)
        if '>240000' in line and '请求超过内部安全上限' in line
    ]
    if not matches:
        print(f'[request-size-cap] already removed: {path.relative_to(ROOT)}')
        return False
    if len(matches) != 1:
        raise RuntimeError(
            f'{path.relative_to(ROOT)}: expected exactly one request-size cap, found {len(matches)}'
        )
    del lines[matches[0]]
    path.write_text(''.join(lines), encoding='utf-8')
    print(f'[request-size-cap] removed: {path.relative_to(ROOT)}')
    return True


def replace_once(path: Path, old: str, new: str, label: str) -> bool:
    text = path.read_text(encoding='utf-8')
    if new in text:
        print(f'[request-size-cap] already patched: {label}')
        return False
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one anchor, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'[request-size-cap] patched: {label}')
    return True


def patch_regression() -> None:
    old = "assert.match(source, /请求超过内部安全上限（'\\+formatTokenCount/, 'oversize error must be token-facing even if internal safety remains character based');\nassert.match(source, /system\\.length\\+input\\.length>240000/, 'existing internal safety ceiling must remain unchanged in P1-C');"
    new = "assert.doesNotMatch(source, /请求超过内部安全上限/, 'world engine must not reject requests by a local size ceiling');\nassert.doesNotMatch(source, /(?:system|request\\.system)\\.length\\+(?:input|request\\.input)\\.length>240000/, 'request size is left to the selected provider/model instead of a local hard cap');"
    replace_once(TEST_FILE, old, new, 'observability request-size regression')


def patch_docs() -> None:
    old = '- `tests/world-engine-observability.cjs` 固定验证 tk 格式、估算/实际 usage 区分、专属 API 结构化降级观测、内存清理及原有 24 万字符内部安全上限不变。'
    new = '- `tests/world-engine-observability.cjs` 固定验证 tk 格式、估算/实际 usage 区分、专属 API 结构化降级观测、内存清理，并确认世界引擎不再设置本地请求体积上限；请求能否接受由玩家选择的模型/提供方决定。'
    replace_once(DOC_FILE, old, new, 'observability documentation')


def patch_npc_difficulty_extra_status() -> None:
    old_status = """            if (steps > 0) {
                // 额外强化同时作为难度处理标记，避免同一新增敌人在重复写回时被连续升阶。
                if (npc.状态.额外强化) continue;
                npc.状态.额外强化 = {
                    类型: '增益',
                    品质: TIER_ORDER[baseRank],
                    持续: '持续',
                    来源: '难度机制',
                    原始属性: Object.fromEntries(boostedAttrs.map(attr => [attr, TIER_ORDER[baseRank]])),
                    效果: '全属性强化'
                };
            }
"""
    new_status = """            if (steps > 0) {
                // 额外强化同时作为难度处理标记，避免同一新增敌人在重复写回时被连续升阶。
                if (npc.状态.额外强化) continue;
                const extraRule = {
                    正常: { qualityOffset: 0, attrTier: 'E', attrs: DERIVED_ATTRS },
                    困难: { qualityOffset: 0, attrTier: 'C', attrs: boostedAttrs },
                    挑战: { qualityOffset: 1, attrTier: 'B', attrs: boostedAttrs }
                }[mode];
                npc.状态.额外强化 = {
                    类型: '增益',
                    品质: TIER_ORDER[Math.min(8, baseRank + extraRule.qualityOffset)],
                    持续: '持续',
                    来源: '难度机制',
                    原始属性: Object.fromEntries(extraRule.attrs.map(attr => [attr, extraRule.attrTier])),
                    效果: '全属性强化'
                };
            }
"""
    replace_once(AUX_FILE, old_status, new_status, 'npc difficulty extra status values')

    old_loop = """            for (const kind of ['血统', '技能', '状态', '形态库']) {
                for (const item of Object.values(npc[kind] || {})) upgrade(item, kind);
            }
"""
    new_loop = """            for (const kind of ['血统', '技能', '状态', '形态库']) {
                for (const item of Object.values(npc[kind] || {})) {
                    // 额外强化使用难度专属固定值，不再进入通用 +2/+4/+6 强化。
                    if (kind === '状态' && item === npc.状态.额外强化) continue;
                    upgrade(item, kind);
                }
            }
"""
    replace_once(AUX_FILE, old_loop, new_loop, 'npc difficulty extra status generic-upgrade bypass')

    old_notes = """        var difficultyNotes = {
            '体验': '血统、技能、装备、状态和形态至少与人物生命层级齐平，原始属性不额外提升。',
            '正常': '体验基础上，原始属性品质提升 2 阶。',
            '困难': '原始属性品质提升 4 阶，体质保底 S；血统、技能至少与人物生命层级齐平，装备、状态、形态至少高于人物生命层级 1 阶。',
            '挑战': '原始属性品质提升 6 阶，体质 SSS；血统、装备、状态、形态至少高于人物生命层级 1 阶，技能至少与人物生命层级齐平。'
        };
"""
    new_notes = """        var difficultyNotes = {
            '体验': '血统、技能、装备、状态和形态至少与人物生命层级齐平，原始属性不额外提升；不生成“额外强化”状态。',
            '正常': '体验基础上，原始属性品质提升 2 阶；额外获得与人物生命层级同级品质的“额外强化”，仅衍生属性（ATK/DEF/MATK/MDEF/AP）为 E。',
            '困难': '原始属性品质提升 4 阶，体质保底 S；血统、技能至少与人物生命层级齐平，装备、状态、形态至少高于人物生命层级 1 阶；“额外强化”状态品质与人物生命层级同级，五维与衍生属性均为 C。',
            '挑战': '原始属性品质提升 6 阶，体质 SSS；血统、装备、状态、形态至少高于人物生命层级 1 阶，技能至少与人物生命层级齐平；“额外强化”状态品质比人物生命层级高 1 阶，五维与衍生属性均为 B。'
        };
"""
    replace_once(STATUSBAR_FILE, old_notes, new_notes, 'statusbar difficulty descriptions')

    old_footer = '仅影响后续新建且好感度为负的非队友 NPC。各组件仅补足所选标准，已有更高品质不降低；原始属性仍独立提升，困难/挑战的体质按固定档位补足。品质最高 SSS，生命层级最高 Ⅸ。'
    new_footer = '仅影响后续新建且好感度为负的非队友 NPC。各组件仅补足所选标准，已有更高品质不降低；原始属性仍独立提升，困难/挑战的体质按固定档位补足。“额外强化”仅在正常/困难/挑战生成，状态品质最高 SSS；生命层级最高 Ⅸ。'
    replace_once(STATUSBAR_FILE, old_footer, new_footer, 'statusbar difficulty footer')

    subprocess.run(['node', 'tests/npc-difficulty.cjs', '--difficulty-only'], cwd=ROOT, check=True)


def main() -> None:
    for path in SOURCE_FILES:
        remove_request_cap(path)
    patch_regression()
    patch_docs()
    patch_npc_difficulty_extra_status()
    print('[request-size-cap] done')


if __name__ == '__main__':
    main()
