from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'Regular/结算任务美化.html'
MARKER = 'SETTLEMENT_COIN_TASK_INDEPENDENCE'

text = PATH.read_text(encoding='utf-8')
if MARKER in text:
    print('settlement coin task independence already patched')
    raise SystemExit(0)


def sub_once(pattern: str, replacement: str, label: str, flags: int = 0) -> None:
    global text
    text2, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'anchor not found or ambiguous: {label} ({count})')
    text = text2
    print(f'[settlement-coin-independence] patched: {label}')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'anchor not found: {label}')
    text = text.replace(old, new, 1)
    print(f'[settlement-coin-independence] patched: {label}')


sub_once(
    r"""            const taskRewardDetails = \[\];\n            const penaltyDetails = \[\];\n            const taskList = stat\.任务 && stat\.任务\.列表 && typeof stat\.任务\.列表 === 'object' \? stat\.任务\.列表 : \{\};\n[\s\S]*?            const taskReward = taskRewardDetails\.reduce\(function\(sum, x\) \{ return sum \+ x\.amount; \}, 0\);\n            const penalty = penaltyDetails\.reduce\(function\(sum, x\) \{ return sum \+ x\.amount; \}, 0\);\n""",
    """            // SETTLEMENT_COIN_TASK_INDEPENDENCE
            // 空间币金额是任务数据事实：只看任务终态与明确金额，不以委托方/任务身份作为发放权限。
            const taskRewardDetails = [];
            const penaltyDetails = [];
            const taskList = stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            Object.keys(taskList).forEach(function(name) {
              const task = taskList[name] || {};
              if (isSettlementTaskSuccessful(task.状态)) {
                const amount = parseSpaceCoinTotal(task.奖励, false);
                if (amount > 0) taskRewardDetails.push({ name:name, amount:amount });
              } else if (isSettlementTaskFailed(task.状态)) {
                const amount = parseSpaceCoinTotal(task.惩罚, true);
                if (amount > 0) penaltyDetails.push({ name:name, amount:amount });
              }
            });
            const taskReward = taskRewardDetails.reduce(function(sum, x) { return sum + x.amount; }, 0);
            const penalty = penaltyDetails.reduce(function(sum, x) { return sum + x.amount; }, 0);
""",
    'task coin amount identity filter',
    re.MULTILINE,
)

replace_once(
"""          function settlementCoinValue(data) {
            const stat = data && (data.stat_data || data);""",
"""          function settlementCoinBaselineHasIncomeData(data, expectedWorld) {
            const stat = data && (data.stat_data || data);
            if (!stat || typeof stat !== 'object') return false;
            const worldName = String(stat.世界 && stat.世界.名称 || '').trim();
            if (expectedWorld && worldName && worldName !== expectedWorld) return false;
            const tasks = stat.任务 && typeof stat.任务 === 'object' ? stat.任务 : {};
            const world = stat.世界 && typeof stat.世界 === 'object' ? stat.世界 : {};
            const taskList = tasks.列表 && typeof tasks.列表 === 'object' ? tasks.列表 : {};
            const kills = tasks.击杀 && typeof tasks.击杀 === 'object' ? tasks.击杀 : {};
            const exploration = world.探索 && typeof world.探索 === 'object' ? world.探索 : {};
            const factions = world.势力 && typeof world.势力 === 'object' ? world.势力 : {};
            return Object.keys(taskList).length > 0
              || Object.keys(kills).length > 0
              || Object.keys(exploration).length > 0
              || Object.keys(factions).length > 0
              || !!String(world.难度 || '').trim();
          }

          function readSpaceCoinBaselineData() {
            const ctx = getMvuContext();
            const win = ctx && ctx.win;
            const mvu = win && win.Mvu;
            const currentId = Number(getPanelMessageId(win));
            const expectedWorld = settlementSnapshotWorld(settlementBaselineData) || settlementSnapshotWorld(ctx && ctx.data);

            // 金额核算读取结算消息之前最近的完整世界数据；不得用任务身份/完成度给候选快照打分。
            if (mvu && typeof mvu.getMvuData === 'function' && Number.isInteger(currentId) && currentId >= 0) {
              for (let step = 1; step <= SETTLEMENT_BASELINE_LOOKBACK; step++) {
                const id = currentId - step;
                if (id < 0) break;
                try {
                  const candidate = mvu.getMvuData({ type:'message', message_id:id });
                  if (settlementCoinBaselineHasIncomeData(candidate, expectedWorld)) return candidate;
                } catch (e) {}
              }
            }

            if (settlementCoinBaselineHasIncomeData(settlementBaselineData, expectedWorld)) return settlementBaselineData;
            if (settlementCoinBaselineHasIncomeData(ctx && ctx.data, expectedWorld)) return ctx && ctx.data;
            return settlementBaselineData || (ctx && ctx.data);
          }

          function settlementCoinValue(data) {
            const stat = data && (data.stat_data || data);""",
'coin-specific pre-settlement snapshot reader',
)

replace_once(
"""          let settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);
          let rawSpaceCoinSettlement = calculateSpaceCoinSettlement(settlementBaselineData);
          let settlementCoinBalanceBefore = readSettlementCoinBalanceBefore();
          let spaceCoinSettlement = rebaseSettlementCoinBalance(rawSpaceCoinSettlement, settlementCoinBalanceBefore);""",
"""          let settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);
          // 仅保留旧任务快照结果用于安全修复历史漏发标记；正式金额不再使用它。
          let legacyRawSpaceCoinSettlement = calculateSpaceCoinSettlement(settlementBaselineData);
          let spaceCoinBaselineData = readSpaceCoinBaselineData();
          let rawSpaceCoinSettlement = calculateSpaceCoinSettlement(spaceCoinBaselineData);
          let settlementCoinBalanceBefore = readSettlementCoinBalanceBefore();
          let spaceCoinSettlement = rebaseSettlementCoinBalance(rawSpaceCoinSettlement, settlementCoinBalanceBefore);""",
'initial independent coin baseline',
)

replace_once(
"""            settlementTaskKeys=readSettlementTaskKeys(settlementBaselineData);
            rawSpaceCoinSettlement=calculateSpaceCoinSettlement(settlementBaselineData);
            if (settlementCoinBalanceBefore === null) settlementCoinBalanceBefore=readSettlementCoinBalanceBefore();
            spaceCoinSettlement=rebaseSettlementCoinBalance(rawSpaceCoinSettlement, settlementCoinBalanceBefore);""",
"""            settlementTaskKeys=readSettlementTaskKeys(settlementBaselineData);
            legacyRawSpaceCoinSettlement=calculateSpaceCoinSettlement(settlementBaselineData);
            spaceCoinBaselineData=readSpaceCoinBaselineData();
            rawSpaceCoinSettlement=calculateSpaceCoinSettlement(spaceCoinBaselineData);
            if (settlementCoinBalanceBefore === null) settlementCoinBalanceBefore=readSettlementCoinBalanceBefore();
            spaceCoinSettlement=rebaseSettlementCoinBalance(rawSpaceCoinSettlement, settlementCoinBalanceBefore);""",
'refresh independent coin baseline',
)

replace_once(
"""                  nextCoin = settlementCoinLegacyRepairTarget(currentCoin, rawSpaceCoinSettlement, spaceCoinSettlement);""",
"""                  nextCoin = settlementCoinLegacyRepairTarget(currentCoin, legacyRawSpaceCoinSettlement, spaceCoinSettlement);""",
'preserve legacy missed-credit repair probe',
)

PATH.write_text(text, encoding='utf-8')
print('settlement coin task-independence patch complete')
