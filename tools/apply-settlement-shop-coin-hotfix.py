from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, got {count}: {old[:80]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


html = 'Regular/结算任务美化.html'

replace_once(
    html,
    "          // SETTLEMENT_COIN_CORE_END\n\n          function clonePlain(value) {",
    """          // SETTLEMENT_COIN_CORE_END

          // SETTLEMENT_COIN_WRITE_GUARD_START
          function settlementCoinWriteTarget(currentCoin, settlement) {
            const current = Number(currentCoin);
            const before = Number(settlement && settlement.balanceBefore);
            const after = Number(settlement && settlement.balanceAfter);
            if (!Number.isFinite(current) || !Number.isFinite(before) || !Number.isFinite(after)) return null;
            // 结算币只允许从“结算前余额”推进到“结算后余额”。
            // 已结算余额以及商城消费后的任意余额都属于后续真实状态，禁止旧结算面板回写覆盖。
            if (current !== before || current === after) return null;
            return after;
          }
          // SETTLEMENT_COIN_WRITE_GUARD_END

          function clonePlain(value) {""",
)

replace_once(
    html,
    "          let settlementWriteBusy = false;\n          let settlementWritePending = false;",
    "          let settlementWriteBusy = false;\n          let settlementWritePending = false;\n          let settlementCoinWriteDone = false;",
)

replace_once(
    html,
    "          function isLatestPanelMessage(win, targetMessageId) {\n            if (targetMessageId === 'latest') return true;\n            try {",
    "          function isLatestPanelMessage(win, targetMessageId) {\n            if (targetMessageId === null || targetMessageId === undefined) return false;\n            try {",
)

replace_once(
    html,
    "              const panelMessageId = getPanelMessageId(win);\n              const targetMessageId = panelMessageId === null ? 'latest' : panelMessageId;\n              const isLatestPanel = isLatestPanelMessage(win, targetMessageId);",
    "              const panelMessageId = getPanelMessageId(win);\n              // 无法确认面板所属楼层时只展示，不允许把历史结算误写到 latest。\n              if (panelMessageId === null) return;\n              const targetMessageId = panelMessageId;\n              const isLatestPanel = isLatestPanelMessage(win, targetMessageId);",
)

replace_once(
    html,
    """              let changed = false;
              if (isLatestPanel && isFullSettlement(rawText) && settlementStat.角色 && Number.isFinite(spaceCoinSettlement.balanceAfter)) {
                const currentCoin = Number(settlementStat.角色.空间币) || 0;
                if (currentCoin !== spaceCoinSettlement.balanceAfter) {
                  settlementStat.角色.空间币 = spaceCoinSettlement.balanceAfter;
                  changed = true;
                }
              }
              function exists(path) {""",
    """              let changed = false;
              if (!settlementCoinWriteDone && isLatestPanel && isFullSettlement(rawText) && settlementStat.角色) {
                const sys = settlementStat.系统状态 && typeof settlementStat.系统状态 === 'object'
                  ? settlementStat.系统状态
                  : (settlementStat.系统状态 = {});
                const settlementMarker = String(panelMessageId);
                const recordedMarker = String(sys.结算空间币记录 || '');
                settlementCoinWriteDone = true;
                if (recordedMarker !== settlementMarker) {
                  const currentCoin = Number(settlementStat.角色.空间币);
                  const nextCoin = settlementCoinWriteTarget(currentCoin, spaceCoinSettlement);
                  if (nextCoin !== null) settlementStat.角色.空间币 = nextCoin;
                  // 无论首次执行时余额是结算前值、已结算值还是已经发生商城消费，
                  // 都记录该结算楼层已处理。这样旧档升级后也不会因刷新再次退款。
                  sys.结算空间币记录 = settlementMarker;
                  changed = true;
                }
              }
              function exists(path) {""",
)

replace_once(
    'script/ZOD脚本.js',
    "        待播报记录: safeStr(''),\n        // 真实游玩天数:",
    "        待播报记录: safeStr(''),\n        // 最近一次已经执行空间币结算的结算消息楼层ID；程序自管，AI不可见。\n        结算空间币记录: safeStr(''),\n        // 真实游玩天数:",
)

replace_once(
    'World Book/[InitVar]世界初始设定.yaml',
    "  是否在主神空间: true\n  游玩天数: 0",
    "  是否在主神空间: true\n  结算空间币记录: ''\n  游玩天数: 0",
)

replace_once(
    'World Book/[variables]当前变量.txt',
    "// 7. 系统状态 (游玩天数/上次世界日期 为后台隐藏的真实时间字段, 由脚本自动维护, 对AI不可见)\ncurrent.系统状态 = _.omit(data.系统状态 || {}, ['游玩天数', '上次世界日期', '试炼已完成']);",
    "// 7. 系统状态 (游玩天数/上次世界日期/结算空间币记录 为后台隐藏字段, 由脚本自动维护, 对AI不可见)\ncurrent.系统状态 = _.omit(data.系统状态 || {}, ['游玩天数', '上次世界日期', '试炼已完成', '结算空间币记录']);",
)

print('settlement shop coin hotfix applied')
