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
  /\/\/ SETTLEMENT_COIN_LATEST_FREEZE_V3[\s\S]*?(?=\n          function settlementCoinValue\(data\))/, 
  'missing latest-only settlement coin snapshot cache'
);
const panelMessageBlock = mustMatch(
  html,
  /\/\/ SETTLEMENT_SRCDOC_MESSAGE_ID_V3[\s\S]*?(?=\n          const ACHIEVEMENT_LOOKBACK)/,
  'missing srcdoc host message id fallback'
);

// about:srcdoc message-id recovery remains useful for message markers and other settlement logic,
// but space-coin reward data itself must not depend on message ids or historical lookback.
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
  window: { frameElement, parent: null },
  wrapper: null,
};
vm.createContext(panelContext);
vm.runInContext(panelMessageBlock + '\nthis.getPanelMessageId=getPanelMessageId;', panelContext);
assert.equal(panelContext.getPanelMessageId({}), 10, 'srcdoc panel must still resolve its host mesid');

const full = { stat_data: {
  世界:{名称:'《X特遣队：全员集结》',难度:'E~C',探索:{},势力:{ARGUS:{声望:500}}},
  任务:{
    击杀:{Ⅰ:4},
    列表:{
      撕裂雨林封锁线:{委托方:'主神空间',状态:'可结算',奖励:'40空间币'},
      约顿海姆暗室破拆:{委托方:'主神空间',状态:'可结算',奖励:'90空间币'},
      阻断异端收割链:{委托方:'主神空间',状态:'可结算',奖励:'90空间币'},
      巨物足肢断裂战:{委托方:'主神空间',状态:'可结算',奖励:'130空间币'},
      征服者之瞳穿刺:{委托方:'主神空间',状态:'可结算',奖励:'150空间币'},
    }
  },
  角色:{空间币:0}, 设置:{单一世界:false}
} };
const partial = { stat_data: {
  世界:{名称:'《X特遣队：全员集结》',难度:'E~C',探索:{},势力:{}},
  任务:{击杀:{Ⅰ:4},列表:{
    撕裂雨林封锁线:{委托方:'主神空间',状态:'可结算',奖励:'40空间币'},
    约顿海姆暗室破拆:{委托方:'主神空间',状态:'可结算',奖励:'90空间币'},
  }},
  角色:{空间币:0}, 设置:{单一世界:false}
} };
const cleaned = { stat_data: {
  世界:{名称:'主神空间',难度:'',探索:{},势力:{}},
  任务:{击杀:{},列表:{}},
  角色:{空间币:0}, 设置:{单一世界:false}
} };

let latest = full;
const coinContext = {
  Set, String, Number, Object, Array, Math,
  getMvuContext() { return { data: latest, stat: latest.stat_data, win:{} }; },
};
vm.createContext(coinContext);
vm.runInContext(
  statusHelpers + '\n' + coinCore + '\n' + snapshotBlock +
  '\nthis.refreshCoinData=refreshSpaceCoinBaselineData;this.calcCoin=calculateSpaceCoinSettlement;',
  coinContext
);

// Real failure mode: full latest is seen first, then settlement finalization clears latest.
// A later 250/600ms refresh must never downgrade the already captured income snapshot to zero.
let cached = coinContext.refreshCoinData(null);
let result = coinContext.calcCoin(cached);
assert.equal(result.taskReward, 500, 'explicit task rewards must ignore commissioner identity');
assert.equal(result.killReward, 40, 'kill reward must come from the captured latest MVU');
assert.equal(result.reputationReward, 1500, 'reputation reward must come from the captured latest MVU');
assert.equal(result.totalReward, 2040, 'full latest MVU must settle to 2040 space coins');

latest = cleaned;
cached = coinContext.refreshCoinData(cached);
result = coinContext.calcCoin(cached);
assert.equal(result.totalReward, 2040, 'cleanup refresh must not overwrite a complete coin snapshot with cleaned latest MVU');

// The opposite direction is allowed: if variables finish later, a more complete latest MVU must upgrade the cache.
latest = partial;
let upgrading = coinContext.refreshCoinData(null);
assert.equal(coinContext.calcCoin(upgrading).totalReward, 170, 'partial latest should be usable temporarily');
latest = full;
upgrading = coinContext.refreshCoinData(upgrading);
assert.equal(coinContext.calcCoin(upgrading).totalReward, 2040, 'later complete latest MVU must upgrade the cached coin snapshot');

// Money data must be latest-only and completely independent from task/trial identity and historical-floor selection.
assert.doesNotMatch(snapshotBlock, /settlementBaselineData|extractTrialTasks|settlementTaskKeysForData|委托方|getPanelMessageId|SETTLEMENT_BASELINE_LOOKBACK|message_id\s*:/, 'space-coin data cache must not depend on trial identity or historical MVU floors');
assert.match(snapshotBlock, /getMvuContext\(\)/, 'space-coin data cache must read the current latest MVU context');

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

console.log('PASS settlement latest-MVU coin freeze regressions');
