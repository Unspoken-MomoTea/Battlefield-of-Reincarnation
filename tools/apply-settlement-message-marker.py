from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


html_path = ROOT / 'Regular/结算任务美化.html'
html = html_path.read_text(encoding='utf-8')

anchor = """          // SETTLEMENT_COIN_WRITE_GUARD_END

          function clonePlain(value) {"""
helper = """          // SETTLEMENT_COIN_WRITE_GUARD_END

          // SETTLEMENT_COIN_MESSAGE_MARKER_START
          const SETTLEMENT_COIN_MESSAGE_MARKER_KEY = '__samsara_settlement_coin_applied';

          function settlementMessageVarHost(win) {
            const candidates = [];
            if (win) candidates.push(win);
            try { if (typeof window !== 'undefined' && window && !candidates.includes(window)) candidates.push(window); } catch (e) {}
            try {
              if (typeof window !== 'undefined' && window && window.parent && !candidates.includes(window.parent)) {
                candidates.push(window.parent);
              }
            } catch (e) {}
            for (const candidate of candidates) {
              if (candidate && typeof candidate.getMessageVar === 'function' && typeof candidate.setMessageVar === 'function') {
                return candidate;
              }
            }
            return null;
          }

          function settlementMessageVarOptions(messageId, defaults) {
            const numericId = Number(messageId);
            const withMsg = Number.isInteger(numericId) && numericId >= 0
              ? { id: numericId }
              : { role: 'assistant' };
            const options = { withMsg: withMsg, noCache: true };
            if (arguments.length > 1) options.defaults = defaults;
            return options;
          }

          function readSettlementCoinMessageMarker(win, messageId) {
            const host = settlementMessageVarHost(win);
            if (!host) return '';
            try {
              return String(host.getMessageVar(
                SETTLEMENT_COIN_MESSAGE_MARKER_KEY,
                settlementMessageVarOptions(messageId, '')
              ) || '');
            } catch (e) {
              return '';
            }
          }

          function writeSettlementCoinMessageMarker(win, messageId, marker) {
            const host = settlementMessageVarHost(win);
            if (!host) return false;
            try {
              host.setMessageVar(
                SETTLEMENT_COIN_MESSAGE_MARKER_KEY,
                String(marker || ''),
                settlementMessageVarOptions(messageId)
              );
              return true;
            } catch (e) {
              return false;
            }
          }
          // SETTLEMENT_COIN_MESSAGE_MARKER_END

          function clonePlain(value) {"""
html = replace_once(html, anchor, helper, 'insert message marker helper')

old_coin_block = """              if (!settlementCoinWriteDone && isLatestPanel && isFullSettlement(rawText) && settlementStat.角色) {
                const sys = settlementStat.系统状态 && typeof settlementStat.系统状态 === 'object'
                  ? settlementStat.系统状态
                  : (settlementStat.系统状态 = {});
                const settlementMarker = String(settlementTarget.marker || targetMessageId);
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
              }"""
new_coin_block = """              let settlementCoinMarkerPending = null;
              if (!settlementCoinWriteDone && isLatestPanel && isFullSettlement(rawText) && settlementStat.角色) {
                const settlementMarker = String(settlementTarget.marker || targetMessageId);
                const recordedMarker = readSettlementCoinMessageMarker(win, targetMessageId);
                settlementCoinWriteDone = true;
                if (recordedMarker !== settlementMarker) {
                  const currentCoin = Number(settlementStat.角色.空间币);
                  const nextCoin = settlementCoinWriteTarget(currentCoin, spaceCoinSettlement);
                  if (nextCoin !== null) {
                    settlementStat.角色.空间币 = nextCoin;
                    changed = true;
                  }
                  // 标记保存在当前结算消息自己的 message variable 中，不进入 stat_data。
                  // 即使旧档已经结算或已经商城消费，也补记该消息，避免极端余额碰撞导致二次结算。
                  settlementCoinMarkerPending = settlementMarker;
                }
              }"""
html = replace_once(html, old_coin_block, new_coin_block, 'replace stat_data settlement marker')

old_flush = """              if (!changed) return;
              await win.Mvu.replaceMvuData(c, { type: 'message', message_id: targetMessageId });

              if (isLatestPanel) {
                try { await win.Mvu.replaceMvuData(c, { type: 'chat' }); } catch (e3) {}
              }"""
new_flush = """              if (!changed) {
                if (settlementCoinMarkerPending !== null) {
                  writeSettlementCoinMessageMarker(win, targetMessageId, settlementCoinMarkerPending);
                }
                return;
              }
              await win.Mvu.replaceMvuData(c, { type: 'message', message_id: targetMessageId });

              if (isLatestPanel) {
                try { await win.Mvu.replaceMvuData(c, { type: 'chat' }); } catch (e3) {}
              }
              if (settlementCoinMarkerPending !== null) {
                writeSettlementCoinMessageMarker(win, targetMessageId, settlementCoinMarkerPending);
              }"""
html = replace_once(html, old_flush, new_flush, 'flush message marker after settlement write')
html_path.write_text(html, encoding='utf-8')

zod_path = ROOT / 'script/ZOD脚本.js'
zod = zod_path.read_text(encoding='utf-8')
zod = replace_once(
    zod,
    "        // 最近一次已经执行空间币结算的结算消息楼层ID；程序自管，AI不可见。\n        结算空间币记录: safeStr(''),\n",
    "",
    'remove settlement marker from schema',
)
zod_path.write_text(zod, encoding='utf-8')

init_path = ROOT / 'World Book/[InitVar]世界初始设定.yaml'
init = init_path.read_text(encoding='utf-8')
init = replace_once(init, "  结算空间币记录: ''\n", "", 'remove settlement marker from initial variables')
init_path.write_text(init, encoding='utf-8')

vars_path = ROOT / 'World Book/[variables]当前变量.txt'
vars_text = vars_path.read_text(encoding='utf-8')
vars_text = replace_once(
    vars_text,
    "// 7. 系统状态 (游玩天数/上次世界日期/结算空间币记录 为后台隐藏字段, 由脚本自动维护, 对AI不可见)\ncurrent.系统状态 = _.omit(data.系统状态 || {}, ['游玩天数', '上次世界日期', '试炼已完成', '结算空间币记录']);",
    "// 7. 系统状态 (游玩天数/上次世界日期 为后台隐藏字段, 由脚本自动维护, 对AI不可见)\ncurrent.系统状态 = _.omit(data.系统状态 || {}, ['游玩天数', '上次世界日期', '试炼已完成']);",
    'remove settlement marker from AI projection',
)
vars_path.write_text(vars_text, encoding='utf-8')

old_test_path = ROOT / 'tests/settlement-shop-coin-persistence.cjs'
old_test = old_test_path.read_text(encoding='utf-8')
old_assertions = """assert.match(source, /recordedMarker !== settlementMarker[\\s\\S]*sys\\.结算空间币记录 = settlementMarker/, 'settlement writes must persist a per-message one-shot marker');
assert.match(zod, /结算空间币记录:\\s*safeStr\\(''\\)/, 'persistent settlement marker must survive schema parsing');
assert.match(init, /结算空间币记录:\\s*''/, 'new saves must initialize the settlement marker');
assert.match(vars, /_.omit\\(data\\.系统状态 \\|\\| \\{}, \\[[^\\]]*'结算空间币记录'[^\\]]*\\]\\)/, 'settlement marker must stay hidden from variable AI');"""
new_assertions = """assert.match(source, /SETTLEMENT_COIN_MESSAGE_MARKER_START/, 'settlement writes must use a message-scoped one-shot marker');
assert.match(source, /readSettlementCoinMessageMarker\\(win, targetMessageId\\)/, 'settlement must read its message-scoped marker');
assert.match(source, /writeSettlementCoinMessageMarker\\(win, targetMessageId, settlementCoinMarkerPending\\)/, 'settlement must persist its marker outside stat_data');
assert.doesNotMatch(source, /sys\\.结算空间币记录|系统状态\\.结算空间币记录/, 'program marker must not live in game variables');
assert.doesNotMatch(zod, /结算空间币记录/, 'schema must not contain program-only settlement state');
assert.doesNotMatch(init, /结算空间币记录/, 'new saves must not initialize program-only settlement state');
assert.doesNotMatch(vars, /结算空间币记录/, 'AI projection must not know about program-only settlement state');"""
old_test = replace_once(old_test, old_assertions, new_assertions, 'update persistence regression expectations')
old_test_path.write_text(old_test, encoding='utf-8')

for workflow_rel in ['.github/workflows/task-awareness-build.yml', '.github/workflows/task-awareness-check.yml']:
    workflow_path = ROOT / workflow_rel
    workflow = workflow_path.read_text(encoding='utf-8')
    step = "      - name: Settlement message marker regression\n        run: node tests/settlement-message-marker.cjs\n"
    if 'Settlement message marker regression' not in workflow:
        anchor = "      - name: Settlement shop coin persistence regression\n        run: node tests/settlement-shop-coin-persistence.cjs\n"
        workflow = replace_once(workflow, anchor, anchor + step, f'add message marker regression to {workflow_rel}')
        workflow_path.write_text(workflow, encoding='utf-8')

print('settlement message marker migration applied')
