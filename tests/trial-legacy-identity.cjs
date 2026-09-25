const assert=require('node:assert/strict');
const fs=require('node:fs');

const settlement=fs.readFileSync('Regular/结算任务美化.html','utf8');
const trialUi=fs.readFileSync('Regular/试炼任务美化.html','utf8');

function part(source,start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`missing block: ${start}`);
  return source.slice(a,b);
}

const extractTrialTasks=new Function(
  part(settlement,'          function isTrialTaskCommissioner(value) {','          function readTrialTasks() {')+
  ';return extractTrialTasks;'
)();

const mixed={
  任务:{列表:{
    '晋升关卡A':{委托方:'晋升试炼',状态:'可结算'},
    '晋升关卡B':{委托方:'普升试炼',状态:'可结算'},
    '晋升关卡C':{委托方:'系统·特殊试炼',状态:'可结算'},
    '普通委托':{委托方:'主神空间',状态:'可结算'}
  }}
};
assert.deepEqual(
  extractTrialTasks(mixed).map(x=>x.key),
  ['晋升关卡A','晋升关卡B','晋升关卡C'],
  'trial extraction must use commissioner trial keywords only'
);

const renamed={
  任务:{列表:{
    '任务名称被AI改坏也无所谓':{委托方:'晋升试炼',状态:'可结算'}
  }}
};
assert.deepEqual(
  extractTrialTasks(renamed).map(x=>x.key),
  ['任务名称被AI改坏也无所谓'],
  'task name must not participate in trial identity'
);

const ordinary={任务:{列表:{普通委托:{委托方:'主神空间',状态:'可结算'}}}};
assert.deepEqual(extractTrialTasks(ordinary),[],'主神空间 keyword alone must never convert an ordinary task into a trial');

assert.match(
  trialUi,
  /const hasActive = sys\.是否试炼任务 === true \|\| Object\.keys\(tasks\)\.some/,
  'active trial marker must still prevent duplicate trial generation'
);
assert.match(trialUi,/\/试炼\/\.test\(String\(t\.委托方/,'duplicate detection must also use commissioner trial keyword');
assert.doesNotMatch(settlement,/试炼任务名单/,'settlement must not depend on task-name lists');

const coinCore=part(settlement,'          // SETTLEMENT_COIN_CORE_START','          // SETTLEMENT_COIN_CORE_END');
assert.match(coinCore,/SETTLEMENT_COIN_TASK_INDEPENDENCE/,'coin settlement must explicitly use task-independent accounting');
assert.doesNotMatch(coinCore,/recognizedTaskKeys/,'trial identity recognition must not gate explicit task coin amounts');

console.log('PASS commissioner-keyword trial identity');
