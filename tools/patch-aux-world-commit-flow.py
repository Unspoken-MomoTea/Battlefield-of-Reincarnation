from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUX_PATHS = [
    ROOT / 'script' / '辅助计算脚本.js',
    ROOT / 'dist' / 'V20260916' / '辅助计算脚本.js',
]
WORLD_TEST = ROOT / 'tests' / 'world-engine.cjs'
HARVEST_TEST = ROOT / 'tests' / 'asset-harvest-lifecycle.cjs'


def read_preserve(path: Path):
    raw = path.read_bytes()
    text = raw.decode('utf-8')
    newline = '\r\n' if '\r\n' in text else '\n'
    return text, newline


def block(text: str, newline: str) -> str:
    return text.replace('\n', newline)


def replace_once_or_accept(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label} anchor count != 1: {count}')
    return text.replace(old, new, 1)


OLD_WORLD_BRANCH = """            // 世界引擎的独立提交仅更新叙事数据，不能当成又一轮正文消耗状态/冷却。
            // 标记随本楼层保存；后续正文继承同一标记时 before/after 相等，照常计算。
            const worldCommit = rawVariables?.__samsaraWorldCommit;
            if (worldCommit && worldCommit === statData.世界?.后台?.已处理楼层
                && rawVariablesBefore && worldCommit !== rawVariablesBefore.__samsaraWorldCommit) {
                guardTaskGenerationLock(statData);
                // 世界推进提交若推进了日期，程序时钟与资产收菜必须在同一提交内结算；
                // 这里只维护时间/待办，不消耗战斗状态或冷却。
                updatePlayDays(statData);
                autoHarvestAssets(statData, statDataBefore);
                calcWorldStability(statData);
                // 是否可试炼是程序派生状态；世界独立提交也必须保持它与当前最终属性一致。
                if (statData.角色 && statData.系统状态) {
                    checkTrialEligibility(statData.角色, statData.系统状态);
                }
                return;
            }
"""

NEW_WORLD_BRANCH = """            // 世界引擎独立提交仍必须执行全部数据一致性与派生计算。
            // 它唯一不能被当成“正文又过了一回合”：只跳过状态时长、战斗轮次与冷却消耗。
            // 标记随本楼层保存；后续正文继承同一标记时 before/after 相等，届时按普通正文更新处理。
            const worldCommit = rawVariables?.__samsaraWorldCommit;
            const isWorldCommit = !!(
                worldCommit
                && worldCommit === statData.世界?.后台?.已处理楼层
                && rawVariablesBefore
                && worldCommit !== rawVariablesBefore.__samsaraWorldCommit
            );
"""

OLD_ROLE_STATUS = """            if (statData.角色) {
                cleanupZeroQuantityItems(statData.角色);
                processStatusDuration(statData.角色, isCombat);
            }
"""
NEW_ROLE_STATUS = """            if (statData.角色) {
                cleanupZeroQuantityItems(statData.角色);
                if (!isWorldCommit) {
                    processStatusDuration(statData.角色, isCombat);
                }
            }
"""

OLD_NPC_STATUS = """                    cleanupZeroQuantityItems(npc);
                    processStatusDuration(npc, isCombat);
"""
NEW_NPC_STATUS = """                    cleanupZeroQuantityItems(npc);
                    if (!isWorldCommit) {
                        processStatusDuration(npc, isCombat);
                    }
"""

OLD_COMBAT_TICK = """            // 5. 战斗轮次与形态冷却全自动管理 (模块10)
            processCombatAndCooldowns(statData, statDataBefore);
"""
NEW_COMBAT_TICK = """            // 5. 战斗轮次与形态冷却全自动管理 (模块10)
            // 世界推进写回不是额外正文回合，只屏蔽这一类消耗型推进；其余辅助计算全部照常执行。
            if (!isWorldCommit) {
                processCombatAndCooldowns(statData, statDataBefore);
            }
"""

for path in AUX_PATHS:
    if not path.exists():
        continue
    text, nl = read_preserve(path)
    text = replace_once_or_accept(
        text,
        block(OLD_WORLD_BRANCH, nl),
        block(NEW_WORLD_BRANCH, nl),
        f'{path}: world commit early-return branch',
    )
    text = replace_once_or_accept(
        text,
        block(OLD_ROLE_STATUS, nl),
        block(NEW_ROLE_STATUS, nl),
        f'{path}: player status duration guard',
    )
    text = replace_once_or_accept(
        text,
        block(OLD_NPC_STATUS, nl),
        block(NEW_NPC_STATUS, nl),
        f'{path}: npc status duration guard',
    )
    text = replace_once_or_accept(
        text,
        block(OLD_COMBAT_TICK, nl),
        block(NEW_COMBAT_TICK, nl),
        f'{path}: combat/cooldown guard',
    )
    path.write_bytes(text.encode('utf-8'))


# world-engine regression: world commit must run every non-consuming consistency step.
world, wnl = read_preserve(WORLD_TEST)
old_names = "        const names=['syncRemovedRelationshipPeople','syncRemovedAssets','syncAlienLifecycle','guardTaskGenerationLock','guardPersistedSystemTaskOwner','guardProtectedFields','clampNativeNpcToWorldTier','recalcAllCharacters','checkTrialEligibility','updatePlayDays','autoHarvestAssets','cleanupZeroQuantityItems','processStatusDuration','cleanupDeadNPCs','calcWorldStability','processCombatAndCooldowns'];"
new_names = "        const names=['syncRemovedRelationshipPeople','syncRemovedAssets','syncAlienLifecycle','guardTaskGenerationLock','guardPersistedSystemTaskOwner','guardProtectedFields','clampNativeNpcToWorldTier','applyNewNpcDifficulty','recalcAllCharacters','checkTrialEligibility','updatePlayDays','autoHarvestAssets','cleanupZeroQuantityItems','processStatusDuration','cleanupDeadNPCs','calcWorldStability','processCombatAndCooldowns'];"
world = replace_once_or_accept(world, old_names, new_names, 'world-engine test stub list')
old_assert = "        assert.equal(calls.calcWorldStability,1);assert.equal(calls.processCombatAndCooldowns,undefined);assert.equal(calls.processStatusDuration,undefined);"
new_assert = block("""        assert.equal(calls.guardTaskGenerationLock,1,'世界提交仍要执行任务数据守卫');
        assert.equal(calls.guardPersistedSystemTaskOwner,1,'世界提交仍要执行系统任务所有权守卫');
        assert.equal(calls.guardProtectedFields,1,'世界提交仍要执行受保护字段守卫');
        assert.equal(calls.clampNativeNpcToWorldTier,1,'世界提交仍要执行NPC位格校正');
        assert.equal(calls.applyNewNpcDifficulty,1,'世界提交仍要执行NPC难度补全');
        assert.equal(calls.recalcAllCharacters,1,'世界提交不得跳过角色/NPC派生属性重算');
        assert.equal(calls.checkTrialEligibility,1,'世界提交不得跳过晋升资格派生');
        assert.equal(calls.updatePlayDays,1,'世界提交仍要维护游玩天数');
        assert.equal(calls.autoHarvestAssets,1,'世界提交仍要维护资产收菜调度');
        assert.equal(calls.cleanupZeroQuantityItems,1,'世界提交仍要执行无副作用数据清理');
        assert.equal(calls.cleanupDeadNPCs,1,'世界提交仍要执行死亡NPC清理');
        assert.equal(calls.calcWorldStability,1,'世界提交仍要执行稳定值计算');
        assert.equal(calls.processCombatAndCooldowns,undefined,'世界提交不能额外推进战斗轮次/冷却');
        assert.equal(calls.processStatusDuration,undefined,'世界提交不能额外消耗状态持续时间');""", wnl)
world = replace_once_or_accept(world, old_assert, new_assert, 'world-engine world-commit assertions')
WORLD_TEST.write_bytes(world.encode('utf-8'))


# Asset lifecycle regression must no longer demand an early return.
harvest, hnl = read_preserve(HARVEST_TEST)
old_harvest_assert = block("""assert.match(
  source,
  /worldCommit[\\s\\S]*?guardTaskGenerationLock\\(statData\\);[\\s\\S]*?updatePlayDays\\(statData\\);[\\s\\S]*?autoHarvestAssets\\(statData, statDataBefore\\);[\\s\\S]*?calcWorldStability\\(statData\\);[\\s\\S]*?return;/,
  '世界推进提交必须同步推进隐藏游玩日并执行资产收菜调度',
);
""", hnl)
new_harvest_assert = block("""assert.match(
  source,
  /const isWorldCommit = !!\\([\\s\\S]*?worldCommit !== rawVariablesBefore\\.__samsaraWorldCommit[\\s\\S]*?\\);/,
  '必须只用 worldCommit 标记区分世界推进提交，不能提前结束整个辅助计算',
);
assert.doesNotMatch(
  source,
  /if \\(worldCommit[\\s\\S]{0,1800}?return;/,
  '世界推进提交不得再通过 early return 截断后续辅助计算',
);
assert.match(
  source,
  /updatePlayDays\\(statData\\);[\\s\\S]*?autoHarvestAssets\\(statData, statDataBefore\\);[\\s\\S]*?calcWorldStability\\(statData\\);/,
  '世界推进提交走统一流程时仍必须维护游玩天数、资产收菜与稳定值',
);
assert.match(
  source,
  /if \\(!isWorldCommit\\) \\{[\\s\\S]*?processStatusDuration\\(statData\\.角色, isCombat\\);[\\s\\S]*?\\}/,
  '世界推进提交只应跳过状态时长消耗',
);
assert.match(
  source,
  /if \\(!isWorldCommit\\) \\{[\\s\\S]*?processCombatAndCooldowns\\(statData, statDataBefore\\);[\\s\\S]*?\\}/,
  '世界推进提交只应跳过战斗轮次与冷却消耗',
);
""", hnl)
harvest = replace_once_or_accept(harvest, old_harvest_assert, new_harvest_assert, 'asset lifecycle world-commit assertion')
HARVEST_TEST.write_bytes(harvest.encode('utf-8'))

print('patched auxiliary world-commit flow: no early return, only consuming ticks are skipped')
