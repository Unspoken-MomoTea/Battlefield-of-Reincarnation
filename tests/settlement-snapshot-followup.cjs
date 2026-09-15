const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('Regular/结算任务美化.html', 'utf8');

function mustMatch(source, re, label) {
  const m = source.match(re);
  assert.ok(m, label);
  return m[0];
}

const statusHelpers = mustMatch(
  html,
  /const SETTLEMENT_SUCCESS_STATUSES[\s\S]*?function isSettlementTaskTerminal\(value\) \{[^\n]+\}/,
  'missing settlement task status helpers'
);
const coinCore = mustMatch(
  html,
  /\/\/ SETTLEMENT_COIN_CORE_START[\s\S]*?\/\/ SETTLEMENT_COIN_CORE_END/,
  'missing settlement coin core'
);
const snapshotBlock = mustMatch(
  html,
  /\/\/ SETTLEMENT_COIN_SNAPSHOT_V2[\s\S]*?(?=\n          function settlementCoinValue\(data\))/, 
  'missing complete settlement coin snapshot selector'
);
const panelMessageBlock = mustMatch(
  html,
  /\/\/ SETTLEMENT_SRCDOC_MESSAGE_ID_V3[\s\S]*?(?=\n          const ACHIEVEMENT_LOOKBACK)/,
  'missing srcdoc host message id fallback'
);

// about:srcdoc can expose a misleading getCurrentMessageId()=0 while the hosting chat message
// has the real mesid. The concrete host DOM id must win over that placeholder getter value.
const hostMessage = {
  dataset: {},
  getAttribute(name) { return name === 'mesid' ? '10' : null; },
  parentElement: null,
};
const frameElement = {
  dataset: {},
  getAttribute() { return null; },
  parentElement: hostMessage,
};
const panelContext = {
  Number,
  getCurrentMessageId() { return 0; },
  window: { frameElement, parent: null },
  wrapper: null,
};
vm.createContext(panelContext);
vm.runInContext(panelMessageBlock + '\nthis.getPanelMessageId=getPanelMessageId;', panelContext);
assert.equal(panelContext.getPanelMessageId({}), 10, 'srcdoc host mesid must outrank a placeholder getCurrentMessageId()=0');
assert.doesNotMatch(snapshotBlock, /const currentId\s*=\s*Number\(getPanelMessageId\(win\)\)/, 'unresolved panel id must never become message 0 through Number(null)');
assert.match(snapshotBlock, /const panelMessageId\s*=\s*getPanelMessageId\(win\);[\s\S]*const currentId\s*=\s*panelMessageId === null \? null : Number\(panelMessageId\)/, 'space-coin snapshot scan must preserve a null panel id');
assert.match(html, /const numericId\s*=\s*currentId === null \? null : Number\(currentId\)/, 'space-coin balance baseline must preserve a null panel id');

const snapshots = {
  9: { stat_data: { 世界:{名称:'测试世界',难度:'E'}, 任务:{列表:{},击杀:{}}, 角色:{空间币:0}, 设置:{单一世界:false} } },
  8: { stat_data: {
    世界:{名称:'测试世界',难度:'E',探索:{},势力:{}},
    任务:{
      击杀:{Ⅰ:4},
      列表:{
        一:{委托方:'主神空间',状态:'可结算',奖励:'40空间币'},
        二:{委托方:'主神空间',状态:'可结算',奖励:'90空间币'},
        三:{委托方:'主神空间',状态:'可结算',奖励:'90空间币'},
        四:{委托方:'主神空间',状态:'可结算',奖励:'130空间币'},
        五:{委托方:'主神空间',状态:'可结算',奖励:'150空间币'},
      }
    },
    角色:{空间币:0}, 设置:{单一世界:false}
  } },
  7: { stat_data: {
    世界:{名称:'测试世界',难度:'E',探索:{},势力:{ARGUS:{声望:500}}},
    任务:{
      击杀:{Ⅰ:4},
      列表:{
        一:{委托方:'主神空间',状态:'可结算',奖励:'40空间币'},
        二:{委托方:'主神空间',状态:'可结算',奖励:'90空间币'},
        三:{委托方:'主神空间',状态:'可结算',奖励:'90空间币'},
        四:{委托方:'主神空间',状态:'可结算',奖励:'130空间币'},
        五:{委托方:'主神空间',状态:'可结算',奖励:'150空间币'},
      }
    },
    角色:{空间币:0}, 设置:{单一世界:false}
  } },
};

const coinContext = {
  Set, String, Number, Object, Array, Math,
  SETTLEMENT_BASELINE_LOOKBACK: 8,
  settlementBaselineData: snapshots[8],
  settlementSnapshotWorld(data) {
    const stat = data && (data.stat_data || data);
    return String(stat && stat.世界 && stat.世界.名称 || '').trim();
  },
  getPanelMessageId() { return panelContext.getPanelMessageId({}); },
  getMvuContext() {
    return {
      data: snapshots[9],
      win: { Mvu: { getMvuData: ({message_id}) => snapshots[message_id] || null } }
    };
  },
};
vm.createContext(coinContext);
vm.runInContext(
  statusHelpers + '\n' + coinCore + '\n' + snapshotBlock +
  '\nthis.pickCoinBaseline=readSpaceCoinBaselineData;this.calcCoin=calculateSpaceCoinSettlement;',
  coinContext
);
const picked = coinContext.pickCoinBaseline();
assert.equal(picked.stat_data.世界.势力.ARGUS.声望, 500, 'must skip cleaned/partial snapshots and keep scanning for the most complete same-world income snapshot');
const result = coinContext.calcCoin(picked);
assert.equal(result.taskReward, 500, 'task reward should stay commissioner-independent');
assert.equal(result.killReward, 40, 'kill reward should survive snapshot selection');
assert.equal(result.reputationReward, 1500, 'faction reputation must not disappear because a nearer partial snapshot matched first');
assert.equal(result.totalReward, 2040, 'old-save sample with 主神空间 commissioner should settle to 2040 space coins');

const trialIdentityBlock = mustMatch(
  html,
  /function extractTrialTasks\(data\) \{[\s\S]*?(?=\n          function readTrialTasks\(\))/, 
  'missing self-contained trial task extractor'
);
const trialContext = { String, Object, Array, Math };
vm.createContext(trialContext);
vm.runInContext(trialIdentityBlock + '\nthis.extractTrialTasks=extractTrialTasks;', trialContext);
assert.deepEqual(
  Array.from(trialContext.extractTrialTasks({任务:{列表:{旧试炼:{委托方:'普升试炼',状态:'可结算'}}}}).map(x=>x.key)),
  ['旧试炼'],
  'settlement verification must treat 普升试炼 as an exact legacy trial alias'
);
assert.deepEqual(
  Array.from(trialContext.extractTrialTasks({任务:{列表:{普通委托:{委托方:'主神空间',状态:'可结算'}}}})),
  [],
  'broad 主神空间 text must still not turn an ordinary unmarked task into a trial'
);

const injectBlock = mustMatch(
  html,
  /function injectProgrammaticIncomeStage\(d, result\) \{[\s\S]*?(?=\n          function gradeBadge\()/,
  'missing programmatic income stage injector'
);
const injectContext = {
  Set,
  buildProgrammaticIncomeItems() { return [{kind:'program', name:'programmatic'}]; }
};
vm.createContext(injectContext);
vm.runInContext(injectBlock + '\nthis.inject=injectProgrammaticIncomeStage;', injectContext);
const parsed = {stages:[{type:'income',items:[
  {kind:'sub',name:'击杀目标附加收益明细',sub:''},
  {kind:'empty',text:'本次无击杀收益',sub:'击杀目标附加收益明细'},
  {kind:'sub',name:'世界探索附加收益明细',sub:''},
  {kind:'empty',text:'本次无探索收益',sub:'世界探索附加收益明细'},
  {kind:'sub',name:'势力羁绊附加收益明细',sub:''},
  {kind:'empty',text:'本次无正声望收益',sub:'势力羁绊附加收益明细'},
  {kind:'para',text:'应保留的普通结算文本',sub:'其它'},
]}]};
injectContext.inject(parsed, {});
const items = parsed.stages[0].items;
assert.equal(items.filter(x => /击杀目标附加收益明细|世界探索附加收益明细|势力羁绊附加收益明细/.test(String(x.name||x.sub||''))).length, 0, 'legacy duplicate income sections must be removed after the programmatic settlement total');
assert.ok(items.some(x => x.kind === 'program'), 'programmatic income items must remain');
assert.ok(items.some(x => x.text === '应保留的普通结算文本'), 'unrelated AI settlement text must remain');

console.log('PASS settlement snapshot follow-up regressions');
