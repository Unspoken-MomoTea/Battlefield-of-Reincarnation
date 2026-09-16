const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'script','悬浮球状态栏.js'),'utf8');
const auxiliary=fs.readFileSync(path.join(root,'script','辅助计算脚本.js'),'utf8').replace(/\r\n/g,'\n');
const variables=fs.readFileSync(path.join(root,'World Book','[variables]当前变量.txt'),'utf8');
new vm.Script(source);
new vm.Script(auxiliary);

function part(text,start,end){
  const a=text.indexOf(start), b=text.indexOf(end,a);
  assert.ok(a>=0 && b>a, `missing source slice: ${start}`);
  return text.slice(a,b);
}

// 用户可见 seam 1：副本内、非战斗时结算入口常驻，与任务完成度无关。
const settlementPolicy=part(source,'    function shouldShowSettlementButton(sd) {','    /* ===== 18. 顶栏 ===== */');
const shouldShow=new Function(settlementPolicy+';return shouldShowSettlementButton;')();
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:false},任务:{列表:{}}}),true);
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:false},任务:{列表:{主线:{状态:'进行中'}}}}),true);
assert.equal(shouldShow({系统状态:{是否在主神空间:true,是否战斗中:false}}),false);
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:true}}),false);

// 用户可见 seam 2：晋升/源力灌注只消费 系统状态.是否可试炼；45/24 本身不能越权打开按钮。
assert.match(source,/var canTrial = \(st\.是否可试炼 === true\);/);
assert.doesNotMatch(source,/var canTrial = \(score >= TRIAL_SCORE_THRESHOLD\);/);
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
const stale=renderTier({层级:'Ⅰ',最终属性:{}},{},{是否可试炼:false,试炼已完成:false});
assert.doesNotMatch(stale,/data-tier-act="apply"|sam-tier-infuse-btn/,'canonical false stays authoritative until the next variable refresh');
const eligible=renderTier({层级:'Ⅰ',最终属性:{}},{},{是否可试炼:true,试炼已完成:false});
assert.match(eligible,/data-tier-act="apply"/);
assert.match(eligible,/sam-tier-infuse-btn/);
assert.match(source,/if \(sys\.是否可试炼 !== true \|\| sys\.试炼已完成 === true\)/,'apply click must honor canonical flag');
assert.doesNotMatch(source,/liveScore < TRIAL_SCORE_THRESHOLD/,'statusbar must not duplicate helper eligibility calculation');

// 程序状态 seam：资格只在统一变量更新链路中维护；不允许再建立加载态旁路。
assert.match(auxiliary,/recalcAllCharacters\(statData, statDataBefore\);[\s\S]{0,420}checkTrialEligibility\(statData\.角色, statData\.系统状态\);/);
assert.match(auxiliary,/eventOn\(Mvu\.events\.VARIABLE_UPDATE_ENDED, onUpdateData\);/);
assert.doesNotMatch(auxiliary,/function reconcileTrialEligibilityState\(/);
assert.doesNotMatch(auxiliary,/reconcileTrialEligibilityState\(\);/);

// 所有权 seam：普通变量 AI 不再看到、也就不能覆盖程序派生的 是否可试炼。
const systemProjection=part(variables,'current.系统状态 = _.omit(data.系统状态 || {}, [',']);');
assert.match(systemProjection,/'是否可试炼'/);

console.log('PASS helper owns trial eligibility through the unified variable-update path; dungeon settlement remains task-independent');
