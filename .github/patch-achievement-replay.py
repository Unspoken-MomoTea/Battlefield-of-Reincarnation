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

# 1. 成就读取：优先当前结算楼层；已被清空时读取结算前最近 3 层 MVU 快照。
reader_pattern = r"          function readAchievementTasks\(\) \{\n.*?\n          \}\n\n          function trialScore\(tasks\) \{"
reader_replacement = r"""          let achievementBaselineData = null;
          let achievementUsedFallback = false;

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
            return null;
          }

          function extractAchievementTasks(data) {
            const stat = data && (data.stat_data || data);
            const dict = stat && stat.任务 && stat.任务.副本成就 && typeof stat.任务.副本成就 === 'object' ? stat.任务.副本成就 : {};
            return Object.keys(dict).map(function(key) {
              const x = dict[key] || {};
              return { name:String(x.名称 || x.成就名 || key), desc:String(x.说明 || x.描述 || ''), difficulty:String(x.难度 || ''), reward:String(x.奖励 || ''), status:String(x.状态 || '').trim() };
            });
          }

          function readAchievementTasks() {
            achievementBaselineData = null;
            achievementUsedFallback = false;

            const ctx = getMvuContext();
            const win = ctx && ctx.win;
            const mvu = win && win.Mvu;
            const currentId = getPanelMessageId(win);

            if (mvu && typeof mvu.getMvuData === 'function' && currentId !== null) {
              let currentTasks = [];
              try {
                currentTasks = extractAchievementTasks(mvu.getMvuData({ type: 'message', message_id: currentId }));
              } catch (e) {}

              // 无论当前楼层是否仍有成就，都记录结算前最近一份快照，作为首次发奖数量基线。
              let previousHit = null;
              for (let step = 1; step <= 3; step++) {
                const id = currentId - step;
                if (id < 0) break;
                try {
                  const data = mvu.getMvuData({ type: 'message', message_id: id });
                  const tasks = extractAchievementTasks(data);
                  if (tasks.length) {
                    previousHit = { data:data, tasks:tasks };
                    break;
                  }
                } catch (e) {}
              }
              if (previousHit) achievementBaselineData = previousHit.data;

              if (currentTasks.length) return currentTasks;
              if (previousHit) {
                achievementUsedFallback = true;
                return previousHit.tasks;
              }
            }

            return extractAchievementTasks(ctx && ctx.data);
          }

          function trialScore(tasks) {"""
sub_once(reader_pattern, reader_replacement, 'achievement reader')

# 2. 结算写入只操作当前这个结算面板自己的消息楼层。
replace_once(
"""              const win = window.parent || window;
              if (!win.Mvu || !win._ || !win._.set) return;
              const c = win.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
              if (!c) return;
""",
"""              const win = window.parent || window;
              if (!win.Mvu || !win._ || !win._.set) return;
              const panelMessageId = getPanelMessageId(win);
              const targetMessageId = panelMessageId === null ? 'latest' : panelMessageId;
              const c = win.Mvu.getMvuData({ type: 'message', message_id: targetMessageId });
              if (!c) return;
""",
'writer target')

# 3. 成就奖励改为“结算前数量基线 + 本次应发数量”的缺额补发，刷新不重复叠加。
grant_pattern = r"              const achievementGrants = \{\};\n.*?\n              \}\);\n\n              function parseEffectLines\(txt\) \{"
grant_replacement = r"""              const achievementGrants = {};
              achievementTasks.forEach(function(x) {
                if (x.status !== '已达成') return;
                const r = parseAchievementReward(x.reward, world);
                if (!r) { console.warn('[结算美化] 无法识别成就奖励:', x.name, x.reward); return; }
                if (!achievementGrants[r.name]) achievementGrants[r.name] = { grade:r.grade, world:r.world, count:0 };
                achievementGrants[r.name].count++;
              });
              Object.keys(achievementGrants).forEach(function(name) {
                const g = achievementGrants[name], key = 'stat_data.主角.道具.' + name;
                const old = win._.get(c, key) || {};
                const currentQty = Number(old.数量) || 0;
                const baselineQty = achievementBaselineData
                  ? (Number(win._.get(achievementBaselineData, key + '.数量')) || 0)
                  : currentQty;
                const requiredQty = baselineQty + g.count;
                const missing = Math.max(0, requiredQty - currentQty);

                if (missing <= 0) return;

                const tags = Array.isArray(old.标签) ? old.标签.slice() : [];
                ['主神空间','盲盒',g.world].filter(Boolean).forEach(function(t) { if (tags.indexOf(t) < 0) tags.push(t); });
                win._.set(c, key + '.品质', g.grade);
                win._.set(c, key + '.类型', '盲盒');
                win._.set(c, key + '.数量', currentQty + missing);
                win._.set(c, key + '.标签', tags);
                win._.set(c, key + '.效果', old.效果 && typeof old.效果 === 'object' ? old.效果 : { 开启:'盲盒抽奖，打开后随机抽取「' + (g.world || '主神空间') + '」对应品质的奖励。' });
                win._.set(c, key + '.描述', old.描述 || '副本成就奖励。');
                win._.set(c, key + '.状态', [0,1,2].includes(Number(old.状态)) ? Number(old.状态) : 0);
                changed = true;
              });

              function parseEffectLines(txt) {"""
sub_once(grant_pattern, grant_replacement, 'idempotent achievement grant')

# 4. 历史结算楼层重渲染时不再覆盖当前 chat 数据。
replace_once(
"""              if (!changed) return;
              win.Mvu.replaceMvuData(c, { type: 'message', message_id: 'latest' });
              try { win.Mvu.replaceMvuData(c, { type: 'chat' }); } catch (e2) {}
""",
"""              if (!changed) return;
              win.Mvu.replaceMvuData(c, { type: 'message', message_id: targetMessageId });

              let isLatestPanel = targetMessageId === 'latest';
              if (!isLatestPanel) {
                try {
                  const getMsgs = (typeof getChatMessages === 'function')
                    ? getChatMessages
                    : (win && typeof win.getChatMessages === 'function' ? win.getChatMessages.bind(win) : null);
                  const latest = getMsgs ? getMsgs(-1)[0] : null;
                  isLatestPanel = !!latest && Number(latest.message_id) === Number(targetMessageId);
                } catch (e2) {}
              }
              if (isLatestPanel) {
                try { win.Mvu.replaceMvuData(c, { type: 'chat' }); } catch (e3) {}
              }
""",
'writer commit')

for needle in ['getPanelMessageId', 'previousHit', 'achievementBaselineData', 'requiredQty', 'missing <= 0', 'targetMessageId', 'isLatestPanel']:
    if needle not in text:
        raise SystemExit('missing expected token: ' + needle)

if had_crlf:
    text = text.replace('\n', '\r\n')
PATH.write_bytes(text.encode('utf-8'))
