const fs = require('fs');
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
