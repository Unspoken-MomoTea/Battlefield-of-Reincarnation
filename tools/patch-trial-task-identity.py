from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative, old, new):
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    if new in text:
        print(f'[trial-identity] already patched: {relative}')
        return False
    if old not in text:
        raise RuntimeError(f'[trial-identity] anchor not found: {relative}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'[trial-identity] patched: {relative}')
    return True


# 1) Schema: persist program-owned trial identity across later MVU/Zod parses.
replace_once(
    'script/ZOD脚本.js',
    """        是否可试炼: boolPreprocess(false),
        试炼已完成: boolPreprocess(false),
        是否在主神空间: boolPreprocess(false),""",
    """        是否可试炼: boolPreprocess(false),
        试炼已完成: boolPreprocess(false),
        // 程序托管的晋升试炼身份；正文/变量AI投影会剔除，仅试炼美化与结算读取。
        是否试炼任务: boolPreprocess(false),
        试炼任务名单: safeTags([]),
        是否在主神空间: boolPreprocess(false),""",
)

# 2) Fresh saves: keep explicit false/empty defaults for easier inspection and migration.
replace_once(
    'World Book/[InitVar]世界初始设定.yaml',
    """  是否可试炼: false
  试炼已完成: false
  是否在主神空间: true""",
    """  是否可试炼: false
  试炼已完成: false
  是否试炼任务: false
  试炼任务名单: []
  是否在主神空间: true""",
)

# 3) AI projection: neither body AI nor normal variable AI can see program-owned trial identity.
replace_once(
    'World Book/[variables]当前变量.txt',
    """// 7. 系统状态 (游玩天数/上次世界日期 为后台隐藏字段, 由脚本自动维护, 对AI不可见)
current.系统状态 = _.omit(data.系统状态 || {}, ['游玩天数', '上次世界日期', '试炼已完成']);""",
    """// 7. 系统状态 (程序托管字段仅供脚本结算，正文/普通变量AI不可见)
current.系统状态 = _.omit(data.系统状态 || {}, [
  '游玩天数', '上次世界日期', '试炼已完成', '是否试炼任务', '试炼任务名单'
]);""",
)

# 4) Trial beautifier: exact task keys become the canonical hidden identity.
replace_once(
    'Regular/试炼任务美化.html',
    """          const ex = expectedData(q);
          q.tasks.forEach(function(task,index){
            const plan = ex.tasks[index] || {};
            // 数据库键直接使用任务原名；试炼身份只由 委托方=晋升试炼 判定。
            // 不再把【晋升试炼·N】塞进任务名，列表展示与数据库保持干净。
            const safeName = String(task.name || ('位格跃迁·' + (index + 1))).replace(/[.。]/g,'·').trim();
            const taskPath = ['stat_data','任务','列表',safeName];
            set(c,taskPath.concat('委托方'),'晋升试炼');
            set(c,taskPath.concat('目标'),task.desc || '完成试炼目标');
            set(c,taskPath.concat('难度'),plan.grade || gradeOf(task.diff));
            set(c,taskPath.concat('奖励'),String(plan.reward || 0)+'空间币');
            set(c,taskPath.concat('交付'),'全部试炼主任务完成后统一结算');
            set(c,taskPath.concat('状态'),'进行中');
            set(c,taskPath.concat('惩罚'),task.punish || '本次晋升试炼失败');
          });""",
    """          const ex = expectedData(q);
          const trialTaskNames = [];
          q.tasks.forEach(function(task,index){
            const plan = ex.tasks[index] || {};
            // 数据库键直接使用任务原名；委托方继续写标准值，但试炼身份由隐藏任务名单兜底。
            // 不再把【晋升试炼·N】塞进任务名，列表展示与数据库保持干净。
            const safeName = String(task.name || ('位格跃迁·' + (index + 1))).replace(/[.。]/g,'·').trim();
            const taskPath = ['stat_data','任务','列表',safeName];
            set(c,taskPath.concat('委托方'),'晋升试炼');
            set(c,taskPath.concat('目标'),task.desc || '完成试炼目标');
            set(c,taskPath.concat('难度'),plan.grade || gradeOf(task.diff));
            set(c,taskPath.concat('奖励'),String(plan.reward || 0)+'空间币');
            set(c,taskPath.concat('交付'),'全部试炼主任务完成后统一结算');
            set(c,taskPath.concat('状态'),'进行中');
            set(c,taskPath.concat('惩罚'),task.punish || '本次晋升试炼失败');
            if (safeName && trialTaskNames.indexOf(safeName) < 0) trialTaskNames.push(safeName);
          });
          // 程序级身份证：后续AI即使误改委托方，结算仍按这里记录的任务键识别晋升试炼。
          set(c,'stat_data.系统状态.是否试炼任务',true);
          set(c,'stat_data.系统状态.试炼任务名单',trialTaskNames);""",
)

# 5) Settlement: hidden identity first; commissioner is only canonical/legacy fallback.
replace_once(
    'Regular/结算任务美化.html',
    """          function extractTrialTasks(data) {
            const stat = data && (data.stat_data || data) || {};
            const list = stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            return Object.keys(list).filter(function(key) {
              const task = list[key];
              return task && String(task.委托方 || '').trim() === '晋升试炼';
            }).map(function(key, index) {
              const task = list[key] || {};
              return {
                key: key,
                name: String(task.名称 || task.任务名 || task.标题 || key || ('晋升试炼·' + (index + 1))),
                status: String(task.状态 || '').trim()
              };
            });
          }""",
    """          function extractTrialTasks(data) {
            const stat = data && (data.stat_data || data) || {};
            const list = stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            const sys = stat && stat.系统状态 && typeof stat.系统状态 === 'object' ? stat.系统状态 : {};
            const marked = sys.是否试炼任务 === true;
            const exactNames = Array.isArray(sys.试炼任务名单)
              ? sys.试炼任务名单.map(function(name) { return String(name || '').trim(); }).filter(Boolean)
              : [];
            let keys = [];

            // 新版：隐藏名单是权威身份，不再依赖AI可改写的委托方。
            if (marked && exactNames.length) {
              keys = exactNames.filter(function(key) { return list[key] && typeof list[key] === 'object'; });
              // 极端旧档若任务被改名，只用委托方关键词补足缺失数量；不得额外扩大试炼集合。
              const missing = Math.max(0, exactNames.length - keys.length);
              if (missing > 0) {
                const fallback = Object.keys(list).filter(function(key) {
                  if (keys.indexOf(key) >= 0) return false;
                  const task = list[key];
                  return task && /(主神|系统|空间|普升|晋升|试炼)/.test(String(task.委托方 || '').trim());
                });
                keys = keys.concat(fallback.slice(0, missing));
              }
            } else if (marked) {
              // 兼容已经带试炼标记、但尚无任务名单的过渡存档。
              keys = Object.keys(list).filter(function(key) {
                const task = list[key];
                return task && /(主神|系统|空间|普升|晋升|试炼)/.test(String(task.委托方 || '').trim());
              });
            } else {
              // 旧存档没有隐藏标记时只接受原标准值，避免普通任务被关键词误判。
              keys = Object.keys(list).filter(function(key) {
                const task = list[key];
                return task && String(task.委托方 || '').trim() === '晋升试炼';
              });
            }

            return keys.map(function(key, index) {
              const task = list[key] || {};
              return {
                key: key,
                name: String(task.名称 || task.任务名 || task.标题 || key || ('晋升试炼·' + (index + 1))),
                status: String(task.状态 || '').trim()
              };
            });
          }""",
)

replace_once(
    'Regular/结算任务美化.html',
    """          function readTrialTasks() {
            const ctx = getMvuContext();
            return extractTrialTasks(ctx && ctx.stat);
          }

          let achievementBaselineData = null;""",
    """          function readTrialTasks() {
            const ctx = getMvuContext();
            return extractTrialTasks(ctx && ctx.stat);
          }

          function settlementTaskKeysForData(data) {
            const stat = data && (data.stat_data || data) || {};
            const list = stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            const keys = Object.keys(list).filter(function(key) {
              const commissioner = String(list[key] && list[key].委托方 || '').trim();
              return commissioner === '主神任务' || commissioner === '晋升试炼';
            });
            extractTrialTasks(data).forEach(function(task) {
              if (task && task.key && keys.indexOf(task.key) < 0) keys.push(task.key);
            });
            return keys;
          }

          let achievementBaselineData = null;""",
)

# Corrupted trial commissioners must still receive their locked task coin reward/penalty.
# Keep this block self-contained because the coin regression extracts it independently.
replace_once(
    'Regular/结算任务美化.html',
    """            const taskRewardDetails = [];
            const penaltyDetails = [];
            const taskList = stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            Object.keys(taskList).forEach(function(name) {
              const task = taskList[name] || {};
              const commissioner = String(task.委托方 || '').trim();
              if (commissioner !== '主神任务' && commissioner !== '晋升试炼') return;""",
    """            const taskRewardDetails = [];
            const penaltyDetails = [];
            const taskList = stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            const recognizedTaskKeys = new Set(Object.keys(taskList).filter(function(name) {
              const commissioner = String(taskList[name] && taskList[name].委托方 || '').trim();
              return commissioner === '主神任务' || commissioner === '晋升试炼';
            }));
            const trialSys = stat.系统状态 && typeof stat.系统状态 === 'object' ? stat.系统状态 : {};
            if (trialSys.是否试炼任务 === true) {
              const exactNames = Array.isArray(trialSys.试炼任务名单)
                ? trialSys.试炼任务名单.map(function(name) { return String(name || '').trim(); }).filter(Boolean)
                : [];
              let exactMatched = 0;
              exactNames.forEach(function(name) {
                if (!taskList[name]) return;
                recognizedTaskKeys.add(name);
                exactMatched += 1;
              });
              const missing = exactNames.length ? Math.max(0, exactNames.length - exactMatched) : Number.POSITIVE_INFINITY;
              if (!exactNames.length || missing > 0) {
                let added = 0;
                Object.keys(taskList).forEach(function(name) {
                  if (exactNames.length && added >= missing) return;
                  if (recognizedTaskKeys.has(name)) return;
                  const commissioner = String(taskList[name] && taskList[name].委托方 || '').trim();
                  if (!/(主神|系统|空间|普升|晋升|试炼)/.test(commissioner)) return;
                  recognizedTaskKeys.add(name);
                  added += 1;
                });
              }
            }
            Object.keys(taskList).forEach(function(name) {
              const task = taskList[name] || {};
              if (!recognizedTaskKeys.has(name)) return;""",
)

# Baseline selection must prefer the trial snapshot even when commissioner text is already corrupted.
replace_once(
    'Regular/结算任务美化.html',
    """          function settlementSnapshotTaskCount(data) {
            const stat = data && (data.stat_data || data);
            const list = stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            return Object.keys(list).filter(function(key) {
              const commissioner = String(list[key] && list[key].委托方 || '').trim();
              return commissioner === '主神任务' || commissioner === '晋升试炼';
            }).length;
          }

          function settlementSnapshotTaskScore(data) {
            const stat=data && (data.stat_data || data);
            const list=stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            let count=0, score=0;
            Object.keys(list).forEach(function(key) {
              const task=list[key] || {};
              const commissioner=String(task.委托方 || '').trim();
              if (commissioner!=='主神任务' && commissioner!=='晋升试炼') return;
              count++;
              const status=String(task.状态 || '').trim();
              const terminal=(typeof isSettlementTaskTerminal === 'function')
                ? isSettlementTaskTerminal(status)
                : ['可结算','可交付','待结算','结算','已结算','完成','已完成','结算完成','失败','已失败','任务失败'].indexOf(status)>=0;
              if (terminal) score+=100;
              else if (status) score+=10;
            });
            return {count:count,score:score+count};
          }""",
    """          function settlementSnapshotTaskCount(data) {
            return settlementTaskKeysForData(data).length;
          }

          function settlementSnapshotTaskScore(data) {
            const stat=data && (data.stat_data || data);
            const list=stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            const marked=!!(stat && stat.系统状态 && stat.系统状态.是否试炼任务 === true);
            let count=0, score=0;
            settlementTaskKeysForData(data).forEach(function(key) {
              const task=list[key] || {};
              count++;
              const status=String(task.状态 || '').trim();
              const terminal=(typeof isSettlementTaskTerminal === 'function')
                ? isSettlementTaskTerminal(status)
                : ['可结算','可交付','待结算','结算','已结算','完成','已完成','结算完成','失败','已失败','任务失败'].indexOf(status)>=0;
              if (terminal) score+=100;
              else if (status) score+=10;
            });
            // 活跃试炼标记是程序身份，必须压过历史普通副本快照。
            return {count:count,score:score+count+(marked?10000:0)};
          }""",
)

replace_once(
    'Regular/结算任务美化.html',
    """          function readSettlementTaskKeys(data) {
            const stat = data && (data.stat_data || data);
            const list = stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            return Object.keys(list).filter(function(key) {
              const commissioner = String(list[key] && list[key].委托方 || '').trim();
              return commissioner === '主神任务' || commissioner === '晋升试炼';
            });
          }""",
    """          function readSettlementTaskKeys(data) {
            return settlementTaskKeysForData(data);
          }""",
)

# Consume the hidden identity only after a full terminal settlement. Pending trials must keep it.
replace_once(
    'Regular/结算任务美化.html',
    """            if (!fullSettlement) return changed;
            // 等待任务变量落到认可完成态/失败，避免先清空后再也无法核验晋升资格。
            if (trialTasks.some(function(task){return !isSettlementTaskTerminal(task.status);})) return changed;

            const isSingleWorld = !!(stat.设置 && stat.设置.单一世界 === true);""",
    """            if (!fullSettlement) return changed;
            // 等待任务变量落到认可完成态/失败，避免先清空后再也无法核验晋升资格。
            if (trialTasks.some(function(task){return !isSettlementTaskTerminal(task.status);})) return changed;

            // 成功/失败都表示本轮试炼生命周期结束；身份标记只消费一次，历史面板不能复活它。
            const activeTrialSys = stat.系统状态 && typeof stat.系统状态 === 'object' ? stat.系统状态 : null;
            if (activeTrialSys && activeTrialSys.是否试炼任务 === true) {
              const sys = ensureObject(stat, '系统状态');
              setValue(sys, '是否试炼任务', false);
              setValue(sys, '试炼任务名单', []);
            }

            const isSingleWorld = !!(stat.设置 && stat.设置.单一世界 === true);""",
)

print('[trial-identity] done')
