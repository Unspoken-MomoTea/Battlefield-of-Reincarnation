const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('Regular/结算任务美化.html', 'utf8');
const coreMatch = html.match(/\/\/ SETTLEMENT_COIN_CORE_START([\s\S]*?)\/\/ SETTLEMENT_COIN_CORE_END/);
assert(coreMatch, 'settlement coin core should be extractable');
const statusHelperMatch = html.match(/const SETTLEMENT_SUCCESS_STATUSES[\s\S]*?function isSettlementTaskTerminal\(value\) \{[^\n]+\}/);
assert(statusHelperMatch, 'settlement task status helpers should be extractable');
const core = new Function(statusHelperMatch[0] + '\n' + coreMatch[1] + '\nreturn { calculateSpaceCoinSettlement };')();

const corruptedLegacyTrial = {
  stat_data: {
    设置: { 单一世界: false },
    角色: { 空间币: 0 },
    世界: {
      名称: '和平使者',
      难度: 'E~C',
      探索: {
        '约顿海姆要塞-地下三层生化区': { 探索度: 90 },
        '红花市-老城区地下防洪排水枢纽': { 探索度: 90 },
      },
      势力: {
        '科托马耳他军政府': { 声望: -1000 },
        'ARGUS / X特遣队': { 声望: 500 },
      },
    },
    任务: {
      列表: {
        '撕裂雨林封锁线': { 委托方: '主神空间', 状态: '可结算', 奖励: '40空间币', 惩罚: '' },
        '约顿海姆暗室破拆': { 委托方: '主神空间', 状态: '可结算', 奖励: '90空间币', 惩罚: '' },
        '阻断异端收割链': { 委托方: '主神空间', 状态: '可结算', 奖励: '90空间币', 惩罚: '' },
        '巨物足肢断裂战': { 委托方: '主神空间', 状态: '可结算', 奖励: '130空间币', 惩罚: '' },
        '征服者之瞳穿刺': { 委托方: '主神空间', 状态: '可结算', 奖励: '150空间币', 惩罚: '' },
      },
      击杀: { Ⅰ: 4, Ⅱ: 0, Ⅲ: 0, Ⅳ: 0, Ⅴ: 0, Ⅵ: 0, Ⅶ: 0, Ⅷ: 0, Ⅸ: 0 },
    },
  },
};

const result = core.calculateSpaceCoinSettlement(corruptedLegacyTrial);
assert.equal(result.base, 500, 'E~C must use E as the settlement base');
assert.equal(result.taskReward, 500, 'explicit successful task coin rewards must not depend on commissioner identity');
assert.equal(result.killReward, 40, 'kill income must remain independent from task identity');
assert.equal(result.explorationReward, 0, 'only 100% exploration entries cash out');
assert.equal(result.reputationRaw, 2500);
assert.equal(result.reputationCap, 1500);
assert.equal(result.reputationReward, 1500, 'positive reputation must still cash out when task identity is corrupted');
assert.equal(result.totalReward, 2040);

const arbitraryTaskIdentity = JSON.parse(JSON.stringify(corruptedLegacyTrial));
arbitraryTaskIdentity.stat_data.世界.势力 = {};
arbitraryTaskIdentity.stat_data.任务.击杀 = {};
arbitraryTaskIdentity.stat_data.任务.列表 = {
  '未知来源成功任务': { 委托方: '世界委托', 状态: '可结算', 奖励: '70空间币', 惩罚: '' },
  '未知来源失败任务': { 委托方: '某组织', 状态: '失败', 奖励: '', 惩罚: '扣除20空间币' },
  '仍在进行任务': { 委托方: '', 状态: '进行中', 奖励: '999空间币', 惩罚: '扣除999空间币' },
};
const arbitrary = core.calculateSpaceCoinSettlement(arbitraryTaskIdentity);
assert.equal(arbitrary.taskReward, 70, 'successful explicit coin rewards are data facts, not commissioner permissions');
assert.equal(arbitrary.penalty, 20, 'explicit failed-task coin penalties are also commissioner-independent');
assert.equal(arbitrary.totalReward, 50);

assert.match(html, /function refreshSpaceCoinBaselineData\s*\(/, 'coin settlement needs its own latest-MVU snapshot cache');
assert.match(html, /spaceCoinBaselineData\s*=\s*refreshSpaceCoinBaselineData\(spaceCoinBaselineData\)/, 'coin refresh must preserve the best latest-MVU snapshot instead of reusing task identity');
assert.match(html, /calculateSpaceCoinSettlement\(spaceCoinBaselineData\)/, 'coin calculation must stay on the coin-only snapshot cache');

console.log('PASS settlement coin rewards are independent from task identity and task-baseline recognition');
