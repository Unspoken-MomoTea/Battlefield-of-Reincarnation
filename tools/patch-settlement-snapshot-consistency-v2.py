from pathlib import Path
import re

PATH=Path('Regular/结算任务美化.html')
raw=PATH.read_bytes()
had_crlf=b'\r\n' in raw
text=raw.decode('utf-8').replace('\r\n','\n')

def replace_once(old,new,label):
    global text
    n=text.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    text=text.replace(old,new,1)

def sub_once(pattern,replacement,label):
    global text
    out,n=re.subn(pattern,lambda _m: replacement,text,count=1,flags=re.S)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    text=out

# --- A. 原始 settlement 文本恢复：$1 未展开时从当前 latest 原文提取 ---
anchor="          function panelTextBelongsToMessage(panelText, message) {\n"
helpers="""          function extractSettlementBlock(value) {
            const source = String(value || '');
            const match = source.match(/<settlement tasks>([\\s\\S]*?)<\\/settlement tasks>/i);
            return match ? String(match[1] || '').trim() : '';
          }

          function resolveSettlementRawText(value, win) {
            const raw = String(value || '');
            if (raw.trim() && raw.trim() !== '$1') return raw;

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
    replace_once(anchor,helpers+anchor,'insert raw fallback helpers')

replace_once(
"""              const raw = wrapper && wrapper.querySelector ? wrapper.querySelector('.st-raw') : null;
              const panelText = raw ? raw.textContent : '';
              const latest = latestChatMessage(win);
""",
"""              const raw = wrapper && wrapper.querySelector ? wrapper.querySelector('.st-raw') : null;
              const panelText = resolveSettlementRawText(raw ? raw.textContent : '', win);
              const latest = latestChatMessage(win);
""",
'panel target raw recovery')

# --- B. 成就快照：同一批成就按“已达成数量”择优，禁止旧 0/6 覆盖新 6/6 ---
ach_pattern=r"          function extractAchievementTasks\(data\) \{.*?\n          \}\n\n          function readAchievementTasks\(\) \{.*?\n          \}\n\n          const SETTLEMENT_BASELINE_LOOKBACK = 8;"
ach_replacement="""          const ACHIEVEMENT_LOOKBACK = 8;

          function extractAchievementTasks(data) {
            const stat = data && (data.stat_data || data);
            const dict = stat && stat.任务 && stat.任务.副本成就 && typeof stat.任务.副本成就 === 'object' ? stat.任务.副本成就 : {};
            return Object.keys(dict).map(function(key) {
              const x = dict[key] || {};
              return { name:String(x.名称 || x.成就名 || key), desc:String(x.说明 || x.描述 || ''), difficulty:String(x.难度 || ''), reward:String(x.奖励 || ''), status:String(x.状态 || '').trim() };
            });
          }

          function achievementTaskSignature(tasks) {
            return (tasks || []).map(function(x) { return String(x && x.name || ''); }).filter(Boolean).sort().join('|');
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
            let firstPreviousData = null;

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
              try { consider(mvu.getMvuData({ type:'message', message_id:currentId }), false); } catch (e) {}
              if (isLatestPanelMessage(win, currentId)) consider(ctx && ctx.data, false);

              for (let step=1; step<=ACHIEVEMENT_LOOKBACK; step++) {
                const id=currentId-step;
                if (id<0) break;
                try {
                  const data=mvu.getMvuData({type:'message',message_id:id});
                  const tasks=extractAchievementTasks(data);
                  if (!tasks.length) continue;
                  const sig=achievementTaskSignature(tasks);
                  if (!signature) signature=sig;
                  if (sig!==signature) continue;
                  if (!firstPreviousData) firstPreviousData=data;
                  consider(data,true);
                } catch (e) {}
              }
            } else {
              consider(ctx && ctx.data,false);
            }

            if (!achievementBaselineData && firstPreviousData) achievementBaselineData=firstPreviousData;
            return chosen;
          }

          const SETTLEMENT_BASELINE_LOOKBACK = 8;"""
sub_once(ach_pattern,ach_replacement,'achievement resolver')

# --- C. 主神/试炼任务快照：当前楼/live/旧楼按终态成熟度择优 ---
baseline_pattern=r"          function readSettlementBaselineData\(\) \{.*?\n          \}\n\n          function readReincarnatorTier\(data\) \{"
baseline_replacement="""          function settlementSnapshotTaskScore(data) {
            const stat=data && (data.stat_data || data);
            const list=stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            let count=0, score=0;
            Object.keys(list).forEach(function(key) {
              const task=list[key] || {};
              const commissioner=String(task.委托方 || '').trim();
              if (commissioner!=='主神任务' && commissioner!=='晋升试炼') return;
              count++;
              if (isSettlementTaskTerminal(task.状态)) score+=100;
              else if (settlementTaskStatus(task.状态)) score+=10;
            });
            return {count:count,score:score+count};
          }

          function settlementSnapshotWorld(data) {
            const stat=data && (data.stat_data || data);
            return String(stat && stat.世界 && stat.世界.名称 || '').trim();
          }

          function preferSettlementSnapshot(current,candidate) {
            if (!candidate) return current;
            const next=settlementSnapshotTaskScore(candidate);
            if (!next.count) return current;
            if (!current) return candidate;
            const prev=settlementSnapshotTaskScore(current);
            if (!prev.count) return candidate;
            const a=settlementSnapshotWorld(current), b=settlementSnapshotWorld(candidate);
            if (a && b && a!==b) return current;
            return next.score>prev.score ? candidate : current;
          }

          function readSettlementBaselineData() {
            const ctx=getMvuContext();
            const win=ctx && ctx.win;
            const mvu=win && win.Mvu;
            const currentId=getPanelMessageId(win);
            let chosen=null;
            let fallback=null;

            function consider(data) {
              if (!data) return;
              if (!fallback) fallback=data;
              chosen=preferSettlementSnapshot(chosen,data);
            }

            if (mvu && typeof mvu.getMvuData === 'function' && currentId !== null) {
              try { consider(mvu.getMvuData({type:'message',message_id:currentId})); } catch (e) {}
              if (isLatestPanelMessage(win,currentId)) consider(ctx && ctx.data);
              for (let step=1; step<=SETTLEMENT_BASELINE_LOOKBACK; step++) {
                const id=currentId-step;
                if (id<0) break;
                try { consider(mvu.getMvuData({type:'message',message_id:id})); } catch (e) {}
              }
            } else consider(ctx && ctx.data);

            return chosen || fallback || (ctx && ctx.data);
          }

          function readReincarnatorTier(data) {"""
sub_once(baseline_pattern,baseline_replacement,'task baseline resolver')

# --- D. 运行时允许在变量落盘后升级快照 ---
replace_once('          const settlementBaselineData = readSettlementBaselineData();\n','          let settlementBaselineData = readSettlementBaselineData();\n','mutable baseline')
replace_once('          const achievementTasks = readAchievementTasks();\n',"          let achievementTasks = readAchievementTasks();\n          let bestAchievementScore = achievementTaskScore(achievementTasks);\n",'mutable achievements')
replace_once('          const settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);\n','          let settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);\n','mutable keys')
replace_once('          const spaceCoinSettlement = calculateSpaceCoinSettlement(settlementBaselineData);\n','          let spaceCoinSettlement = calculateSpaceCoinSettlement(settlementBaselineData);\n','mutable coin calculation')
replace_once('          const settlementBaselineTier = readReincarnatorTier(settlementBaselineData);\n','          let settlementBaselineTier = readReincarnatorTier(settlementBaselineData);\n','mutable tier')
replace_once(
"""          const credentialDecision = resolveCredentialDecision(settlementBaselineData);
          const credentialGrant = credentialDecision && credentialDecision.granted ? credentialDecision : null;
""",
"""          let credentialDecision = resolveCredentialDecision(settlementBaselineData);
          let credentialGrant = credentialDecision && credentialDecision.granted ? credentialDecision : null;

          function refreshSettlementBaseline() {
            const candidate=readSettlementBaselineData();
            const preferred=preferSettlementSnapshot(settlementBaselineData,candidate);
            if (preferred) settlementBaselineData=preferred;
            settlementTaskKeys=readSettlementTaskKeys(settlementBaselineData);
            spaceCoinSettlement=calculateSpaceCoinSettlement(settlementBaselineData);
            settlementBaselineTier=readReincarnatorTier(settlementBaselineData);
            credentialDecision=resolveCredentialDecision(settlementBaselineData);
            credentialGrant=credentialDecision && credentialDecision.granted ? credentialDecision : null;
            const nextTrials=extractTrialTasks(settlementBaselineData);
            if (nextTrials.length) {
              const score=trialScore(nextTrials);
              if (score>=bestTrialScore) { trialTasks=nextTrials; bestTrialScore=score; }
            }
          }
""",
'refresh baseline state')

# --- E. 成就刷新保持单调，不因清理后的空数据降级 ---
refresh_anchor='          function parseAchievementReward(reward, fallbackWorld) {\n'
refresh_code="""          function refreshAchievementTasks() {
            const latest=readAchievementTasks();
            const preferred=preferAchievementTasks(achievementTasks,latest);
            const score=achievementTaskScore(preferred);
            if (score>=bestAchievementScore) {
              achievementTasks=preferred;
              bestAchievementScore=score;
            }
            panelDiv.querySelectorAll('.st-achievement-host').forEach(function(host) {
              host.innerHTML=renderAchievementPanel();
            });
          }

"""
replace_once(refresh_anchor,refresh_code+refresh_anchor,'achievement refresh helper')

# --- F. 解析恢复文本，并把破坏性写回延后到快照刷新之后 ---
replace_once('          const rawText = rawDiv.textContent;\n','          const rawText = resolveSettlementRawText(rawDiv.textContent, window.parent || window);\n','resolved raw text')
replace_once(
"""          if (hasStruct) writeSettlementToMvu(d, worldName);

          function refreshTrialPanel() {
""",
"""          // 首次渲染只展示；待本楼 MVU 状态稳定后再执行程序结算与清理。

          function refreshTrialPanel() {
            refreshSettlementBaseline();
            refreshAchievementTasks();
            injectProgrammaticIncomeStage(d, spaceCoinSettlement);
            panelDiv.innerHTML = hasStruct ? renderSettlement(d) : renderPlain(rawText);
""",
'defer destructive settlement write')
replace_once('          setTimeout(refreshTrialPanel, 60);\n          setTimeout(refreshTrialPanel, 180);\n','          setTimeout(refreshTrialPanel, 250);\n          setTimeout(refreshTrialPanel, 600);\n','stabilization timers')

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
        raise SystemExit('missing expected token: '+needle)

if had_crlf:
    text=text.replace('\n','\r\n')
PATH.write_bytes(text.encode('utf-8'))
