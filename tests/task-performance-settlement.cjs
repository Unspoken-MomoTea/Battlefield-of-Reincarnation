const fs = require('fs');
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
assert.doesNotMatch(prompt, /任务完成率与世界稳定值核算|奖励基准评级对应基础奖励|单一世界不结算/);
assert.match(prompt, /任务专属奖励 = 仅提取本次成功任务/);
assert.match(prompt, /世界难度最低评级基础奖励/);

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
