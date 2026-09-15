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

# Space-coin reward data follows the actual SillyTavern/MVU lifecycle:
# read only message_id:'latest', cache the most complete snapshot seen for this settlement,
# and never let later settlement cleanup downgrade an already captured reward snapshot.
text = read_exact(settlement)
if 'SETTLEMENT_COIN_LATEST_FREEZE_V3' not in text:
    pattern = r"""          (?:// SETTLEMENT_COIN_SNAPSHOT_V2\n          function settlementCoinSnapshotScore\(data, expectedWorld\) \{|function settlementCoinBaselineHasIncomeData\(data, expectedWorld\) \{)[\s\S]*?          function settlementCoinValue\(data\) \{"""
    replacement = """          // SETTLEMENT_COIN_LATEST_FREEZE_V3
          function settlementCoinSnapshotScore(data) {
            const stat = data && (data.stat_data || data);
            if (!stat || typeof stat !== 'object') return -1;

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

          function preferSpaceCoinSnapshot(current, candidate) {
            if (!candidate) return current;
            const nextScore = settlementCoinSnapshotScore(candidate);
            if (nextScore < 0) return current;
            if (!current) return candidate;
            return nextScore > settlementCoinSnapshotScore(current) ? candidate : current;
          }

          function readLatestSpaceCoinData() {
            const ctx = getMvuContext();
            return ctx && ctx.data;
          }

          function refreshSpaceCoinBaselineData(current) {
            return preferSpaceCoinSnapshot(current, readLatestSpaceCoinData());
          }

          function settlementCoinValue(data) {"""
    text2, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError(f'[settlement-followup] anchor not found or ambiguous: latest MVU coin freeze ({count})')
    write_exact(settlement, text2)
    print('[settlement-followup] patched: latest MVU coin freeze')
else:
    print('[settlement-followup] already patched: latest MVU coin freeze')

replace_once(
    settlement,
    """          let spaceCoinBaselineData = readSpaceCoinBaselineData();""",
    """          let spaceCoinBaselineData = refreshSpaceCoinBaselineData(null);""",
    'initial latest MVU coin snapshot',
)
replace_once(
    settlement,
    """            spaceCoinBaselineData=readSpaceCoinBaselineData();""",
    """            spaceCoinBaselineData=refreshSpaceCoinBaselineData(spaceCoinBaselineData);""",
    'monotonic latest MVU coin refresh',
)

# about:srcdoc message-id recovery is still needed by message markers and other settlement behavior,
# but reward calculation above deliberately does not depend on it.
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
    """            const currentId = getPanelMessageId(win);
            const numericId = Number(currentId);""",
    """            const currentId = getPanelMessageId(win);
            const numericId = currentId === null ? null : Number(currentId);""",
    'null-safe settlement balance panel id',
)

# Old saves may use “普升试炼” as commissioner. Exact alias only inside settlement identity handling.
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

# Programmatic settlement already renders these details; remove old AI-parsed duplicate sections.
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

print('[settlement-followup] done')
