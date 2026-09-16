const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','script','悬浮球状态栏.js'),'utf8');
new vm.Script(source);

function part(text,start,end){
  const a=text.indexOf(start), b=text.indexOf(end,a);
  assert.ok(a>=0 && b>a, `missing source slice: ${start}`);
  return text.slice(a,b);
}

// 结算按钮：副本内非战斗常驻，不再依赖任务委托方、任务状态或完成度。
assert.doesNotMatch(source,/function isSettlementReadyTask\(task\)/,'settlement button must not inspect task completion');
const settlementPolicy=part(source,'    function shouldShowSettlementButton(sd) {','    /* ===== 18. 顶栏 ===== */');
assert.doesNotMatch(settlementPolicy,/任务|委托方|可结算|可交付|已完成/,'settlement visibility must be independent from task data');
assert.match(settlementPolicy,/return sys\.是否在主神空间 === false && sys\.是否战斗中 !== true;/,'settlement visibility only follows dungeon/combat context');
const shouldShow=new Function(settlementPolicy+';return shouldShowSettlementButton;')();
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:false},任务:{列表:{}}}),true,'dungeon must show settlement even with no completed task');
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:false},任务:{列表:{主线:{委托方:'主神任务',状态:'进行中'}}}}),true,'in-progress task must not hide settlement');
assert.equal(shouldShow({系统状态:{是否在主神空间:true,是否战斗中:false}}),false,'main-god space uses choose-world instead');
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:true}}),false,'combat keeps settlement hidden');
assert.match(source,/function renderTopbar\(world, sys, editMode, sd\)/,'topbar must accept full state');
assert.match(source,/html \+= renderTopbar\(world, sys, editMode, statData\);/,'renderAll must pass actual statData');
assert.match(source,/class="sam-icon-btn choose-world mission-settle"[^>]*data-mission-settle>📋结算任务/,'settlement entry must stay in the topbar');
assert.doesNotMatch(source,/sam-mission-settle-wrap|sam-mission-settle-btn|sam-mission-settle-hint/,'old task-tab settlement UI must stay removed');

// 晋升按钮：实时段位累计达标即显示，即使“是否可试炼”缓存仍是 false。
assert.match(source,/var canTrial = \(score >= TRIAL_SCORE_THRESHOLD\);/,'promotion visibility must use live score');
assert.doesNotMatch(source,/var canTrial = \(st\.是否可试炼 === true\);/,'stale trial cache must not hide promotion actions');
const renderTier=new Function(
  'normalizeLifeTier','TIER_ROMAN','TIER_QUALITY','tierQOfClass','calcTrialScore','TRIAL_SCORE_THRESHOLD','esc',
  part(source,'    function renderTierProgressBar(', '    /* 队友段位累计')+';return renderTierProgressBar;'
)(
  value=>['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'].includes(value)?value:'Ⅰ',
  ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'],
  ['F','E','D','C','B','A','S','SS','SSS'],
  ()=> 'F',
  ()=>45,
  24,
  String
);
const promotionHtml=renderTier({层级:'Ⅰ',最终属性:{}},{},{是否可试炼:false,试炼已完成:false});
assert.match(promotionHtml,/data-tier-act="apply"/,'live score 45/24 must show apply-promotion action');
assert.match(promotionHtml,/sam-tier-infuse-btn/,'live score 45/24 must show source-infusion action');
assert.doesNotMatch(source,/if \(sys\.是否可试炼 !== true \|\| sys\.试炼已完成 === true\)/,'apply click must not reject only because the cache is stale');
assert.match(source,/liveScore < TRIAL_SCORE_THRESHOLD/,'apply click must revalidate the live score');
assert.match(source,/stat\.系统状态\.是否可试炼 = true/,'apply click must repair a stale derived trial cache');

console.log('PASS statusbar keeps dungeon settlement visible and derives promotion actions from live score');
