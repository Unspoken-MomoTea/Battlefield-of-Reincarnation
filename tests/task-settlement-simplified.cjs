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
assert.match(rules, /难度为任务固定等级，与世界难度独立；生成后禁止(?:结算)?改写/);
assert.match(taskRules, /任意状态[\s\S]*角色输入【结算任务】[\s\S]*立即结算；未完成按未完成结算/);
assert.doesNotMatch(mainUi, /\.表现\.完成度|\.表现\.记录/);
assert.doesNotMatch(trialUi, /concat\('表现'|表现\.完成度|表现\.记录/);

assert.match(prompt, /success: status === '可结算'/);
assert.match(prompt, /空间币[^\n]*结算程序|结算程序[^\n]*空间币/);
assert.match(prompt, /非空间币奖励|非空间币部分/);
assert.match(prompt, /禁止[^\n]*计算[^\n]*空间币/);
assert.match(prompt, /任务结算结果/);
assert.doesNotMatch(prompt, /目标击杀单价|收益结算公式|个人最终总收益.*精确结果|结算推演：严格代入公式/);
assert.doesNotMatch(prompt, /settlementRateMultipliers|任务表现评级|任务基础收益合计|表现\.完成度|表现\.记录/);

assert.match(settleUi, /SETTLEMENT_COIN_CORE_START/);
assert.match(settleUi, /function calculateSpaceCoinSettlement\s*\(/);
assert.match(settleUi, /function injectProgrammaticIncomeStage\s*\(/);
assert.match(settleUi, /killCap\s*=\s*base\s*\*\s*10/);
assert.match(settleUi, /explorationCap\s*=\s*base\s*\*\s*3/);
assert.match(settleUi, /reputationCap\s*=\s*base\s*\*\s*3/);
assert.match(settleUi, /settlementStat\.角色\.空间币\s*=\s*spaceCoinSettlement\.balanceAfter/);
assert.doesNotMatch(settleUi, /function taskSucceeded\(task\)|function taskCompletion\(task\)|taskAssess|\.st-task-assess/);
assert.match(settleUi, /settlementTaskKeys\.forEach/);

const coreMatch = settleUi.match(/\/\/ SETTLEMENT_COIN_CORE_START([\s\S]*?)\/\/ SETTLEMENT_COIN_CORE_END/);
assert(coreMatch, 'settlement coin core should be extractable for deterministic regression');
const core = new Function(coreMatch[1] + '\nreturn { calculateSpaceCoinSettlement, stripSpaceCoinText };')();

const baseline = {
  stat_data: {
    设置: { 单一世界: false },
    角色: { 空间币: 1000 },
    世界: {
      难度: 'C~A',
      探索: {
        港区: { 探索度: 100 },
        地下区: { 探索度: 100 },
        高塔: { 探索度: 100 },
        外环: { 探索度: 100 },
      },
      势力: {
        联盟: { 声望: 100 },
        王庭: { 声望: 300 },
        敌军: { 声望: -5000 },
      },
    },
    任务: {
      击杀: { Ⅰ: 0, Ⅱ: 0, Ⅲ: 0, Ⅳ: 200, Ⅴ: 0, Ⅵ: 0, Ⅶ: 0, Ⅷ: 0, Ⅸ: 0 },
      列表: {
        主线: { 委托方: '主神任务', 状态: '可结算', 奖励: '5000空间币；A级治疗凭证×1', 惩罚: '' },
        试炼: { 委托方: '晋升试炼', 状态: '失败', 奖励: '99999空间币', 惩罚: '扣除2000空间币；深渊标记' },
        本土: { 委托方: '世界委托', 状态: '可结算', 奖励: '88888空间币', 惩罚: '' },
      },
    },
  },
};

const ordinary = core.calculateSpaceCoinSettlement(baseline);
assert.equal(ordinary.base, 12000);
assert.equal(ordinary.taskReward, 5000, 'only successful main/trial task coin rewards count');
assert.equal(ordinary.killRaw, 240000);
assert.equal(ordinary.killCap, 120000);
assert.equal(ordinary.killReward, 120000, 'kill reward must respect x10 cap');
assert.equal(ordinary.explorationRaw, 48000);
assert.equal(ordinary.explorationCap, 36000);
assert.equal(ordinary.explorationReward, 36000, 'exploration reward must respect x3 cap');
assert.equal(ordinary.reputationRaw, 48000);
assert.equal(ordinary.reputationCap, 36000);
assert.equal(ordinary.reputationReward, 36000, 'positive reputation only and x3 cap');
assert.equal(ordinary.penalty, 2000);
assert.equal(ordinary.totalReward, 195000);
assert.equal(ordinary.balanceBefore, 1000);
assert.equal(ordinary.balanceAfter, 196000);
assert.equal(core.stripSpaceCoinText('5000空间币；A级治疗凭证×1'), 'A级治疗凭证×1');
assert.equal(core.stripSpaceCoinText('大量空间币；深渊标记'), '深渊标记');

const singleData = JSON.parse(JSON.stringify(baseline));
singleData.stat_data.设置.单一世界 = true;
const single = core.calculateSpaceCoinSettlement(singleData);
assert.equal(single.taskReward, 5000);
assert.equal(single.killReward, 120000);
assert.equal(single.explorationReward, 0, 'single-world settlement must not cash exploration');
assert.equal(single.reputationReward, 0, 'single-world settlement must not cash faction reputation');
assert.equal(single.totalReward, 123000);
assert.equal(single.balanceAfter, 124000);

for (const [name, html] of [['主神任务美化', mainUi], ['试炼任务美化', trialUi], ['结算任务美化', settleUi]]) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert(scripts.length > 0, name + ' should contain inline script');
  for (const script of scripts) new Function(script);
}

console.log('simplified task settlement regression: OK');
