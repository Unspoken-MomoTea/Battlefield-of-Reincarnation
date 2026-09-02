from pathlib import Path
import re

path = Path('Regular/结算任务美化.html')
s = path.read_bytes().decode('utf-8')
nl = '\r\n' if '\r\n' in s else '\n'


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label):
    out, count = re.subn(pattern, lambda m: replacement, text, count=1)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return out


state_old = '          let bestTrialScore = trialScore(trialTasks);'
state_new = state_old + nl + '          let settlementWriteBusy = false;'
s = replace_once(s, state_old, state_new, 'add settlement write guard')

finalizer = '''          function applySettlementFinalization(c, isLatestPanel) {
            // 历史结算面板只负责展示，绝不清理当前数据库。
            if (!isLatestPanel) return false;
            const stat = c && (c.stat_data || c);
            if (!stat) return false;

            const hasHeader = hasSettlementHeader(rawText);
            const fullSettlement = isFullSettlement(rawText);
            const trialPassed = isTrialPassed(trialTasks);
            let changed = false;

            function sameValue(a, b) {
              if (a === b) return true;
              try { return JSON.stringify(a) === JSON.stringify(b); }
              catch (e) { return false; }
            }

            function setValue(target, key, value) {
              if (sameValue(target[key], value)) return;
              target[key] = value;
              changed = true;
            }

            function ensureObject(target, key) {
              const cur = target[key];
              if (!cur || typeof cur !== 'object' || Array.isArray(cur)) {
                target[key] = {};
                changed = true;
              }
              return target[key];
            }

            // 对齐原 onShouldIAdvance：仅出现清算协议标题时，也可补写晋升完成标记；
            // 完整清算则沿用原 onClearCache 语义，只要数据库中的晋升试炼全部可结算就记为完成。
            if (hasHeader && trialPassed) {
              const currentSys = stat.系统状态 && typeof stat.系统状态 === 'object' ? stat.系统状态 : {};
              if ((fullSettlement || currentSys.是否可试炼 === true) && currentSys.试炼已完成 !== true) {
                const sys = ensureObject(stat, '系统状态');
                setValue(sys, '试炼已完成', true);
              }
            }

            if (!fullSettlement) return changed;

            const isSingleWorld = !!(stat.设置 && stat.设置.单一世界 === true);
            const tasks = ensureObject(stat, '任务');
            const world = ensureObject(stat, '世界');
            setValue(tasks, '击杀', {Ⅰ:0, Ⅱ:0, Ⅲ:0, Ⅳ:0, Ⅴ:0, Ⅵ:0, Ⅶ:0, Ⅷ:0, Ⅸ:0});
            setValue(world, '探索', {});

            if (!isSingleWorld) {
              setValue(world, '势力', {});
              setValue(world, '稳定', 100);
              const radar = ensureObject(world, '异端雷达');
              setValue(radar, '当前模式', '');
              setValue(radar, '名单', {});
              setValue(world, '法则', []);
              setValue(world, '货币', {});
              setValue(world, '因果轨道', {});
              setValue(tasks, '列表', {});
              setValue(tasks, '副本成就', {});

              const rumors = ensureObject(stat, '传闻');
              setValue(rumors, '街头巷议', {});
              setValue(rumors, '情报交易', {});
              setValue(rumors, '布告与檄文', {});

              setValue(world, '名称', '主神空间');
              setValue(world, '位格', 'Ⅸ');
              setValue(world, '难度', 'F~SSS');
              const sys = ensureObject(stat, '系统状态');
              setValue(sys, '是否在主神空间', true);
            } else {
              const taskList = ensureObject(tasks, '列表');
              Object.keys(taskList).forEach(function(taskKey) {
                const taskStatus = taskList[taskKey] && taskList[taskKey].状态;
                if (taskStatus === '可结算' || taskStatus === '失败') {
                  delete taskList[taskKey];
                  changed = true;
                }
              });
            }

            return changed;
          }

'''.replace('\n', nl)
pattern = r'          function applySettlementFinalization\(c, isLatestPanel\) \{[\s\S]*?\r?\n          \}\r?\n\r?\n          function writeSettlementToMvu\(d, worldName\) \{'
s = regex_once(s, pattern, finalizer + '          function writeSettlementToMvu(d, worldName) {', 'replace finalizer with idempotent version')

writer_open = '          function writeSettlementToMvu(d, worldName) {'
writer_open_new = writer_open + nl + '            if (settlementWriteBusy) return;' + nl + '            settlementWriteBusy = true;'
s = replace_once(s, writer_open, writer_open_new, 'guard settlement writer')

writer_close_old = "            } catch (e) { console.warn('结算任务写入数据库失败:', e); }" + nl + '          }' + nl + nl + "          const btn = wrapper.querySelector('.st-btn');"
writer_close_new = "            } catch (e) { console.warn('结算任务写入数据库失败:', e); }" + nl + '            finally {' + nl + '              setTimeout(function() { settlementWriteBusy = false; }, 0);' + nl + '            }' + nl + '          }' + nl + nl + "          const btn = wrapper.querySelector('.st-btn');"
s = replace_once(s, writer_close_old, writer_close_new, 'release settlement writer guard')

refresh_marker = '''            if (latest.length) {
              const score = trialScore(latest);
              if (score >= bestTrialScore) {
                trialTasks = latest;
                bestTrialScore = score;
              }
            }
            panelDiv.querySelectorAll('.st-trial-host').forEach(function(host) {'''.replace('\n', nl)
refresh_new = '''            if (latest.length) {
              const score = trialScore(latest);
              if (score >= bestTrialScore) {
                trialTasks = latest;
                bestTrialScore = score;
              }
            }
            // “重新处理变量”只触发 VARIABLE_UPDATE_ENDED 时，也重新执行幂等结算写入。
            if (hasStruct) writeSettlementToMvu(d, worldName);
            panelDiv.querySelectorAll('.st-trial-host').forEach(function(host) {'''.replace('\n', nl)
s = replace_once(s, refresh_marker, refresh_new, 'wire variable reprocess path to settlement writer')

for required in (
    'let settlementWriteBusy = false;',
    'if (settlementWriteBusy) return;',
    'if (hasStruct) writeSettlementToMvu(d, worldName);',
    'function setValue(target, key, value)',
):
    if required not in s:
        raise SystemExit(f'missing required migrated behavior: {required}')

if s.count('if (hasStruct) writeSettlementToMvu(d, worldName);') != 2:
    raise SystemExit('expected initial + VARIABLE_UPDATE_ENDED settlement writes')

path.write_bytes(s.encode('utf-8'))
