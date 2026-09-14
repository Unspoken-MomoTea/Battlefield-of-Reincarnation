from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, got {count}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


html = 'Regular/结算任务美化.html'

old_panel_fn = """          function getPanelMessageId(win) {
            const getters = [];
            try { if (typeof getCurrentMessageId === 'function') getters.push(function() { return getCurrentMessageId(); }); } catch (e) {}
            try { if (win && typeof win.getCurrentMessageId === 'function') getters.push(function() { return win.getCurrentMessageId(); }); } catch (e) {}
            try {
              if (window.parent && window.parent !== window && typeof window.parent.getCurrentMessageId === 'function') {
                getters.push(function() { return window.parent.getCurrentMessageId(); });
              }
            } catch (e) {}
            for (const getter of getters) {
              try {
                const id = Number(getter());
                if (Number.isInteger(id) && id >= 0) return id;
              } catch (e) {}
            }
            return null;
          }
"""
new_panel_fn = """          // SETTLEMENT_PANEL_TARGET_START
          function normalizeSettlementComparableText(value) {
            return String(value || '').replace(/\\r/g, '').replace(/\\s+/g, ' ').trim();
          }

          function latestChatMessage(win) {
            try {
              const getMsgs = (typeof getChatMessages === 'function')
                ? getChatMessages
                : (win && typeof win.getChatMessages === 'function' ? win.getChatMessages.bind(win) : null);
              const list = getMsgs ? getMsgs(-1) : null;
              return list && list[0] ? list[0] : null;
            } catch (e) {}
            return null;
          }

          function latestChatMessageId(message) {
            const raw = message && (message.message_id != null ? message.message_id : message.id);
            const id = Number(raw);
            return Number.isInteger(id) && id >= 0 ? id : null;
          }

          function panelTextBelongsToMessage(panelText, message) {
            const panel = normalizeSettlementComparableText(panelText);
            const body = normalizeSettlementComparableText(message && (message.message != null ? message.message : (message.mes != null ? message.mes : message.content)));
            return !!panel && !!body && body.indexOf(panel) >= 0;
          }
          // SETTLEMENT_PANEL_TARGET_END

          function getPanelMessageId(win) {
            const getters = [];
            try { if (typeof getCurrentMessageId === 'function') getters.push(function() { return getCurrentMessageId(); }); } catch (e) {}
            try { if (win && typeof win.getCurrentMessageId === 'function') getters.push(function() { return win.getCurrentMessageId(); }); } catch (e) {}
            try {
              if (window.parent && window.parent !== window && typeof window.parent.getCurrentMessageId === 'function') {
                getters.push(function() { return window.parent.getCurrentMessageId(); });
              }
            } catch (e) {}
            for (const getter of getters) {
              try {
                const id = Number(getter());
                if (Number.isInteger(id) && id >= 0) return id;
              } catch (e) {}
            }

            // 酒馆正则 iframe 中 getCurrentMessageId 可能不可用；只有当前面板原文确实属于 latest 消息时才安全回落。
            try {
              const raw = wrapper && wrapper.querySelector ? wrapper.querySelector('.st-raw') : null;
              const panelText = raw ? raw.textContent : '';
              const latest = latestChatMessage(win);
              if (panelTextBelongsToMessage(panelText, latest)) return latestChatMessageId(latest);
            } catch (e) {}
            return null;
          }
"""
replace_once(html, old_panel_fn, new_panel_fn)

old_latest_fn = """          function isLatestPanelMessage(win, targetMessageId) {
            if (targetMessageId === null || targetMessageId === undefined) return false;
            try {
              const getMsgs = (typeof getChatMessages === 'function')
                ? getChatMessages
                : (win && typeof win.getChatMessages === 'function' ? win.getChatMessages.bind(win) : null);
              const latest = getMsgs ? getMsgs(-1)[0] : null;
              const latestId = latest && (latest.message_id != null ? latest.message_id : latest.id);
              return latestId != null && Number(latestId) === Number(targetMessageId);
            } catch (e) {}
            return false;
          }
"""
new_latest_fn = """          function isLatestPanelMessage(win, targetMessageId) {
            if (targetMessageId === null || targetMessageId === undefined) return false;
            try {
              const latestId = latestChatMessageId(latestChatMessage(win));
              return latestId != null && Number(latestId) === Number(targetMessageId);
            } catch (e) {}
            return false;
          }

          function settlementTextFingerprint(value) {
            const source = normalizeSettlementComparableText(value);
            let hash = 2166136261;
            for (let i = 0; i < source.length; i++) {
              hash ^= source.charCodeAt(i);
              hash = Math.imul(hash, 16777619);
            }
            return (hash >>> 0).toString(36);
          }

          function resolveSettlementMessageTarget(win, panelText) {
            const panelMessageId = getPanelMessageId(win);
            if (panelMessageId !== null) {
              return {
                targetMessageId: panelMessageId,
                marker: String(panelMessageId),
                isLatestPanel: isLatestPanelMessage(win, panelMessageId)
              };
            }

            // 极少数环境连 latest 的数字ID都不给：仅当 latest 原文完整包含当前面板结算文本时允许写 latest。
            const latest = latestChatMessage(win);
            if (!panelTextBelongsToMessage(panelText, latest)) return null;
            const latestId = latestChatMessageId(latest);
            return {
              targetMessageId: 'latest',
              marker: latestId !== null ? String(latestId) : ('text:' + settlementTextFingerprint(panelText)),
              isLatestPanel: true
            };
          }
"""
replace_once(html, old_latest_fn, new_latest_fn)

old_trial_init = """          let trialTasks = readTrialTasks();
          let bestTrialScore = trialScore(trialTasks);
          let settlementWriteBusy = false;
          let settlementWritePending = false;
          let settlementCoinWriteDone = false;
          const achievementTasks = readAchievementTasks();
          function readSettlementTaskKeys(data) {
"""
new_trial_init = """          const settlementBaselineData = readSettlementBaselineData();
          // 结算核验优先使用结算前任务快照，避免当前结算楼层的 MVU 快照与 EJS 已生成结果不同步。
          let trialTasks = extractTrialTasks(settlementBaselineData);
          if (!trialTasks.length) trialTasks = readTrialTasks();
          let bestTrialScore = trialScore(trialTasks);
          let settlementWriteBusy = false;
          let settlementWritePending = false;
          let settlementCoinWriteDone = false;
          const achievementTasks = readAchievementTasks();
          function readSettlementTaskKeys(data) {
"""
replace_once(html, old_trial_init, new_trial_init)

old_baseline_dup = """          const settlementBaselineData = readSettlementBaselineData();
          // 当正文变量已经清掉任务，仍从结算前快照核验；不以正文“已晋升”代替完成状态。
          if (!trialTasks.length) {
            trialTasks = extractTrialTasks(settlementBaselineData);
            bestTrialScore = trialScore(trialTasks);
          }
          const settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);
"""
new_baseline_dup = """          // 当正文变量已经清掉任务，仍从结算前快照核验；不以正文“已晋升”代替完成状态。
          const settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);
"""
replace_once(html, old_baseline_dup, new_baseline_dup)

old_write_target = """              const panelMessageId = getPanelMessageId(win);
              // 无法确认面板所属楼层时只展示，不允许把历史结算误写到 latest。
              if (panelMessageId === null) return;
              const targetMessageId = panelMessageId;
              const isLatestPanel = isLatestPanelMessage(win, targetMessageId);
              const c = win.Mvu.getMvuData({ type: 'message', message_id: targetMessageId });
              if (!c) return;
              const settlementStat = c.stat_data || c;
              const isSingleWorldSettlement = !!(settlementStat.设置 && settlementStat.设置.单一世界 === true);
              if (isLatestPanel && isFullSettlement(rawText) && trialTasks.some(function(task){return !isSettlementTaskTerminal(task.status);})) return;

              let changed = false;
"""
new_write_target = """              const settlementTarget = resolveSettlementMessageTarget(win, rawText);
              if (!settlementTarget) return;
              const targetMessageId = settlementTarget.targetMessageId;
              const isLatestPanel = settlementTarget.isLatestPanel;
              const c = win.Mvu.getMvuData({ type: 'message', message_id: targetMessageId });
              if (!c) return;
              const settlementStat = c.stat_data || c;
              const isSingleWorldSettlement = !!(settlementStat.设置 && settlementStat.设置.单一世界 === true);

              // 未完成的晋升试炼只阻止晋升资格与最终清理；已完成主神任务的空间币/凭证/战利品仍正常结算。
              let changed = false;
"""
replace_once(html, old_write_target, new_write_target)

replace_once(
    html,
    "                const settlementMarker = String(panelMessageId);",
    "                const settlementMarker = String(settlementTarget.marker || targetMessageId);",
)

replace_once(
    'tests/settlement-status-aliases.cjs',
    "assert.equal((html.match(/trialTasks\\.some\\(function\\(task\\)\\{return !isSettlementTaskTerminal\\(task\\.status\\);\\}\\)/g)||[]).length,2,'清理与写回都应等待试炼进入认可终态');",
    "assert.equal((html.match(/trialTasks\\.some\\(function\\(task\\)\\{return !isSettlementTaskTerminal\\(task\\.status\\);\\}\\)/g)||[]).length,1,'只有晋升资格与最终清理需要等待试炼进入认可终态，空间币写回不得被阻断');",
)

replace_once(
    'World Book/⚙️任务与委托系统.txt',
    """  绝对铁律:
    - 状态变化≠流程执行
    - AI不得自动推进状态机
    - 未收到对应事件，不得执行下一阶段
""",
    """  状态同步铁律:
    - 变量AI必须按当前剧情已确认事实同步任务状态；不得因“尚未输入结算指令”而把已完成目标继续保留为进行中
    - 主神/试炼任务：目标已明确完成立即同步为可结算；明确失败同步为失败；【结算任务】只负责发奖、惩罚与清理，不负责补判任务是否完成
    - 本土任务：目标已明确完成且尚未实际交付时同步为可交付
    - 状态变化≠流程执行；更新状态不得自动发奖、交付、结算或remove
    - 未收到对应交付/结算事件，不得执行下一阶段的流程动作
""",
)

replace_once(
    'World Book/[mvu_update]变量更新规则.txt',
    """        - 严格遵循<任务与委托系统>
        - *P_状态同步
        - 本节点仅负责变量同步，不负责流程推演
""",
    """        - 严格遵循<任务与委托系统>
        - *P_状态同步
        - 主神任务/晋升试炼：目标已明确完成立即将状态replace为【可结算】；明确失败replace为【失败】；不得等待【结算任务】才同步
        - 本土任务：目标已明确完成但尚未交付时replace为【可交付】
        - 本节点仅负责变量同步，不负责交付、发奖、结算或清理流程
""",
)

for workflow in ['.github/workflows/task-awareness-build.yml', '.github/workflows/task-awareness-check.yml']:
    replace_once(
        workflow,
        "      - name: Settlement shop coin persistence regression\n        run: node tests/settlement-shop-coin-persistence.cjs\n",
        "      - name: Settlement shop coin persistence regression\n        run: node tests/settlement-shop-coin-persistence.cjs\n      - name: Settlement current panel regression\n        run: node tests/settlement-current-panel-regression.cjs\n",
    )

print('settlement current-panel regression fix applied')
