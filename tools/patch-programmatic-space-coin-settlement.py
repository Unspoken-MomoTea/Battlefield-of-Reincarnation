from pathlib import Path

path = Path('Regular/结算任务美化.html')
text = path.read_text(encoding='utf-8')

if 'SETTLEMENT_COIN_CORE_START' in text:
    print('programmatic space-coin settlement already patched')
    raise SystemExit(0)

def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    text = text.replace(old, new, 1)

core = r'''          // SETTLEMENT_COIN_CORE_START
          const SETTLEMENT_COIN_GRADES = ['F','E','D','C','B','A','S','SS','SSS'];
          const SETTLEMENT_COIN_BASES = [100,500,2500,12000,50000,200000,800000,3200000,12800000];
          const SETTLEMENT_KILL_TIERS = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
          const SETTLEMENT_KILL_UNITS = [10,50,250,1200,5000,20000,80000,320000,1280000];

          function parseSpaceCoinTotal(value, penaltyMode) {
            let source = String(value || '').replace(/[,，]/g, '');
            const values = [];
            function take(re) {
              source = source.replace(re, function(_, num, wan) {
                let n = Number(num);
                if (!Number.isFinite(n)) return '';
                if (wan) n *= 10000;
                values.push(n);
                return '';
              });
            }
            take(/(-?\d+(?:\.\d+)?)\s*(万)?\s*空间币/g);
            take(/空间币\s*(?:奖励|惩罚|扣除|损失|减少|[：:]|\s)*\s*(-?\d+(?:\.\d+)?)\s*(万)?/g);
            return values.reduce(function(sum, n) {
              return sum + (penaltyMode ? Math.abs(n) : Math.max(0, n));
            }, 0);
          }

          function stripSpaceCoinText(value) {
            return String(value || '')
              .split(/[；;、|｜+＋\n]+/)
              .map(function(x) { return x.trim(); })
              .filter(function(x) { return x && x.indexOf('空间币') < 0; })
              .join('；');
          }

          function calculateSpaceCoinSettlement(data) {
            const stat = data && (data.stat_data || data) || {};
            const isSingleWorld = !!(stat.设置 && stat.设置.单一世界 === true);
            const grades = String(stat.世界 && stat.世界.难度 || '').toUpperCase().match(/SSS|SS|S|A|B|C|D|E|F/g) || [];
            let gradeIndex = grades.length ? Math.min.apply(null, grades.map(function(g) { return SETTLEMENT_COIN_GRADES.indexOf(g); }).filter(function(i) { return i >= 0; })) : 0;
            if (!Number.isFinite(gradeIndex) || gradeIndex < 0) gradeIndex = 0;
            const base = SETTLEMENT_COIN_BASES[gradeIndex] || 0;

            const taskRewardDetails = [];
            const penaltyDetails = [];
            const taskList = stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            Object.keys(taskList).forEach(function(name) {
              const task = taskList[name] || {};
              const commissioner = String(task.委托方 || '').trim();
              if (commissioner !== '主神任务' && commissioner !== '晋升试炼') return;
              const success = String(task.状态 || '').trim() === '可结算';
              if (success) {
                const amount = parseSpaceCoinTotal(task.奖励, false);
                if (amount > 0) taskRewardDetails.push({ name:name, amount:amount });
              } else {
                const amount = parseSpaceCoinTotal(task.惩罚, true);
                if (amount > 0) penaltyDetails.push({ name:name, amount:amount });
              }
            });
            const taskReward = taskRewardDetails.reduce(function(sum, x) { return sum + x.amount; }, 0);
            const penalty = penaltyDetails.reduce(function(sum, x) { return sum + x.amount; }, 0);

            const kills = stat.任务 && stat.任务.击杀 && typeof stat.任务.击杀 === 'object' ? stat.任务.击杀 : {};
            const killDetails = [];
            let killRaw = 0;
            SETTLEMENT_KILL_TIERS.forEach(function(tier, index) {
              const count = Math.max(0, Number(kills[tier]) || 0);
              if (!count) return;
              const unit = SETTLEMENT_KILL_UNITS[index];
              const subtotal = count * unit;
              killRaw += subtotal;
              killDetails.push({ tier:tier, count:count, unit:unit, subtotal:subtotal });
            });
            const killCap = base * 10;
            const killReward = Math.min(killRaw, killCap);

            const explorationDetails = [];
            let explorationRaw = 0;
            const exploration = stat.世界 && stat.世界.探索 && typeof stat.世界.探索 === 'object' ? stat.世界.探索 : {};
            if (!isSingleWorld) {
              Object.keys(exploration).forEach(function(name) {
                const entry = exploration[name] || {};
                const progress = Math.max(0, Math.min(100, Number(entry.探索度) || 0));
                if (!progress) return;
                const subtotal = base * progress / 100;
                explorationRaw += subtotal;
                explorationDetails.push({ name:name, progress:progress, subtotal:subtotal });
              });
            }
            const explorationCap = base * 3;
            const explorationReward = isSingleWorld ? 0 : Math.min(explorationRaw, explorationCap);

            const reputationDetails = [];
            let reputationRaw = 0;
            const factions = stat.世界 && stat.世界.势力 && typeof stat.世界.势力 === 'object' ? stat.世界.势力 : {};
            if (!isSingleWorld) {
              Object.keys(factions).forEach(function(name) {
                const entry = factions[name] || {};
                const reputation = Number(entry.声望) || 0;
                if (reputation <= 0) return;
                const subtotal = base * reputation / 100;
                reputationRaw += subtotal;
                reputationDetails.push({ name:name, reputation:reputation, subtotal:subtotal });
              });
            }
            const reputationCap = base * 3;
            const reputationReward = isSingleWorld ? 0 : Math.min(reputationRaw, reputationCap);

            const totalReward = taskReward + killReward + explorationReward + reputationReward - penalty;
            const balanceBefore = Number(stat.角色 && stat.角色.空间币) || 0;
            const balanceAfter = balanceBefore + totalReward;
            return {
              isSingleWorld:isSingleWorld,
              base:base,
              taskRewardDetails:taskRewardDetails,
              taskReward:taskReward,
              penaltyDetails:penaltyDetails,
              penalty:penalty,
              killDetails:killDetails,
              killRaw:killRaw,
              killCap:killCap,
              killReward:killReward,
              explorationDetails:explorationDetails,
              explorationRaw:explorationRaw,
              explorationCap:explorationCap,
              explorationReward:explorationReward,
              reputationDetails:reputationDetails,
              reputationRaw:reputationRaw,
              reputationCap:reputationCap,
              reputationReward:reputationReward,
              totalReward:totalReward,
              balanceBefore:balanceBefore,
              balanceAfter:balanceAfter
            };
          }
          // SETTLEMENT_COIN_CORE_END

'''
replace_once('          function clonePlain(value) {', core + '          function clonePlain(value) {', 'insert settlement coin core')

replace_once(
'''          const settlementBaselineData = readSettlementBaselineData();
          const settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);
          // 固定结算前的角色层级，防止旧结算面板为已经普升的层级重复授予资格。''',
'''          const settlementBaselineData = readSettlementBaselineData();
          const settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);
          const spaceCoinSettlement = calculateSpaceCoinSettlement(settlementBaselineData);
          // 固定结算前的角色层级，防止旧结算面板为已经普升的层级重复授予资格。''',
'calculate baseline settlement')

income = r'''          function buildProgrammaticIncomeItems(result) {
            const items = [];
            function sub(name) { items.push({ kind:'sub', sub:'', name:name }); }
            function sum(name, value) { items.push({ kind:'sum', sub:'', name:name, v:fmtNum(value) + ' 空间币' }); }

            sub('主神/试炼任务保底空间币');
            if (result.taskRewardDetails.length) {
              result.taskRewardDetails.forEach(function(x) {
                items.push({ kind:'kv', sub:'主神/试炼任务保底空间币', k:'[' + x.name + ']', v:fmtNum(x.amount) + ' 空间币' });
              });
            } else {
              items.push({ kind:'empty', sub:'主神/试炼任务保底空间币', text:'本次无成功任务空间币奖励' });
            }
            sum('任务空间币合计', result.taskReward);

            sub('击杀目标附加收益明细');
            if (result.killDetails.length) {
              result.killDetails.forEach(function(x) {
                items.push({ kind:'calc', sub:'击杀目标附加收益明细', src:x.tier, formula:fmtNum(x.count) + ' × ' + fmtNum(x.unit), result:fmtNum(x.subtotal) + ' 空间币' });
              });
            } else {
              items.push({ kind:'empty', sub:'击杀目标附加收益明细', text:'本次无击杀收益' });
            }
            sum('击杀奖励合计', result.killRaw);
            sum('击杀奖励上限', result.killCap);
            sum('击杀实际计入收益', result.killReward);

            if (!result.isSingleWorld) {
              sub('世界探索附加收益明细');
              if (result.explorationDetails.length) {
                result.explorationDetails.forEach(function(x) {
                  items.push({ kind:'calc', sub:'世界探索附加收益明细', src:x.name, formula:fmtNum(result.base) + ' × ' + x.progress + '%', result:fmtNum(x.subtotal) + ' 空间币' });
                });
              } else {
                items.push({ kind:'empty', sub:'世界探索附加收益明细', text:'本次无探索收益' });
              }
              sum('探索奖励合计', result.explorationRaw);
              sum('探索奖励上限', result.explorationCap);
              sum('探索实际计入收益', result.explorationReward);

              sub('势力羁绊附加收益明细');
              if (result.reputationDetails.length) {
                result.reputationDetails.forEach(function(x) {
                  items.push({ kind:'calc', sub:'势力羁绊附加收益明细', src:x.name, formula:fmtNum(result.base) + ' × (' + x.reputation + ' ÷ 100)', result:fmtNum(x.subtotal) + ' 空间币' });
                });
              } else {
                items.push({ kind:'empty', sub:'势力羁绊附加收益明细', text:'本次无正声望收益' });
              }
              sum('声望奖励合计', result.reputationRaw);
              sum('声望奖励上限', result.reputationCap);
              sum('声望实际计入收益', result.reputationReward);
            }

            if (result.penaltyDetails.length) {
              sub('失败/未完成空间币惩罚');
              result.penaltyDetails.forEach(function(x) {
                items.push({ kind:'punish', sub:'失败/未完成空间币惩罚', name:x.name, desc:'扣除 ' + fmtNum(x.amount) + ' 空间币' });
              });
              sum('空间币惩罚合计', -result.penalty);
            }

            items.push({ kind:'total', sub:'', num:result.totalReward, text:fmtNum(result.totalReward) + ' 空间币', debt:result.balanceAfter < 0 });
            items.push({ kind:'sum', sub:'', name:'结算后余额', v:fmtNum(result.balanceBefore) + ' → ' + fmtNum(result.balanceAfter) + ' 空间币' });
            return items;
          }

          function injectProgrammaticIncomeStage(d, result) {
            let stage = d.stages.find(function(s) { return s.type === 'income'; });
            if (!stage) {
              stage = { name:'空间币收益核算', type:'income', items:[] };
              const epilogueIndex = d.stages.findIndex(function(s) { return s.type === 'epilogue'; });
              if (epilogueIndex >= 0) d.stages.splice(epilogueIndex, 0, stage);
              else d.stages.push(stage);
            }
            const aiNonCoinItems = (stage.items || []).filter(function(item) {
              if (item.kind === 'calc' || item.kind === 'sum' || item.kind === 'total') return false;
              try { if (/空间币/.test(JSON.stringify(item))) return false; } catch (e) {}
              return true;
            });
            stage.items = buildProgrammaticIncomeItems(result).concat(aiNonCoinItems);
          }

'''
replace_once('          function gradeBadge(v, reincarnator) {', income + '          function gradeBadge(v, reincarnator) {', 'insert income renderer')

replace_once(
'''          const rawText = rawDiv.textContent;
          const d = parseSettlement(rawText);

          let worldName = '';''',
'''          const rawText = rawDiv.textContent;
          const d = parseSettlement(rawText);
          injectProgrammaticIncomeStage(d, spaceCoinSettlement);

          let worldName = '';''',
'inject programmatic stage')

replace_once(
'''              const settlementStat = c.stat_data || c;
              const isSingleWorldSettlement = !!(settlementStat.设置 && settlementStat.设置.单一世界 === true);

              let changed = false;''',
'''              const settlementStat = c.stat_data || c;
              const isSingleWorldSettlement = !!(settlementStat.设置 && settlementStat.设置.单一世界 === true);

              let changed = false;
              if (isLatestPanel && isFullSettlement(rawText) && settlementStat.角色 && Number.isFinite(spaceCoinSettlement.balanceAfter)) {
                const currentCoin = Number(settlementStat.角色.空间币) || 0;
                if (currentCoin !== spaceCoinSettlement.balanceAfter) {
                  settlementStat.角色.空间币 = spaceCoinSettlement.balanceAfter;
                  changed = true;
                }
              }''',
'write deterministic space coin balance')

path.write_text(text, encoding='utf-8')
print('programmatic space-coin settlement patch applied')
