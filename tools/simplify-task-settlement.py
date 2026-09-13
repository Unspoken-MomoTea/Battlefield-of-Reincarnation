from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8', newline='\n')


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: replacement mismatch ({count}) for {old[:100]!r}')
    write(path, text.replace(old, new, 1))


# 1) Remove the temporary per-task performance ledger.
replace_once(
    'script/ZOD脚本.js',
    "            惩罚: safeStr(''),\n            表现: z.object({\n                完成度: clampNum(0, 0, 100),\n                记录: z.record(z.string(), clampNum(0, -2, 2)).prefault({}).transform(items =>\n                    Object.fromEntries(Object.entries(items).filter(([, v]) => [-2, -1, 1, 2].includes(v)))\n                )\n            }).prefault({})",
    "            惩罚: safeStr('')"
)

replace_once(
    'World Book/[mvu_update]变量更新规则.txt',
    "            惩罚: string;\n            表现: {\n              完成度: number;\n              记录: { [事实: string]: -2 | -1 | 1 | 2; };\n            };",
    "            惩罚: string;"
)
replace_once(
    'World Book/[mvu_update]变量更新规则.txt',
    "        - 难度用于任务收益评级，与世界难度独立，生成时锁定，禁止结算改写\n        - 表现.完成度只计核心目标实际推进，范围0~100；可结算=100，失败保留失败时进度\n        - 表现.记录只记改变任务成果的额外事实：+1额外成果/+2决定性成果/-1重大缺憾/-2严重破坏\n        - 正常完成不记分；同一事实仅保留1条，事实失效时remove",
    "        - 难度为任务固定等级，与世界难度独立；生成后禁止结算改写"
)

# 2) Generated tasks no longer initialize extra judging fields.
replace_once(
    'Regular/主神任务美化.html',
    "                win._.set(c, key + '.惩罚', t.punish || '');\n                win._.set(c, key + '.表现.完成度', 0);\n                win._.set(c, key + '.表现.记录', {});",
    "                win._.set(c, key + '.惩罚', t.punish || '');"
)
replace_once(
    'Regular/试炼任务美化.html',
    "            set(c,taskPath.concat('惩罚'),task.punish || '本次晋升试炼失败');\n            set(c,taskPath.concat('表现','完成度'),0);\n            set(c,taskPath.concat('表现','记录'),{});",
    "            set(c,taskPath.concat('惩罚'),task.punish || '本次晋升试炼失败');"
)

# 3) Settlement: task status only. Main space-coin income stays kill/exploration/reputation.
prompt_path = 'World Book/【结算任务】[mvu_plot].txt'
text = read(prompt_path)
calc_pattern = re.compile(
    r"\n  const settlementGradeBases = \{F:100,E:500,D:2500,C:12000,B:50000,A:200000,S:800000,SS:3200000,SSS:12800000\};\n"
    r".*?"
    r"  const settlementUnsuccessfulTasks = settlementTasks\.filter\(item => !item\.success\);\n",
    re.S,
)
calc_repl = """
  const settlementTaskList = _.get(rule_data, '任务.列表', {}) || {};
  const settlementTasks = Object.entries(settlementTaskList)
    .filter(([,task]) => ['主神任务','晋升试炼'].includes(String(task?.委托方 || '').trim()))
    .map(([name,task]) => {
      const status = String(task?.状态 || '').trim();
      return {name, task, status, success: status === '可结算'};
    });
  const settlementSuccessfulTasks = settlementTasks.filter(item => item.success);
  const settlementUnsuccessfulTasks = settlementTasks.filter(item => !item.success);
"""
text, count = calc_pattern.subn(calc_repl, text, count=1)
if count != 1:
    raise SystemExit('settlement prompt: task calculator block mismatch')

replacements = {
    '  - 结算表现为：基于当前剧情阶段的完成度，触发局部的任务清算与收益发放，不脱离当前世界':
        '  - 结算表现为：基于当前剧情阶段触发局部任务清算与收益发放，不脱离当前世界',
    '    - 任务表现: 成功以C为基准，记录净分+1=B/+2=A/≥+3=S/<0=D；失败或未完成时完成度≥50=E，否则F\n    - 模板已锁定每项任务的完成度、评级与基础收益，禁止重算或受等级、装备、世界稳定值影响':
        '    - 任务完成判定: 仅`状态=可结算`视为成功；进行中或失败均不发任务奖励\n    - 任务奖励: 成功任务只发预设【奖励】，禁止额外生成表现收益',
    '    - 任务难度对应基础奖励:\n      F(100) | E(500) | D(2500) | C(1.2万) | B(5万) | A(20万) | S(80万) | SS(320万) | SSS(1280万)\n    - 目标击杀单价:\n      Ⅰ(10) | Ⅱ(50) | Ⅲ(250) | Ⅳ(1200) | Ⅴ(5000) | Ⅵ(2万) | Ⅶ(8万) | Ⅷ(32万) | Ⅸ(128万)\n    - 任务表现评级乘数:\n      S(2.0) | A(1.5) | B(1.2) | C(1.0) | D(0.7) | E(0.5) | F(0.3)':
        '    - 世界难度基础值:\n      F(100) | E(500) | D(2500) | C(1.2万) | B(5万) | A(20万) | S(80万) | SS(320万) | SSS(1280万)\n    - 目标击杀单价:\n      Ⅰ(10) | Ⅱ(50) | Ⅲ(250) | Ⅳ(1200) | Ⅴ(5000) | Ⅵ(2万) | Ⅶ(8万) | Ⅷ(32万) | Ⅸ(128万)',
    '    - 任务基础收益合计 = Σ(各任务难度基础奖励 × 各任务表现评级乘数)\n    - 击杀目标附加收益 = Σ(各目标自身评级对应单价 × 击杀数量)。总额上限: 任务基础收益合计 × 10':
        '    - 击杀目标附加收益 = Σ(各目标自身评级对应单价 × 击杀数量)，上限=世界难度基础值×10',
    '    - 逐任务采用模板锁定的表现评级与基础收益，禁止重新打分':
        '    - 读取任务状态与预设奖励，不进行表现评分',
    '    - 结算推演：严格代入公式，输出不可篡改的数学结果 (总收益 = 任务基础收益 + 附加 + 专属空间币奖励 - 惩罚扣除)':
        '    - 结算推演：严格代入公式，总收益=击杀+探索/声望+成功任务空间币奖励-惩罚扣除',
    '* **任务基础收益合计**: **<%= settlementTaskBaseTotal %>** 空间币\n': '',
    '* **击杀奖励上限**: **<%= settlementTaskBaseTotal * 10 %>** 空间币':
        '* **击杀奖励上限**: **<%= reputationBase * 10 %>** 空间币',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit('settlement prompt: missing anchor ' + old[:100])
    text = text.replace(old, new, 1)

assess_old = """* **任务表现明细**:
<%_ if (settlementTasks.length) { _%>
<%_ settlementTasks.forEach(item => { _%>
    * **任务｜<%- item.name %>**: 难度 <%- item.grade %> | 完成度 <%- item.progress %>% | 表现 <%- item.rating %> | 基础收益 <%- item.baseReward %> 空间币 | 依据 <%- item.evidence %>
<%_ }); _%>
<%_ } else { _%>
    * 本次无主神/晋升试炼任务，任务基础收益为0
<%_ } _%>"""
assess_new = """* **任务结算结果**:
<%_ if (settlementTasks.length) { _%>
<%_ settlementTasks.forEach(item => { _%>
    * [<%- item.name %>]: <%- item.success ? '完成' : (item.status === '失败' ? '失败' : '未完成') %>
<%_ }); _%>
<%_ } else { _%>
    * 本次无主神/晋升试炼任务
<%_ } _%>"""
if assess_old not in text:
    raise SystemExit('settlement prompt: task assessment output mismatch')
text = text.replace(assess_old, assess_new, 1)

# Exploration already uses the same world-difficulty base. Keep one shared meaning.
text = text.replace('    - 世界探索附加收益 = 【世界难度最低评级基础奖励】 × 【总探索度%】，上限300%。',
                    '    - 世界探索附加收益 = 【世界难度基础值】 × 【总探索度%】，上限300%。')
text = text.replace('    - 世界附加收益基准: 世界难度为区间时只取最低评级',
                    '    - 世界难度为区间时，收益基础值只取最低评级')
write(prompt_path, text)

# 4) Settlement beautifier: strict task status again; remove performance UI only.
settle_path = 'Regular/结算任务美化.html'
text = read(settle_path)
helper_pattern = re.compile(
    r"\n          function taskCompletion\(task\) \{.*?\n          \}\n\n          function taskSucceeded\(task\) \{.*?\n          \}\n",
    re.S,
)
text, count = helper_pattern.subn('\n', text, count=1)
if count != 1:
    raise SystemExit('settlement html: task performance helper mismatch')

simple_replacements = {
    "                status: String(task.状态 || '').trim(),\n                completion: taskCompletion(task)":
        "                status: String(task.状态 || '').trim()",
    "                if (!taskSucceeded(task)) return;":
        "                if (String(task.状态 || '').trim() !== '可结算') return;",
    "              if (taskSucceeded(task) || task.status === '失败') return sum + 3;":
        "              if (task.status === '可结算' || task.status === '失败') return sum + 3;",
    "            return tasks.length > 0 && tasks.every(function(task) { return taskSucceeded(task); });":
        "            return tasks.length > 0 && tasks.every(function(task) { return task.status === '可结算'; });",
    "            const done = displayTasks.filter(function(task) { return taskSucceeded(task); }).length;":
        "            const done = displayTasks.filter(function(task) { return task.status === '可结算'; }).length;",
    "            const displayPassed = displayTasks.every(function(task) { return taskSucceeded(task); });":
        "            const displayPassed = displayTasks.every(function(task) { return task.status === '可结算'; });",
    "              if (taskSucceeded(task)) { cls = 'ok'; label = '已完成'; }":
        "              if (task.status === '可结算') { cls = 'ok'; label = '已完成'; }",
}
for old, new in simple_replacements.items():
    if old not in text:
        raise SystemExit('settlement html: missing anchor ' + old[:100])
    text = text.replace(old, new, 1)

css_old = """      .st-task-assess{margin:7px 0;padding:10px 12px;border:1px solid rgba(46,230,255,.16);border-left:3px solid var(--st-cyan);border-radius:7px;background:rgba(46,230,255,.035)}
      .st-task-assess-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.st-task-assess-name{flex:1;min-width:180px;font-weight:800;color:#dff8fc}.st-task-assess-meta{display:flex;gap:7px;align-items:center;color:var(--st-text-dim);font-size:.78em}.st-task-assess-evidence{margin-top:5px;color:#aebdca;font-size:.78em}.st-task-assess-reward{color:var(--st-gold);font-weight:800}
"""
if css_old not in text:
    raise SystemExit('settlement html: task assessment css mismatch')
text = text.replace(css_old, '', 1)

parser_pattern = re.compile(
    r"\n              if \(\(m = body\.match\(/\^\\\*\{0,2\}任务.*?push\('taskAssess'.*?\n              \}\n",
    re.S,
)
text, count = parser_pattern.subn('\n', text, count=1)
if count != 1:
    raise SystemExit('settlement html: task assessment parser mismatch')

render_pattern = re.compile(r"              case 'taskAssess':\n                return .*?;\n", re.S)
text, count = render_pattern.subn('', text, count=1)
if count != 1:
    raise SystemExit('settlement html: task assessment renderer mismatch')

# Keep the exact pre-settlement task-key cleanup fix.
if 'settlementTaskKeys.forEach(function(taskKey)' not in text:
    raise SystemExit('settlement html: exact task cleanup was lost')
write(settle_path, text)

# 5) Replace the temporary performance regression with a permanent simplicity regression.
old_test = ROOT / 'tests/task-performance-settlement.cjs'
if old_test.exists():
    old_test.unlink()

new_test = r"""const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const zod = read('script/ZOD脚本.js');
const rules = read('World Book/[mvu_update]变量更新规则.txt');
const taskRules = read('World Book/⚙️任务与委托系统.txt');
const prompt = read('World Book/【结算任务】[mvu_plot].txt');
const mainUi = read('Regular/主神任务美化.html');
const trialUi = read('Regular/试炼任务美化.html');
const settleUi = read('Regular/结算任务美化.html');

assert.doesNotMatch(zod, /表现:\s*z\.object|表现\.完成度|表现\.记录/);
assert.doesNotMatch(rules, /表现\.完成度|表现\.记录|额外成果|决定性成果/);
assert.match(rules, /难度为任务固定等级，与世界难度独立；生成后禁止结算改写/);
assert.match(taskRules, /任意状态[\s\S]*角色输入【结算任务】[\s\S]*立即结算；未完成按未完成结算/);
assert.doesNotMatch(mainUi, /\.表现\.完成度|\.表现\.记录/);
assert.doesNotMatch(trialUi, /concat\('表现'|表现\.完成度|表现\.记录/);

assert.match(prompt, /success: status === '可结算'/);
assert.match(prompt, /任务奖励: 成功任务只发预设【奖励】/);
assert.match(prompt, /击杀奖励上限\*\*: \*\*<%= reputationBase \* 10 %>/);
assert.match(prompt, /任务结算结果/);
assert.doesNotMatch(prompt, /settlementRateMultipliers|任务表现评级|任务基础收益合计|表现\.完成度|表现\.记录/);

assert.doesNotMatch(settleUi, /function taskSucceeded\(task\)|function taskCompletion\(task\)|taskAssess|\.st-task-assess/);
assert.match(settleUi, /if \(String\(task\.状态 \|\| ''\)\.trim\(\) !== '可结算'\) return;/);
assert.match(settleUi, /settlementTaskKeys\.forEach/);

for (const [name, html] of [['主神任务美化', mainUi], ['试炼任务美化', trialUi], ['结算任务美化', settleUi]]) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert(scripts.length > 0, name + ' should contain inline script');
  for (const script of scripts) new Function(script);
}

console.log('simplified task settlement regression: OK');
"""
write('tests/task-settlement-simplified.cjs', new_test)

for workflow in ['.github/workflows/task-awareness-check.yml', '.github/workflows/task-awareness-build.yml']:
    text = read(workflow)
    old = '      - name: Task performance settlement regression\n        run: node tests/task-performance-settlement.cjs'
    new = '      - name: Simplified task settlement regression\n        run: node tests/task-settlement-simplified.cjs'
    if old not in text:
        raise SystemExit(workflow + ': old task regression step missing')
    write(workflow, text.replace(old, new, 1))

# Final static guards.
for path in [
    'script/ZOD脚本.js',
    'World Book/[mvu_update]变量更新规则.txt',
    'Regular/主神任务美化.html',
    'Regular/试炼任务美化.html',
]:
    value = read(path)
    if '表现.完成度' in value or '表现.记录' in value:
        raise SystemExit(path + ': stale performance field remains')

value = read(prompt_path)
for banned in ['settlementRateMultipliers', '任务表现评级', '任务基础收益合计', '表现.完成度', '表现.记录']:
    if banned in value:
        raise SystemExit('settlement prompt stale token: ' + banned)

print('task settlement simplification applied')
