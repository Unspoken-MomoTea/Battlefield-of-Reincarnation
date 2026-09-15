from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read_exact(path: Path) -> str:
    with path.open('r', encoding='utf-8', newline='') as handle:
        return handle.read()


def write_exact(path: Path, text: str) -> None:
    with path.open('w', encoding='utf-8', newline='') as handle:
        handle.write(text)


def replace_once(path: Path, old: str, new: str, label: str) -> bool:
    text = read_exact(path)
    if new in text:
        print(f'[settlement-followup] already patched: {label}')
        return False
    if old not in text:
        raise RuntimeError(f'[settlement-followup] anchor not found: {label}')
    write_exact(path, text.replace(old, new, 1))
    print(f'[settlement-followup] patched: {label}')
    return True


def regex_once(path: Path, pattern: str, replacement: str, label: str) -> bool:
    text = read_exact(path)
    if replacement in text:
        print(f'[settlement-followup] already patched: {label}')
        return False
    text2, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError(f'[settlement-followup] anchor not found or ambiguous: {label} ({count})')
    write_exact(path, text2)
    print(f'[settlement-followup] patched: {label}')
    return True


settlement = ROOT / 'Regular/结算任务美化.html'

# 1) Earlier migration: scan the whole settlement window instead of stopping at the first partial snapshot.
regex_once(
    settlement,
    r"""          function settlementCoinBaselineHasIncomeData\(data, expectedWorld\) \{[\s\S]*?          function settlementCoinValue\(data\) \{""",
    """          // SETTLEMENT_COIN_SNAPSHOT_V2
          function settlementCoinSnapshotScore(data, expectedWorld) {
            const stat = data && (data.stat_data || data);
            if (!stat || typeof stat !== 'object') return -1;
            const worldName = String(stat.世界 && stat.世界.名称 || '').trim();
            if (expectedWorld && worldName && worldName !== expectedWorld) return -1;

            const tasks = stat.任务 && typeof stat.任务 === 'object' ? stat.任务 : {};
            const world = stat.世界 && typeof stat.世界 === 'object' ? stat.世界 : {};
            const taskList = tasks.列表 && typeof tasks.列表 === 'object' ? tasks.列表 : {};
            const kills = tasks.击杀 && typeof tasks.击杀 === 'object' ? tasks.击杀 : {};
            const exploration = world.探索 && typeof world.探索 === 'object' ? world.探索 : {};
            const factions = world.势力 && typeof world.势力 === 'object' ? world.势力 : {};

            let terminalTasks = 0;
            let explicitCoinTasks = 0;
            Object.keys(taskList).forEach(function(name) {
              const task = taskList[name] || {};
              if (isSettlementTaskTerminal(task.状态)) terminalTasks += 1;
              if (isSettlementTaskSuccessful(task.状态) && parseSpaceCoinTotal(task.奖励, false) > 0) explicitCoinTasks += 1;
              else if (isSettlementTaskFailed(task.状态) && parseSpaceCoinTotal(task.惩罚, true) > 0) explicitCoinTasks += 1;
            });

            const positiveKills = SETTLEMENT_KILL_TIERS.reduce(function(count, tier) {
              return count + ((Number(kills[tier]) || 0) > 0 ? 1 : 0);
            }, 0);
            const trackedExploration = Object.keys(exploration).filter(function(name) {
              const entry = exploration[name] || {};
              return Number(entry.探索度) > 0;
            }).length;
            const trackedFactions = Object.keys(factions).filter(function(name) {
              const entry = factions[name] || {};
              return Number.isFinite(Number(entry.声望));
            }).length;

            const taskCount = Object.keys(taskList).length;
            const sourceCount = taskCount + positiveKills + trackedExploration + trackedFactions;
            if (!sourceCount) return -1;

            return explicitCoinTasks * 100000
              + terminalTasks * 10000
              + taskCount * 1000
              + trackedFactions * 100
              + trackedExploration * 10
              + positiveKills;
          }

          function preferSpaceCoinSnapshot(current, candidate, expectedWorld) {
            if (!candidate) return current;
            const nextScore = settlementCoinSnapshotScore(candidate, expectedWorld);
            if (nextScore < 0) return current;
            if (!current) return candidate;
            const currentScore = settlementCoinSnapshotScore(current, expectedWorld);
            return nextScore > currentScore ? candidate : current;
          }

          function readSpaceCoinBaselineData() {
            const ctx = getMvuContext();
            const win = ctx && ctx.win;
            const mvu = win && win.Mvu;
            const currentId = Number(getPanelMessageId(win));
            const expectedWorld = settlementSnapshotWorld(settlementBaselineData) || settlementSnapshotWorld(ctx && ctx.data);
            let chosen = null;

            function consider(candidate) {
              chosen = preferSpaceCoinSnapshot(chosen, candidate, expectedWorld);
            }

            if (mvu && typeof mvu.getMvuData === 'function' && Number.isInteger(currentId) && currentId >= 0) {
              for (let step = 1; step <= SETTLEMENT_BASELINE_LOOKBACK; step++) {
                const id = currentId - step;
                if (id < 0) break;
                try { consider(mvu.getMvuData({ type:'message', message_id:id })); } catch (e) {}
              }
            }

            consider(settlementBaselineData);
            consider(ctx && ctx.data);
            return chosen || settlementBaselineData || (ctx && ctx.data);
          }

          function settlementCoinValue(data) {""",
    'complete space-coin snapshot selection',
)

# 1b) SillyTavern regex panels run in about:srcdoc. Recover the hosting chat message id from the iframe DOM.
replace_once(
    settlement,
    """          function getPanelMessageId(win) {""",
    """          // SETTLEMENT_SRCDOC_MESSAGE_ID_V3
          function settlementFrameHostMessageId() {
            try {
              let node = (typeof window !== 'undefined') ? window.frameElement : null;
              let depth = 0;
              while (node && depth < 12) {
                let raw = null;
                try {
                  if (typeof node.getAttribute === 'function') {
                    raw = node.getAttribute('mesid');
                    if (raw == null || raw === '') raw = node.getAttribute('data-message-id');
                    if (raw == null || raw === '') raw = node.getAttribute('message_id');
                  }
                } catch (e) {}
                try {
                  if ((raw == null || raw === '') && node.dataset) {
                    if (node.dataset.messageId != null) raw = node.dataset.messageId;
                    else if (node.dataset.mesid != null) raw = node.dataset.mesid;
                  }
                } catch (e) {}
                const id = Number(raw);
                if (raw !== null && raw !== '' && Number.isInteger(id) && id >= 0) return id;
                node = node.parentElement;
                depth += 1;
              }
            } catch (e) {}
            return null;
          }

          function getPanelMessageId(win) {""",
    'srcdoc host message id helper',
)

replace_once(
    settlement,
    """            for (const getter of getters) {
              try {
                const id = Number(getter());
                if (Number.isInteger(id) && id >= 0) return id;
              } catch (e) {}
            }

            // 酒馆正则 iframe 中 getCurrentMessageId 可能不可用；只有当前面板原文确实属于 latest 消息时才安全回落。""",
    """            for (const getter of getters) {
              try {
                const id = Number(getter());
                if (Number.isInteger(id) && id >= 0) return id;
              } catch (e) {}
            }

            const hostMessageId = settlementFrameHostMessageId();
            if (hostMessageId !== null) return hostMessageId;

            // 酒馆正则 iframe 中 getCurrentMessageId 可能不可用；只有当前面板原文确实属于 latest 消息时才安全回落。""",
    'srcdoc host message id fallback',
)

replace_once(
    settlement,
    """            const currentId = Number(getPanelMessageId(win));""",
    """            const panelMessageId = getPanelMessageId(win);
            const currentId = panelMessageId === null ? null : Number(panelMessageId);""",
    'null-safe settlement coin panel id',
)
replace_once(
    settlement,
    """            const currentId = getPanelMessageId(win);
            const numericId = Number(currentId);""",
    """            const currentId = getPanelMessageId(win);
            const numericId = currentId === null ? null : Number(currentId);""",
    'null-safe settlement balance panel id',
)

# 2) Old saves may use “普升试炼” as commissioner. This stays only in trial verification.
replace_once(
    settlement,
    """              const canonical = Object.keys(list).filter(function(key) {
                const task = list[key];
                return task && String(task.委托方 || '').trim() === '晋升试炼';
              });""",
    """              // TRIAL_COMMISSIONER_ALIAS_V2：旧档精确兼容“普升试炼”，不扩大到普通“主神空间”任务。
              const canonical = Object.keys(list).filter(function(key) {
                const task = list[key];
                return task && ['晋升试炼','普升试炼'].includes(String(task.委托方 || '').trim());
              });""",
    'unmarked legacy trial exact alias',
)
replace_once(
    settlement,
    """              return commissioner === '主神任务' || commissioner === '晋升试炼';""",
    """              return commissioner === '主神任务' || commissioner === '晋升试炼' || commissioner === '普升试炼';""",
    'settlement task keys trial alias',
)

# 3) Remove duplicate legacy AI-rendered income sections.
replace_once(
    settlement,
    """            const aiNonCoinItems = (stage.items || []).filter(function(item) {
              if (item.kind === 'calc' || item.kind === 'sum' || item.kind === 'total') return false;
              try { if (/空间币/.test(JSON.stringify(item))) return false; } catch (e) {}
              return true;
            });""",
    """            // SETTLEMENT_LEGACY_INCOME_CLEANUP
            const legacyIncomeSubs = new Set(['击杀目标附加收益明细','世界探索附加收益明细','势力羁绊附加收益明细']);
            const aiNonCoinItems = (stage.items || []).filter(function(item) {
              if (item.kind === 'calc' || item.kind === 'sum' || item.kind === 'total') return false;
              const legacySub = String(item && item.sub || '').trim();
              const legacyName = String(item && item.name || '').trim();
              if (legacyIncomeSubs.has(legacySub) || legacyIncomeSubs.has(legacyName)) return false;
              try { if (/空间币/.test(JSON.stringify(item))) return false; } catch (e) {}
              return true;
            });""",
    'remove duplicated legacy income sections',
)

# 4) Final architecture: space-coin settlement has its own data source and never depends on
# trial/task identity selection. Only task terminal state + explicit coin amounts are relevant.
regex_once(
    settlement,
    r"""          // SETTLEMENT_COIN_SNAPSHOT_V2[\s\S]*?          function settlementCoinValue\(data\) \{""",
    """          // SETTLEMENT_COIN_STANDALONE_V3
          function settlementCoinDataScore(data, expectedWorld) {
            const stat = data && (data.stat_data || data);
            if (!stat || typeof stat !== 'object') return -1;
            const worldName = String(stat.世界 && stat.世界.名称 || '').trim();
            if (expectedWorld && worldName && worldName !== expectedWorld) return -1;

            const tasks = stat.任务 && typeof stat.任务 === 'object' ? stat.任务 : {};
            const world = stat.世界 && typeof stat.世界 === 'object' ? stat.世界 : {};
            const taskList = tasks.列表 && typeof tasks.列表 === 'object' ? tasks.列表 : {};
            const kills = tasks.击杀 && typeof tasks.击杀 === 'object' ? tasks.击杀 : {};
            const exploration = world.探索 && typeof world.探索 === 'object' ? world.探索 : {};
            const factions = world.势力 && typeof world.势力 === 'object' ? world.势力 : {};

            let terminalTasks = 0;
            let explicitCoinTasks = 0;
            Object.keys(taskList).forEach(function(name) {
              const task = taskList[name] || {};
              if (isSettlementTaskTerminal(task.状态)) terminalTasks += 1;
              if (isSettlementTaskSuccessful(task.状态) && parseSpaceCoinTotal(task.奖励, false) > 0) explicitCoinTasks += 1;
              else if (isSettlementTaskFailed(task.状态) && parseSpaceCoinTotal(task.惩罚, true) > 0) explicitCoinTasks += 1;
            });

            const positiveKills = SETTLEMENT_KILL_TIERS.reduce(function(count, tier) {
              return count + ((Number(kills[tier]) || 0) > 0 ? 1 : 0);
            }, 0);
            const trackedExploration = Object.keys(exploration).filter(function(name) {
              return Number((exploration[name] || {}).探索度) > 0;
            }).length;
            const trackedFactions = Object.keys(factions).filter(function(name) {
              return Number.isFinite(Number((factions[name] || {}).声望));
            }).length;
            const taskCount = Object.keys(taskList).length;
            if (!(taskCount + positiveKills + trackedExploration + trackedFactions)) return -1;

            return explicitCoinTasks * 100000
              + terminalTasks * 10000
              + taskCount * 1000
              + trackedFactions * 100
              + trackedExploration * 10
              + positiveKills;
          }

          function preferSpaceCoinData(current, candidate, expectedWorld) {
            if (!candidate) return current;
            const nextScore = settlementCoinDataScore(candidate, expectedWorld);
            if (nextScore < 0) return current;
            if (!current) return candidate;
            return nextScore > settlementCoinDataScore(current, expectedWorld) ? candidate : current;
          }

          function spaceCoinPanelMessageId(win) {
            let hostId = null;
            try {
              if (typeof settlementFrameHostMessageId === 'function') hostId = settlementFrameHostMessageId();
            } catch (e) {}
            if (hostId !== null) return hostId;
            return getPanelMessageId(win);
          }

          function readSpaceCoinSettlementData() {
            const ctx = getMvuContext();
            const win = ctx && ctx.win;
            const mvu = win && win.Mvu;
            const currentStat = ctx && ctx.data && (ctx.data.stat_data || ctx.data);
            const expectedWorld = String(currentStat && currentStat.世界 && currentStat.世界.名称 || '').trim();
            const rawId = spaceCoinPanelMessageId(win);
            const currentId = rawId === null ? null : Number(rawId);
            let chosen = null;

            function consider(candidate) {
              chosen = preferSpaceCoinData(chosen, candidate, expectedWorld);
            }

            if (mvu && typeof mvu.getMvuData === 'function' && Number.isInteger(currentId) && currentId >= 0) {
              for (let step = 1; step <= SETTLEMENT_BASELINE_LOOKBACK; step++) {
                const id = currentId - step;
                if (id < 0) break;
                try { consider(mvu.getMvuData({ type:'message', message_id:id })); } catch (e) {}
              }
            }

            // 当前楼层只作为最后兜底；正式金额绝不借用任务/试炼基线。
            consider(ctx && ctx.data);
            return chosen || (ctx && ctx.data);
          }

          function settlementCoinValue(data) {""",
    'standalone space-coin settlement data source',
)

# Route the live amount calculation through the standalone reader. Keep the historical stale-marker
# repair probe separate; it cannot affect the displayed/current settlement amount.
text = read_exact(settlement)
if 'readSpaceCoinBaselineData()' in text:
    text = text.replace('readSpaceCoinBaselineData()', 'readSpaceCoinSettlementData()')
    text = text.replace('spaceCoinBaselineData', 'spaceCoinSettlementData')
    write_exact(settlement, text)
    print('[settlement-followup] patched: standalone live coin calls')
else:
    print('[settlement-followup] already patched: standalone live coin calls')

# The authoritative pre-settlement balance must resolve the same concrete panel message id,
# independently of task/trial identity.
replace_once(
    settlement,
    """            const currentId = getPanelMessageId(win);
            const numericId = currentId === null ? null : Number(currentId);""",
    """            const currentId = spaceCoinPanelMessageId(win);
            const numericId = currentId === null ? null : Number(currentId);""",
    'standalone settlement balance message id',
)

print('[settlement-followup] done')
