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
  part(settlement,'          function extractTrialTasks(data) {','          function readTrialTasks() {')+
  ';return extractTrialTasks;'
)();

const legacyCorrupted={
  系统状态:{是否可试炼:true,试炼已完成:false},
  任务:{列表:{
    '断界之门':{委托方:'主神空间',交付:'全部试炼主任务完成后统一结算',状态:'可结算'},
    '【晋升试炼·2】旧制任务':{委托方:'系统',交付:'',状态:'可结算'},
    '普通委托':{委托方:'主神空间',交付:'返回主神空间交付',状态:'可结算'}
  }}
};
assert.deepEqual(
  extractTrialTasks(legacyCorrupted).map(x=>x.key),
  ['断界之门','【晋升试炼·2】旧制任务'],
  'pre-marker saves may recover corrupted trial commissioners only with a program-level trial signature'
);

const ordinary={任务:{列表:{普通委托:{委托方:'主神空间',交付:'返回主神空间交付',状态:'可结算'}}}};
assert.deepEqual(extractTrialTasks(ordinary),[],'主神空间 keyword alone must never convert an ordinary task into a trial');

assert.match(
  trialUi,
  /const hasActive = sys\.是否试炼任务 === true \|\| Object\.keys\(tasks\)\.some/,
  'active hidden trial identity must prevent duplicate trial generation even after commissioner corruption'
);

const coinCore=part(settlement,'          // SETTLEMENT_COIN_CORE_START','          // SETTLEMENT_COIN_CORE_END');
assert.match(coinCore,/全部试炼主任务完成后统一结算/,'legacy trial signature must also participate in coin settlement recognition');
assert.match(coinCore,/晋升试炼\[·\.\]/,'legacy trial database-key format must also participate in coin settlement recognition');

console.log('PASS legacy corrupted trial identity recovery');
