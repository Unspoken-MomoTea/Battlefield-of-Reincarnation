from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8', newline='\n')


def replace_once(path, old, new):
    text = read(path)
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 replacement, got {count}\nOLD={old[:160]!r}')
    write(path, text.replace(old, new, 1))


def regex_once(path, pattern, repl, flags=0):
    text = read(path)
    new_text, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{path}: regex replacement expected 1, got {count}: {pattern[:160]}')
    write(path, new_text)


# 1) ZOD: every task owns a compact performance ledger.
replace_once(
    'script/ZOD脚本.js',
    "            状态: z.enum(['进行中', '可交付', '可结算', '失败']).prefault('进行中'), // 【修复】收束任务状态\n            惩罚: safeStr('')",
    "            状态: z.enum(['进行中', '可交付', '可结算', '失败']).prefault('进行中'), // 【修复】收束任务状态\n            惩罚: safeStr(''),\n            表现: z.object({\n                完成度: clampNum(0, 0, 100),\n                记录: z.record(z.string(), clampNum(0, -2, 2)).prefault({}).transform(items =>\n                    Object.fromEntries(Object.entries(items).filter(([, v]) => [-2, -1, 1, 2].includes(v)))\n                )\n            }).prefault({})"
)

# 2) Variable AI rules: short, factual, no subjective grading here.
replace_once(
    'World Book/[mvu_update]变量更新规则.txt',
    "            状态: '进行中' | '可交付' | '可结算' | '失败';\n            惩罚: string;",
    "            状态: '进行中' | '可交付' | '可结算' | '失败';\n            惩罚: string;\n            表现: {\n              完成度: number;\n              记录: { [事实: string]: -2 | -1 | 1 | 2; };\n            };"
)
replace_once(
    'World Book/[mvu_update]变量更新规则.txt',
    "        - 难度用于任务收益评级，与世界难度独立，生成时锁定，禁止结算改写\n        - 若有欺诈、埋伏或超阶风险，真实情况写入隐藏真相，不得展示给角色",
    "        - 难度用于任务收益评级，与世界难度独立，生成时锁定，禁止结算改写\n        - 表现.完成度只计核心目标实际推进，范围0~100；可结算=100，失败保留失败时进度\n        - 表现.记录只记改变任务成果的额外事实：+1额外成果/+2决定性成果/-1重大缺憾/-2严重破坏\n        - 正常完成不记分；同一事实仅保留1条，事实失效时remove\n        - 若有欺诈、埋伏或超阶风险，真实情况写入隐藏真相，不得展示给角色"
)

# 3) Canonical task state machine: command always enters settlement.
replace_once(
    'World Book/⚙️任务与委托系统.txt',
    "  主神/试炼任务:\n    进行中\n      ↓\n    可结算\n      ↓ (角色输入【结算任务】)\n    主神结算\n      ↓\n    发奖励\n      ↓\n    remove",
    "  主神/试炼任务:\n    进行中 → 可结算 / 失败\n    任意状态\n      ↓ (角色输入【结算任务】)\n    立即结算；未完成按未完成结算\n      ↓\n    发奖励 / 执行惩罚\n      ↓\n    remove"
)

# 4) Generated tasks start with an empty ledger.
replace_once(
    'Regular/主神任务美化.html',
    "                win._.set(c, key + '.状态', '进行中');\n                win._.set(c, key + '.惩罚', t.punish || '');",
    "                win._.set(c, key + '.状态', '进行中');\n                win._.set(c, key + '.惩罚', t.punish || '');\n                win._.set(c, key + '.表现.完成度', 0);\n                win._.set(c, key + '.表现.记录', {});"
)
replace_once(
    'Regular/试炼任务美化.html',
    "            set(c,taskPath.concat('状态'),'进行中');\n            set(c,taskPath.concat('惩罚'),task.punish || '本次晋升试炼失败');",
    "            set(c,taskPath.concat('状态'),'进行中');\n            set(c,taskPath.concat('惩罚'),task.punish || '本次晋升试炼失败');\n            set(c,taskPath.concat('表现','完成度'),0);\n            set(c,taskPath.concat('表现','记录'),{});"
)

# 5) Settlement prompt: deterministic per-task ratings and rewards.
prompt_path = 'World Book/【结算任务】[mvu_plot].txt'
text = read(prompt_path)
anchor = "  })();\n_%>\n<System_Rules>"
if 'const settlementTasks = Object.entries' not in text:
    if text.count(anchor) != 1:
        raise SystemExit('settlement prompt: top EJS anchor mismatch')
    calc = r'''  })();

  const settlementGradeBases = {F:100,E:500,D:2500,C:12000,B:50000,A:200000,S:800000,SS:3200000,SSS:12800000};
  const settlementRateMultipliers = {S:2,A:1.5,B:1.2,C:1,D:0.7,E:0.5,F:0.3};
  const settlementTaskList = _.get(rule_data, '任务.列表', {}) || {};
  const settlementTasks = Object.entries(settlementTaskList)
    .filter(([,task]) => ['主神任务','晋升试炼'].includes(String(task?.委托方 || '').trim()))
    .map(([name,task]) => {
      const status = String(task?.状态 || '').trim();
      const grade = (String(task?.难度 || '').toUpperCase().match(/SSS|SS|S|A|B|C|D|E|F/) || ['F'])[0];
      const rawProgress = Number(task?.表现?.完成度);
      const progress = status === '可结算' ? 100 : Math.max(0, Math.min(100, Number.isFinite(rawProgress) ? rawProgress : 0));
      const records = task?.表现?.记录 && typeof task.表现.记录 === 'object' ? task.表现.记录 : {};
      const entries = Object.entries(records).filter(([,v]) => [-2,-1,1,2].includes(Number(v)));
      const score = entries.reduce((sum,[,v]) => sum + Number(v), 0);
      const success = status === '可结算' || (status !== '失败' && progress >= 100);
      let rating = 'F';
      if (success) rating = score >= 3 ? 'S' : score === 2 ? 'A' : score === 1 ? 'B' : score < 0 ? 'D' : 'C';
      else rating = progress >= 50 ? 'E' : 'F';
      const baseReward = Math.round((settlementGradeBases[grade] || 100) * (settlementRateMultipliers[rating] || 0.3));
      const evidence = entries.length ? entries.map(([k,v]) => `${k}(${Number(v) > 0 ? '+' : ''}${Number(v)})`).join('、') : '无额外记录';
      return {name, task, status, grade, progress, score, success, rating, baseReward, evidence};
    });
  const settlementTaskBaseTotal = settlementTasks.reduce((sum,item) => sum + item.baseReward, 0);
  const settlementSuccessfulTasks = settlementTasks.filter(item => item.success);
  const settlementUnsuccessfulTasks = settlementTasks.filter(item => !item.success);
_%>
<System_Rules>'''
    text = text.replace(anchor, calc, 1)

text = text.replace(
    "  - 任务清理精准定向: 绝对禁止用 replace 清空整个 `/任务/列表`。必须使用 `remove` 单独移除本次参与结算的【已完成/失败】任务，绝对保留其他【进行中】的任务！",
    "  - 任务清理精准定向: 只移除本次参与结算的主神/试炼任务，保留本土任务及未参与任务"
)

pattern = r"  【核心读取原则 - 绝对禁止脑补】:\n.*?(?=    - 击杀数据读取:)"
replacement = """  【核心读取原则 - 绝对禁止脑补】:\n    - 任务结算对象: 本次所有【主神任务/晋升试炼】；主动结算时未完成任务按未完成结算\n    - 任务表现: 成功以C为基准，记录净分+1=B/+2=A/≥+3=S/<0=D；失败或未完成时完成度≥50=E，否则F\n    - 模板已锁定每项任务的完成度、评级与基础收益，禁止重算或受等级、装备、世界稳定值影响\n<%_ if (!isSingleWorld) { _%>\n    - 世界附加收益基准: 世界难度为区间时只取最低评级\n<%_ } _%>\n"""
text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('settlement prompt: core read rules replacement mismatch')

text = text.replace('    - 奖励基准评级对应基础奖励:', '    - 任务难度对应基础奖励:')
text = text.replace('    - 任务综合基础收益 = 【奖励基准评级对应基础奖励】 × 【任务表现评级乘数】', '    - 任务基础收益合计 = Σ(各任务难度基础奖励 × 各任务表现评级乘数)')
text = text.replace('总额上限: 任务综合基础收益 × 10', '总额上限: 任务基础收益合计 × 10')

think_pattern = r"  调取字典与公式算账 \(严格执行上述读取协议\)：\n.*?(?=    - 惩罚核查:)"
think_repl = "  调取字典与公式算账：\n    - 逐任务采用模板锁定的表现评级与基础收益，禁止重新打分\n"
text, count = re.subn(think_pattern, think_repl, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('settlement prompt: dm_think replacement mismatch')
text = text.replace(' (总收益 = 基础 + 附加 - 惩罚扣除)', ' (总收益 = 任务基础收益 + 附加 + 专属空间币奖励 - 惩罚扣除)')

assess_old = """<%_ if (!isSingleWorld) { _%>\n* **世界难度评级**: {{get_message_variable::stat_data.世界.难度}}\n<%_ } else { _%>\n* **任务难度评级**: ${当前所有可结算或失败的主神任务}\n<%_ } _%>\n* **任务表现评级**: {S/A/B/C/D/E/F 表现评级}"""
assess_new = """<%_ if (!isSingleWorld) { _%>\n* **世界难度评级**: {{get_message_variable::stat_data.世界.难度}}\n<%_ } _%>\n* **任务表现明细**:\n<%_ if (settlementTasks.length) { _%>\n<%_ settlementTasks.forEach(item => { _%>\n    * **任务｜<%- item.name %>**: 难度 <%- item.grade %> | 完成度 <%- item.progress %>% | 表现 <%- item.rating %> | 基础收益 <%- item.baseReward %> 空间币 | 依据 <%- item.evidence %>\n<%_ }); _%>\n<%_ } else { _%>\n    * 本次无主神/晋升试炼任务，任务基础收益为0\n<%_ } _%>"""
if assess_old not in text and assess_new not in text:
    raise SystemExit('settlement prompt: assessment output block mismatch')
text = text.replace(assess_old, assess_new, 1)

if '* **任务基础收益合计**:' not in text:
    text = text.replace('* **击杀目标附加收益明细**:', '* **任务基础收益合计**: **<%= settlementTaskBaseTotal %>** 空间币\n* **击杀目标附加收益明细**:', 1)
text = text.replace('* **击杀奖励上限**: **{任务综合基础收益 × 10}** 空间币', '* **击杀奖励上限**: **<%= settlementTaskBaseTotal * 10 %>** 空间币')

reward_pattern = r"\* \*\*任务专属奖励\*\*:\n    \$\(可结算任务\): \{奖励\}\n\* \*\*失败惩罚执行\*\*:\n    \$\(若存在状态为【失败】的任务，逐项列出：\)\n    \* \[失败的任务名称\]: 强制执行惩罚 -> \{具体惩罚内容\} \$\(若有空间币扣除，标注扣除数值\)\n    \$\(若无失败任务，显示：本次结算无失败任务，无惩罚抵扣。\)"
reward_repl = """* **任务专属奖励**:\n<%_ if (settlementSuccessfulTasks.length) { _%>\n<%_ settlementSuccessfulTasks.forEach(item => { _%>\n    * [<%- item.name %>]: <%- item.task?.奖励 || '无额外专属奖励' %>\n<%_ }); _%>\n<%_ } else { _%>\n    * 本次无成功任务专属奖励\n<%_ } _%>\n* **失败/未完成惩罚**:\n<%_ if (settlementUnsuccessfulTasks.length) { _%>\n<%_ settlementUnsuccessfulTasks.forEach(item => { _%>\n    * [<%- item.name %>]: 强制执行惩罚 -> <%- item.task?.惩罚 || '无额外惩罚' %>\n<%_ }); _%>\n<%_ } else { _%>\n    * 本次无失败或未完成任务\n<%_ } _%>"""
text, count = re.subn(reward_pattern, reward_repl, text, count=1)
if count != 1 and reward_repl not in text:
    raise SystemExit('settlement prompt: task reward/penalty block mismatch')

text = text.replace('**【阶段清算完毕。已完成的任务记录已归档，世界因果继续流转，将重新生成主神任务。】**', '**【阶段清算完毕。本次结算任务已归档，世界因果继续流转，将重新生成主神任务。】**')
write(prompt_path, text)

# 6) Settlement renderer: success fallback, baseline removal, task assessment cards.
settlement_html = 'Regular/结算任务美化.html'
text = read(settlement_html)

if 'function taskSucceeded(task)' not in text:
    anchor = "          function readTrialTasks() {"
    helper = """          function taskCompletion(task) {\n            const direct = Number(task && task.completion);\n            const nested = Number(task && task.表现 && task.表现.完成度);\n            const value = Number.isFinite(direct) ? direct : (Number.isFinite(nested) ? nested : 0);\n            return String(task && task.状态 || '').trim() === '可结算' ? 100 : Math.max(0, Math.min(100, value));\n          }\n\n          function taskSucceeded(task) {\n            const status = String(task && task.状态 || task && task.status || '').trim();\n            return status === '可结算' || (status !== '失败' && taskCompletion(task) >= 100);\n          }\n\n"""
    if text.count(anchor) != 1:
        raise SystemExit('settlement html: readTrialTasks anchor mismatch')
    text = text.replace(anchor, helper + anchor, 1)

text = text.replace(
    "                status: String(task.状态 || '').trim()\n              };",
    "                status: String(task.状态 || '').trim(),\n                completion: taskCompletion(task)\n              };",
    1
)
text = text.replace("                if (String(task.状态 || '').trim() !== '可结算') return;", "                if (!taskSucceeded(task)) return;", 1)
text = text.replace("              if (task.status === '可结算' || task.status === '失败') return sum + 3;", "              if (taskSucceeded(task) || task.status === '失败') return sum + 3;", 1)
text = text.replace("            return tasks.length > 0 && tasks.every(function(task) { return task.status === '可结算'; });", "            return tasks.length > 0 && tasks.every(function(task) { return taskSucceeded(task); });", 1)
text = text.replace("            const done = displayTasks.filter(function(task) { return task.status === '可结算'; }).length;", "            const done = displayTasks.filter(function(task) { return taskSucceeded(task); }).length;", 1)
text = text.replace("            const displayPassed = displayTasks.every(function(task) { return task.status === '可结算'; });", "            const displayPassed = displayTasks.every(function(task) { return taskSucceeded(task); });", 1)
text = text.replace("              if (task.status === '可结算') { cls = 'ok'; label = '已完成'; }", "              if (taskSucceeded(task)) { cls = 'ok'; label = '已完成'; }", 1)

if 'const settlementTaskKeys = readSettlementTaskKeys' not in text:
    anchor = "          const settlementBaselineData = readSettlementBaselineData();"
    block = """          function readSettlementTaskKeys(data) {\n            const stat = data && (data.stat_data || data);\n            const list = stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};\n            return Object.keys(list).filter(function(key) {\n              const commissioner = String(list[key] && list[key].委托方 || '').trim();\n              return commissioner === '主神任务' || commissioner === '晋升试炼';\n            });\n          }\n\n          const settlementBaselineData = readSettlementBaselineData();\n          const settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);"""
    if text.count(anchor) != 1:
        raise SystemExit('settlement html: baseline anchor mismatch')
    text = text.replace(anchor, block, 1)

old_cleanup = """              const taskList = ensureObject(tasks, '列表');\n              Object.keys(taskList).forEach(function(taskKey) {\n                const taskStatus = taskList[taskKey] && taskList[taskKey].状态;\n                if (taskStatus === '可结算' || taskStatus === '失败') {\n                  delete taskList[taskKey];\n                  changed = true;\n                }\n              });"""
new_cleanup = """              const taskList = ensureObject(tasks, '列表');\n              settlementTaskKeys.forEach(function(taskKey) {\n                if (!Object.hasOwn(taskList, taskKey)) return;\n                delete taskList[taskKey];\n                changed = true;\n              });"""
if old_cleanup in text:
    text = text.replace(old_cleanup, new_cleanup, 1)
elif new_cleanup not in text:
    raise SystemExit('settlement html: single-world task cleanup mismatch')

if '.st-task-assess{' not in text:
    css_anchor = '      .st-rate-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 4px 0; font-size: 0.85em; }'
    css = """      .st-task-assess{margin:7px 0;padding:10px 12px;border:1px solid rgba(46,230,255,.16);border-left:3px solid var(--st-cyan);border-radius:7px;background:rgba(46,230,255,.035)}\n      .st-task-assess-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.st-task-assess-name{flex:1;min-width:180px;font-weight:800;color:#dff8fc}.st-task-assess-meta{display:flex;gap:7px;align-items:center;color:var(--st-text-dim);font-size:.78em}.st-task-assess-evidence{margin-top:5px;color:#aebdca;font-size:.78em}.st-task-assess-reward{color:var(--st-gold);font-weight:800}\n""" + css_anchor
    if text.count(css_anchor) != 1:
        raise SystemExit('settlement html: rate css anchor mismatch')
    text = text.replace(css_anchor, css, 1)

if "push('taskAssess'" not in text:
    parse_anchor = "              if ((m = body.match(/^\\*{0,2}[【\\[]?([^*【】\\[\\]：:]{1,22})[】\\]]?\\*{0,2}\\s*[：:]\\s*(.+)$/))) {"
    parser = r'''              if ((m = body.match(/^\*{0,2}任务[｜|]\s*(.+?)\*{0,2}\s*[：:]\s*难度\s*(SSS|SS|S|A|B|C|D|E|F)\s*[｜|]\s*完成度\s*(\d+(?:\.\d+)?)%\s*[｜|]\s*表现\s*(S|A|B|C|D|E|F)\s*[｜|]\s*基础收益\s*(-?[\d,，.]+(?:万)?)\s*空间币\s*[｜|]\s*依据\s*(.+)$/i))) {
                push('taskAssess', { name:stripDecor(m[1]), difficulty:m[2].toUpperCase(), progress:Number(m[3]), rating:m[4].toUpperCase(), reward:parseCnNum(m[5]), evidence:stripDecor(m[6]) });
                continue;
              }

'''
    if text.count(parse_anchor) != 1:
        raise SystemExit('settlement html: kv parser anchor mismatch')
    text = text.replace(parse_anchor, parser + parse_anchor, 1)

if "case 'taskAssess'" not in text:
    render_anchor = "              case 'kv': {"
    render = """              case 'taskAssess':\n                return '<div class=\"st-task-assess\"><div class=\"st-task-assess-head\"><span class=\"st-task-assess-name\">' + escapeHtml(it.name) + '</span><span class=\"st-task-assess-meta\">难度 ' + gradeBadge(it.difficulty, false) + ' · 完成度 ' + escapeHtml(String(it.progress)) + '% · 表现 ' + gradeBadge(it.rating, true) + '</span><span class=\"st-task-assess-reward\">+' + escapeHtml(fmtNum(it.reward || 0)) + ' 空间币</span></div><div class=\"st-task-assess-evidence\">依据：' + escapeHtml(it.evidence || '无额外记录') + '</div></div>';\n""" + render_anchor
    if text.count(render_anchor) != 1:
        raise SystemExit('settlement html: render kv anchor mismatch')
    text = text.replace(render_anchor, render, 1)

write(settlement_html, text)

# 7) Dedicated regression test.
test = r'''const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const assert = require('assert');

const zod = read('script/ZOD脚本.js');
const rules = read('World Book/[mvu_update]变量更新规则.txt');
const taskRules = read('World Book/⚙️任务与委托系统.txt');
const prompt = read('World Book/【结算任务】[mvu_plot].txt');
const mainUi = read('Regular/主神任务美化.html');
const trialUi = read('Regular/试炼任务美化.html');
const settleUi = read('Regular/结算任务美化.html');

assert.match(zod, /表现:\s*z\.object\(\{[\s\S]*完成度:\s*clampNum\(0, 0, 100\)[\s\S]*记录:/);
assert.match(rules, /表现\.完成度只计核心目标实际推进/);
assert.match(rules, /\+1额外成果\/\+2决定性成果\/-1重大缺憾\/-2严重破坏/);
assert.match(taskRules, /任意状态[\s\S]*角色输入【结算任务】[\s\S]*立即结算；未完成按未完成结算/);
assert.match(mainUi, /\.表现\.完成度', 0/);
assert.match(mainUi, /\.表现\.记录', \{\}/);
assert.match(trialUi, /concat\('表现','完成度'\),0/);
assert.match(trialUi, /concat\('表现','记录'\),\{\}/);

assert.match(prompt, /const settlementTasks = Object\.entries/);
assert.match(prompt, /成功以C为基准，记录净分\+1=B\/\+2=A\/≥\+3=S\/<0=D/);
assert.doesNotMatch(prompt, /任务完成率与世界稳定值核算/);
assert.match(prompt, /任务｜<%- item\.name %>/);
assert.match(prompt, /任务基础收益合计 = Σ/);
assert.match(prompt, /settlementTaskBaseTotal \* 10/);
assert.match(prompt, /失败\/未完成惩罚/);

assert.match(settleUi, /function taskSucceeded\(task\)/);
assert.match(settleUi, /const settlementTaskKeys = readSettlementTaskKeys/);
assert.match(settleUi, /settlementTaskKeys\.forEach/);
assert.match(settleUi, /push\('taskAssess'/);
assert.match(settleUi, /case 'taskAssess'/);
assert.doesNotMatch(settleUi, /taskStatus === '可结算' \|\| taskStatus === '失败'/);

for (const [name, html] of [['主神任务美化', mainUi], ['试炼任务美化', trialUi], ['结算任务美化', settleUi]]) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert(scripts.length > 0, name + ' should contain inline script');
  for (const script of scripts) new Function(script);
}

console.log('task performance settlement regression: OK');
'''
write('tests/task-performance-settlement.cjs', test)

print('task performance settlement migration applied')
