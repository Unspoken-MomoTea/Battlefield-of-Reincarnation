from pathlib import Path
import re

PATH = Path('Regular/结算任务美化.html')
raw = PATH.read_bytes()
had_crlf = b'\r\n' in raw
text = raw.decode('utf-8').replace('\r\n', '\n')


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text = text.replace(old, new, 1)


def sub_once(pattern, replacement, label):
    global text
    out, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text = out


# 1. 酒馆正则若未展开 $1，运行时从当前消息原文恢复 settlement tasks。
insert_anchor = """          function panelTextBelongsToMessage(panelText, message) {
"""
raw_helpers = """          function extractSettlementBlock(value) {
            const source = String(value || '');
            const match = source.match(/<settlement tasks>([\\s\\S]*?)<\\/settlement tasks>/i);
            return match ? String(match[1] || '').trim() : '';
          }

          function resolveSettlementRawText(value, win) {
            const raw = String(value || '');
            if (raw.trim() && raw.trim() !== '$1') return raw;

            // 历史面板能取得明确楼层号时，绝不拿 latest 的正文冒充旧楼。
            let directId = null;
            const getters = [];
            try { if (typeof getCurrentMessageId === 'function') getters.push(function() { return getCurrentMessageId(); }); } catch (e) {}
            try { if (win && typeof win.getCurrentMessageId === 'function') getters.push(function() { return win.getCurrentMessageId(); }); } catch (e) {}
            try {
              if (typeof window !== 'undefined' && window.parent && window.parent !== window && typeof window.parent.getCurrentMessageId === 'function') {
                getters.push(function() { return window.parent.getCurrentMessageId(); });
              }
            } catch (e) {}
            for (const getter of getters) {
              try {
                const id = Number(getter());
                if (Number.isInteger(id) && id >= 0) { directId = id; break; }
              } catch (e) {}
            }

            const latest = latestChatMessage(win);
            const latestId = latestChatMessageId(latest);
            if (directId !== null && latestId !== null && directId !== latestId) return raw;
            const body = latest && (latest.message != null ? latest.message : (latest.mes != null ? latest.mes : latest.content));
            return extractSettlementBlock(body) || raw;
          }

"""
if 'function extractSettlementBlock(' not in text:
    replace_once(insert_anchor, raw_helpers + insert_anchor, 'raw settlement fallback helpers')

replace_once(
"""              const raw = wrapper && wrapper.querySelector ? wrapper.querySelector('.st-raw') : null;
              const panelText = raw ? raw.textContent : '';
              const latest = latestChatMessage(win);
""",
"""              const raw = wrapper && wrapper.querySelector ? wrapper.querySelector('.st-raw') : null;
              const panelText = resolveSettlementRawText(raw ? raw.textContent : '', win);
              const latest = latestChatMessage(win);
""",
'panel target uses recovered raw text')

# 2. 成就候选快照按“同一批成就 + 完成度”择优，不能当前楼一非空就提前返回。
achievement_pattern = r"          let achievementBaselineData = null;\n          let achievementUsedFallback = false;\n.*?\n          const SETTLEMENT_BASELINE_LOOKBACK = 8;"
achievement_replacement = r"""          let achievementBaselineData = null;
          let achievementUsedFallback = false;
          const ACHIEVEMENT_LOOKBACK = 8;

          function extractAchievementTasks(data) {
            const stat = data && (data.stat_data || data);
            const dict = stat && stat.任务 && stat.任务.副本成就 && typeof stat.任务.副本成就 === 'object' ? stat.任务.副本成就 : {};
            return Object.keys(dict).map(function(key) {
              const x = dict[key] || {};
              return { name:String(x.名称 || x.成就名 || key), desc:String(x.说明 || x.描述 || ''), difficulty:String(x.难度 || ''), reward:String(x.奖励 || ''), status:String(x.状态 || '').trim() };
            });
          }

          function achievementTaskSignature(tasks) {
            return (tasks || []).map(function(x) { return String(x && x.name || ''); }).filter(Boolean).sort().join('\u001f');
          }

          function achievementTaskScore(tasks) {
            const list = Array.isArray(tasks) ? tasks : [];
            const achieved = list.filter(function(x) { return String(x && x.status || '').trim() === '已达成'; }).length;
            return achieved * 1000 + list.length;
          }

          function preferAchievementTasks(current, candidate) {
            const a = Array.isArray(current) ? current : [];
            const b = Array.isArray(candidate) ? candidate : [];
            if (!b.length) return a;
            if (!a.length) return b;
            if (achievementTaskSignature(a) !== achievementTaskSignature(b)) return a;
            return achievementTaskScore(b) > achievementTaskScore(a) ? b : a;
          }

          function readAchievementTasks() {
            achievementUsedFallback = false;
            if (isSingleWorldMode()) return [];

            const ctx = getMvuContext();
            const win = ctx && ctx.win;
            const mvu = win && win.Mvu;
            const currentId = getPanelMessageId(win);
            let chosen = [];
            let signature = '';

            function consider(data, fallback) {
              const tasks = extractAchievementTasks(data);
              if (!tasks.length) return;
              const sig = achievementTaskSignature(tasks);
              if (!signature) signature = sig;
              if (sig !== signature) return;
              const preferred = preferAchievementTasks(chosen, tasks);
              if (preferred !== chosen) {
                chosen = preferred;
                achievementUsedFallback = !!fallback;
              }
            }

            if (mvu && typeof mvu.getMvuData === 'function' && currentId !== null) {
              try { consider(mvu.getMvuData({ type: 'message', message_id: currentId }), false); } catch (e) {}

              // 当前结算楼允许读取 live/latest：VARIABLE_UPDATE_ENDED 与消息快照存在短暂先后差时，
              // live 状态可能已经 6/6，而 message snapshot 仍是 0/6。
              if (isLatestPanelMessage(win, currentId)) consider(ctx && ctx.data, false);

              let firstPreviousData = null;
              for (let step = 1; step <= ACHIEVEMENT_LOOKBACK; step++) {
                const id = currentId - step;
                if (id < 0) break;
                try {
                  const data = mvu.getMvuData({ type: 'message', message_id: id });
                  const tasks = extractAchievementTasks(data);
                  if (!tasks.length) continue;
                  if (!signature) signature = achievementTaskSignature(tasks);
                  if (achievementTaskSignature(tasks) !== signature) continue;
                  if (!firstPreviousData) firstPreviousData = data;
                  consider(data, true);
                } catch (e) {}
              }
              if (!achievementBaselineData && firstPreviousData) achievementBaselineData = firstPreviousData;
            } else {
              consider(ctx && ctx.data, false);
            }

            return chosen;
          }

          const SETTLEMENT_BASELINE_LOOKBACK = 8;"""
sub_once(achievement_pattern, achievement_replacement, 'achievement snapshot resolver')

# 3. 主神/试炼结算基线同样不能只取“往前第一份非空”。当前楼/latest 的成熟状态优先。
baseline_pattern = r"          function readSettlementBaselineData\(\) \{\n.*?\n          \}\n\n          function readReincarnatorTier\(data\) \{"
baseline_replacement = r"""          function settlementSnapshotTaskScore(data) {
            const stat = data && (data.stat_data || data);
            const list = stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            let count = 0;
            let score = 0;
            Object.keys(list).forEach(function(key) {
              const task = list[key] || {};
              const commissioner = String(task.委托方 || '').trim();
              if (commissioner !== '主神任务' && commissioner !== '晋升试炼') return;
              count++;
              if (isSettlementTaskTerminal(task.状态)) score += 100;
              else if (settlementTaskStatus(task.状态)) score += 10;
            });
            return { count:count, score:score + count };
          }

          function settlementSnapshotWorld(data) {
            const stat = data && (data.stat_data || data);
            return String(stat && stat.世界 && stat.世界.名称 || '').trim();
          }

          function preferSettlementSnapshot(current, candidate) {
            if (!candidate) return current;
            const next = settlementSnapshotTaskScore(candidate);
            if (!next.count) return current;
            if (!current) return candidate;
            const prev = settlementSnapshotTaskScore(current);
            if (!prev.count) return candidate;
            const a = settlementSnapshotWorld(current), b = settlementSnapshotWorld(candidate);
            if (a && b && a !== b) return current;
            return next.score > prev.score ? candidate : current;
          }

          function readSettlementBaselineData() {
            const ctx = getMvuContext();
            const win = ctx && ctx.win;
            const mvu = win && win.Mvu;
            const currentId = getPanelMessageId(win);
            let chosen = null;
            let fallback = null;

            function consider(data) {
              if (!data) return;
              if (!fallback) fallback = data;
              chosen = preferSettlementSnapshot(chosen, data);
            }

            if (mvu && typeof mvu.getMvuData === 'function' && currentId !== null) {
              try { consider(mvu.getMvuData({ type: 'message', message_id: currentId })); } catch (e) {}
              if (isLatestPanelMessage(win, currentId)) consider(ctx && ctx.data);
              for (let step = 1; step <= SETTLEMENT_BASELINE_LOOKBACK; step++) {
                const id = currentId - step;
                if (id < 0) break;
                try { consider(mvu.getMvuData({ type: 'message', message_id: id })); } catch (e) {}
              }
            } else {
              consider(ctx && ctx.data);
            }
            return chosen || fallback || (ctx && ctx.data);
          }

          function readReincarnatorTier(data) {"""
sub_once(baseline_pattern, baseline_replacement, 'settlement baseline resolver')

# 4. 运行态允许在 VARIABLE_UPDATE_ENDED 后升级到更成熟的结算源。
replace_once('          const settlementBaselineData = readSettlementBaselineData();\n', '          let settlementBaselineData = readSettlementBaselineData();\n', 'mutable settlement baseline')
replace_once('          const achievementTasks = readAchievementTasks();\n', "          let achievementTasks = readAchievementTasks();\n          let bestAchievementScore = achievementTaskScore(achievementTasks);\n", 'mutable achievement tasks')
replace_once('          const settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);\n', '          let settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);\n', 'mutable settlement task keys')
replace_once('          const spaceCoinSettlement = calculateSpaceCoinSettlement(settlementBaselineData);\n', '          let spaceCoinSettlement = calculateSpaceCoinSettlement(settlementBaselineData);\n', 'mutable coin settlement')
replace_once('          const settlementBaselineTier = readReincarnatorTier(settlementBaselineData);\n', '          let settlementBaselineTier = readReincarnatorTier(settlementBaselineData);\n', 'mutable settlement tier')
replace_once('          const credentialDecision = resolveCredentialDecision(settlementBaselineData);\n          const credentialGrant = credentialDecision && credentialDecision.granted ? credentialDecision : null;\n', "          let credentialDecision = resolveCredentialDecision(settlementBaselineData);\n          let credentialGrant = credentialDecision && credentialDecision.granted ? credentialDecision : null;\n\n          function refreshSettlementBaseline() {\n            const candidate = readSettlementBaselineData();\n            const preferred = preferSettlementSnapshot(settlementBaselineData, candidate);\n            if (preferred) settlementBaselineData = preferred;\n            settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);\n            spaceCoinSettlement = calculateSpaceCoinSettlement(settlementBaselineData);\n            settlementBaselineTier = readReincarnatorTier(settlementBaselineData);\n            credentialDecision = resolveCredentialDecision(settlementBaselineData);\n            credentialGrant = credentialDecision && credentialDecision.granted ? credentialDecision : null;\n\n            const nextTrials = extractTrialTasks(settlementBaselineData);\n            if (nextTrials.length) {\n              const score = trialScore(nextTrials);\n              if (score >= bestTrialScore) { trialTasks = nextTrials; bestTrialScore = score; }\n            }\n          }\n", 'refresh settlement baseline')

# 5. 成就状态在变量更新后单调升级；数据库随后清空也不能把已显示的 6/6 降回 0/6。
achievement_refresh_anchor = """          function parseAchievementReward(reward, fallbackWorld) {
"""
achievement_refresh = """          function refreshAchievementTasks() {
            const latest = readAchievementTasks();
            const preferred = preferAchievementTasks(achievementTasks, latest);
            const score = achievementTaskScore(preferred);
            if (score >= bestAchievementScore) {
              achievementTasks = preferred;
              bestAchievementScore = score;
            }
            if (typeof panelDiv !== 'undefined' && panelDiv) {
              panelDiv.querySelectorAll('.st-achievement-host').forEach(function(host) {
                host.innerHTML = renderAchievementPanel();
              });
            }
          }

"""
if 'function refreshAchievementTasks()' not in text:
    replace_once(achievement_refresh_anchor, achievement_refresh + achievement_refresh_anchor, 'achievement refresh')

# 6. 实际解析使用恢复后的正文；首次破坏性写回延后到一次状态刷新之后。
replace_once("          const rawText = rawDiv.textContent;\n", "          const rawText = resolveSettlementRawText(rawDiv.textContent, window.parent || window);\n", 'use recovered raw settlement text')
replace_once("          if (hasStruct) writeSettlementToMvu(d, worldName);\n\n          function refreshTrialPanel() {\n", "          // 不在首次 DOM 构建时立刻清任务/成就；先给本楼 MVU 一次完成状态同步的机会。\n\n          function refreshTrialPanel() {\n            refreshSettlementBaseline();\n            refreshAchievementTasks();\n            injectProgrammaticIncomeStage(d, spaceCoinSettlement);\n            panelDiv.innerHTML = hasStruct ? renderSettlement(d) : renderPlain(rawText);\n", 'defer write until refreshed snapshot')

# 原函数末尾还会局部重画试炼；保留无害，但写回必须发生在刷新后的完整数据上。
replace_once("          setTimeout(refreshTrialPanel, 60);\n          setTimeout(refreshTrialPanel, 180);\n", "          setTimeout(refreshTrialPanel, 250);\n          setTimeout(refreshTrialPanel, 600);\n", 'settlement stabilization timers')

# 语法/契约防护。
for needle in [
    'function extractSettlementBlock(',
    'function resolveSettlementRawText(',
    'function settlementSnapshotTaskScore(',
    'function preferSettlementSnapshot(',
    'function achievementTaskScore(',
    'function preferAchievementTasks(',
    'let achievementTasks = readAchievementTasks();',
    'function refreshAchievementTasks()',
    "panelDiv.querySelectorAll('.st-achievement-host')",
    'const rawText = resolveSettlementRawText(',
]:
    if needle not in text:
        raise SystemExit('missing expected token: ' + needle)

if had_crlf:
    text = text.replace('\n', '\r\n')
PATH.write_bytes(text.encode('utf-8'))
