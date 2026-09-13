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

assert.match(prompt, /success: SETTLEMENT_SUCCESS_STATUSES\.has\(status\)/);
assert.match(prompt, /failed: SETTLEMENT_FAILURE_STATUSES\.has\(status\)/);
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
assert.match(settleUi, /SETTLEMENT_CREDENTIAL_CORE_START/);
assert.match(settleUi, /function resolveCredentialDecision\s*\(/);
assert.match(settleUi, /const credentialDecision = resolveCredentialDecision\(settlementBaselineData\)/);
assert.match(settleUi, /renderCredentialPanel\(credentialDecision\)/);
assert.match(settleUi, /settlementStat\.角色\.空间币\s*=\s*spaceCoinSettlement\.balanceAfter/);
assert.doesNotMatch(settleUi, /function taskSucceeded\(task\)|function taskCompletion\(task\)|taskAssess|\.st-task-assess/);
assert.match(settleUi, /settlementTaskKeys\.forEach/);

const coreMatch = settleUi.match(/\/\/ SETTLEMENT_COIN_CORE_START([\s\S]*?)\/\/ SETTLEMENT_COIN_CORE_END/);
assert(coreMatch, 'settlement coin core should be extractable for deterministic regression');
const statusHelperMatch = settleUi.match(/const SETTLEMENT_SUCCESS_STATUSES[\s\S]*?function isSettlementTaskTerminal\(value\) \{[^\n]+\}/);
assert(statusHelperMatch, 'settlement task status helpers should be extractable');
const statusHelper = statusHelperMatch[0];
const core = new Function(statusHelper + '\n' + coreMatch[1] + '\nreturn { calculateSpaceCoinSettlement, stripSpaceCoinText };')();

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
        主线: { 委托方: '主神任务', 状态: '可结算', 难度: 'C', 奖励: '5000空间币；A级治疗凭证×1', 惩罚: '' },
        试炼: { 委托方: '晋升试炼', 状态: '失败', 难度: 'C', 奖励: '99999空间币', 惩罚: '扣除2000空间币；深渊标记' },
        本土: { 委托方: '世界委托', 状态: '可结算', 难度: 'C', 奖励: '88888空间币', 惩罚: '' },
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
assert.equal(ordinary.explorationRaw, 24000);
assert.equal(ordinary.explorationCap, 36000);
assert.equal(ordinary.explorationReward, 24000, 'each 100% exploration target is worth 50% of base and exploration is globally capped at x3');
assert.equal(ordinary.reputationRaw, 48000);
assert.equal(ordinary.reputationCap, 36000);
assert.equal(ordinary.reputationReward, 36000, 'positive reputation keeps the original formula and x3 cap');
assert.equal(ordinary.penalty, 2000);
assert.equal(ordinary.totalReward, 183000);
assert.equal(ordinary.balanceBefore, 1000);
assert.equal(ordinary.balanceAfter, 184000);
assert.equal(core.stripSpaceCoinText('5000空间币；A级治疗凭证×1'), 'A级治疗凭证×1');
assert.equal(core.stripSpaceCoinText('大量空间币；深渊标记'), '深渊标记');

const incompleteExploration = {
  stat_data: {
    设置: { 单一世界: false },
    角色: { 空间币: 0 },
    世界: {
      难度: 'D',
      探索: {
        '帝都·贫民窟外围': { 探索度: 10 },
        '帝都·下水道': { 探索度: 90 },
        '帝都·钟楼': { 探索度: 100 },
      },
      势力: { 帝都守备队: { 声望: 300 } },
    },
    任务: { 击杀: {}, 列表: {} },
  },
};
const incomplete = core.calculateSpaceCoinSettlement(incompleteExploration);
assert.equal(incomplete.base, 2500);
assert.equal(incomplete.explorationDetails.length, 1, 'only 100% exploration targets may enter settlement');
assert.equal(incomplete.explorationReward, 1250, 'one completed exploration target is worth 50% of base');
assert.equal(incomplete.reputationReward, 7500, '300 positive reputation reaches the original x3 cap at D base');
assert.equal(incomplete.totalReward, 8750);

const explorationCapData = JSON.parse(JSON.stringify(incompleteExploration));
explorationCapData.stat_data.世界.探索 = {
  A:{探索度:100}, B:{探索度:100}, C:{探索度:100}, D:{探索度:100}, E:{探索度:100}, F:{探索度:100}, G:{探索度:100}
};
explorationCapData.stat_data.世界.势力 = {};
const cappedExploration = core.calculateSpaceCoinSettlement(explorationCapData);
assert.equal(cappedExploration.explorationRaw, 8750);
assert.equal(cappedExploration.explorationCap, 7500);
assert.equal(cappedExploration.explorationReward, 7500, 'exploration reward must stop at x3 base');

const singleData = JSON.parse(JSON.stringify(baseline));
singleData.stat_data.设置.单一世界 = true;
const single = core.calculateSpaceCoinSettlement(singleData);
assert.equal(single.taskReward, 5000);
assert.equal(single.killReward, 120000);
assert.equal(single.explorationReward, 0, 'single-world settlement must not cash exploration');
assert.equal(single.reputationReward, 0, 'single-world settlement must not cash faction reputation');
assert.equal(single.totalReward, 123000);
assert.equal(single.balanceAfter, 124000);

const credentialMatch = settleUi.match(/\/\/ SETTLEMENT_CREDENTIAL_CORE_START([\s\S]*?)\/\/ SETTLEMENT_CREDENTIAL_CORE_END/);
assert(credentialMatch, 'credential core should be extractable for deterministic regression');
const credentialResolvers = new Function(`
  const GRADES = ['F','E','D','C','B','A','S','SS','SSS'];
  function gradeTier(d) {
    const m = String(d || '').toUpperCase().match(/(SSS|SS|S|A|B|C|D|E|F)/);
    return m ? m[1] : 'F';
  }
  function gradeFloor(v) {
    const s = String(v || '').toUpperCase();
    const all = s.match(/(SSS|SS|S|A|B|C|D|E|F)/g) || [];
    if (!all.length) return '';
    let best = all[0];
    for (const g of all) if (GRADES.indexOf(g) < GRADES.indexOf(best)) best = g;
    return best;
  }
  ${statusHelper}
  ${credentialMatch[1]}
  return { resolveCredentialGrant, resolveCredentialDecision };
`)();
const { resolveCredentialGrant, resolveCredentialDecision } = credentialResolvers;

const failedCredential = resolveCredentialGrant({
  stat_data: {
    设置: { 单一世界: false },
    角色: { 层级: 'Ⅰ' },
    世界: { 难度: 'D~A' },
    任务: { 列表: {
      任务一: { 委托方: '主神任务', 状态: '失败', 难度: 'D' },
      任务二: { 委托方: '主神任务', 状态: '进行中', 难度: 'A' },
    } },
  },
});
assert.equal(failedCredential, null, 'no successful main task means no permission credential');

const failedDecision = resolveCredentialDecision({
  stat_data: {
    设置: { 单一世界: false },
    角色: { 层级: 'Ⅰ' },
    世界: { 难度: 'D~A' },
    任务: { 列表: {
      任务一: { 委托方: '主神任务', 状态: '失败', 难度: 'D' },
      任务二: { 委托方: '主神任务', 状态: '进行中', 难度: 'A' },
    } },
  },
});
assert.equal(failedDecision.granted, false);
assert.equal(failedDecision.reasonCode, 'no_success_task');

const ordinaryCredential = resolveCredentialGrant({
  stat_data: {
    设置: { 单一世界: false },
    角色: { 层级: 'Ⅰ' },
    世界: { 难度: 'D~A' },
    任务: { 列表: {
      任务一: { 委托方: '主神任务', 状态: '可结算', 难度: 'A' },
      任务二: { 委托方: '主神任务', 状态: '失败', 难度: 'SSS' },
    } },
  },
});
assert.equal(ordinaryCredential && ordinaryCredential.grade, 'D', 'ordinary reincarnation worlds grant by world minimum difficulty once any main task succeeds');
assert.equal(ordinaryCredential && ordinaryCredential.basis, '世界最低难度');
assert.equal(ordinaryCredential && ordinaryCredential.playerGrade, 'F');
assert.equal(ordinaryCredential && ordinaryCredential.requiredGrade, 'E');

const singleWorldCredential = resolveCredentialGrant({
  stat_data: {
    设置: { 单一世界: true },
    角色: { 层级: 'Ⅰ' },
    世界: { 难度: 'D~A' },
    任务: { 列表: {
      任务一: { 委托方: '主神任务', 状态: '可结算', 难度: 'C' },
      任务二: { 委托方: '主神任务', 状态: '可结算', 难度: 'B' },
      任务三: { 委托方: '主神任务', 状态: '失败', 难度: 'SSS' },
    } },
  },
});
assert.equal(singleWorldCredential && singleWorldCredential.grade, 'B', 'single-world credential grade comes from the highest successful main-task difficulty');
assert.equal(singleWorldCredential && singleWorldCredential.basis, '成功主神任务最高难度');

const sameGradeDecision = resolveCredentialDecision({
  stat_data: {
    设置: { 单一世界: false },
    角色: { 层级: 'Ⅲ' },
    世界: { 难度: 'D~A' },
    任务: { 列表: {
      任务一: { 委托方: '主神任务', 状态: '可结算', 难度: 'A' },
    } },
  },
});
assert.equal(sameGradeDecision.granted, false);
assert.equal(sameGradeDecision.reasonCode, 'grade_not_high_enough');
assert.equal(sameGradeDecision.sourceGrade, 'D');
assert.equal(sameGradeDecision.playerGrade, 'D');
assert.equal(sameGradeDecision.requiredGrade, 'C');

const maxTierDecision = resolveCredentialDecision({
  stat_data: {
    设置: { 单一世界: false },
    角色: { 层级: 'Ⅸ' },
    世界: { 难度: 'SSS' },
    任务: { 列表: {
      任务一: { 委托方: '主神任务', 状态: '可结算', 难度: 'SSS' },
    } },
  },
});
assert.equal(maxTierDecision.granted, false);
assert.equal(maxTierDecision.reasonCode, 'max_tier');

const credentialPanelMatch = settleUi.match(/          function renderCredentialPanel\(decision\) \{([\s\S]*?)\n          \}\n\n          function trialScore/);
assert(credentialPanelMatch, 'credential explanation panel should be extractable');
const renderCredentialPanel = new Function('escapeHtml', 'gradeBadge', `
  return function renderCredentialPanel(decision) {${credentialPanelMatch[1]}
  };
`)(value => String(value == null ? '' : value), grade => '<span>' + grade + '</span>');
const failedPanelHtml = renderCredentialPanel(failedDecision);
assert.match(failedPanelHtml, /本次未获得权限凭证/);
assert.match(failedPanelHtml, /没有已完成主神任务/);
const sameGradePanelHtml = renderCredentialPanel(sameGradeDecision);
assert.match(sameGradePanelHtml, /最低需C级/);
assert.match(sameGradePanelHtml, /D级未达到门槛/);
const grantedPanelHtml = renderCredentialPanel(ordinaryCredential);
assert.match(grantedPanelHtml, /本次获得【D级权限凭证】×1/);
assert.match(grantedPanelHtml, /世界最低难度 D/);
assert.match(grantedPanelHtml, /当前先驱层级Ⅰ/);

const finalizationMatch = settleUi.match(/          function applySettlementFinalization\(c, isLatestPanel\) \{([\s\S]*?)\n          \}\n\n          async function writeSettlementToMvu/);
assert(finalizationMatch, 'settlement finalization should be extractable');
const applySettlementFinalization = new Function(
  'rawText', 'hasSettlementHeader', 'isFullSettlement', 'isTrialPassed', 'trialTasks', 'readReincarnatorTier', 'settlementBaselineTier', 'settlementTaskKeys',
  `return function applySettlementFinalization(c, isLatestPanel) {${finalizationMatch[1]}\n  };`
)(
  '轮回清算协议',
  () => true,
  () => true,
  () => false,
  [],
  () => 'Ⅰ',
  'Ⅰ',
  []
);
function makeSettlementFinalizeData(singleWorld) {
  return {
    stat_data: {
      设置: { 单一世界: singleWorld },
      角色: { 层级: 'Ⅰ' },
      世界: { 名称: '测试副本', 后台: {}, 异端雷达: {} },
      系统状态: { 是否在主神空间: false },
      任务: { 击杀: {}, 列表: {}, 副本成就: {} },
      传闻: { 街头巷议: {}, 情报交易: {}, 布告与檄文: {} },
      资产: {
        玩家庄园: { 所属对象: ['<user>'], 类型: '固定地产' },
        共管基地: { 所属对象: ['盟友', '<user>'], 类型: '要塞' },
        敌军据点: { 所属对象: ['敌军'], 类型: '要塞' },
        无主遗迹: { 所属对象: [], 类型: '固定地产' },
        旧版玩家资产: { 类型: '固定地产' },
      },
    },
  };
}
const ordinaryFinalize = makeSettlementFinalizeData(false);
assert.equal(applySettlementFinalization(ordinaryFinalize, true), true);
assert.deepEqual(
  Object.keys(ordinaryFinalize.stat_data.资产).sort(),
  ['玩家庄园', '共管基地', '旧版玩家资产'].sort(),
  'ordinary dungeon settlement must remove assets whose owners do not include <user>'
);
assert.equal(ordinaryFinalize.stat_data.系统状态.是否在主神空间, true);
const singleFinalize = makeSettlementFinalizeData(true);
applySettlementFinalization(singleFinalize, true);
assert.ok(singleFinalize.stat_data.资产.敌军据点, 'single-world stage settlement must not clear world assets');
assert.ok(singleFinalize.stat_data.资产.无主遗迹, 'single-world stage settlement must keep unowned world assets');

for (const [name, html] of [['主神任务美化', mainUi], ['试炼任务美化', trialUi], ['结算任务美化', settleUi]]) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert(scripts.length > 0, name + ' should contain inline script');
  for (const script of scripts) new Function(script);
}

console.log('simplified task settlement regression: OK');
