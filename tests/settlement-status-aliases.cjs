const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('Regular/结算任务美化.html','utf8');

const helperBlock=html.match(/const SETTLEMENT_SUCCESS_STATUSES[\s\S]*?function isSettlementTaskTerminal\(value\) \{[^\n]+\}/);
assert.ok(helperBlock,'结算美化必须集中定义任务完成/失败状态容错');

const context={Set,String};
vm.createContext(context);
vm.runInContext(helperBlock[0]+'\nthis.ok=isSettlementTaskSuccessful;this.fail=isSettlementTaskFailed;this.terminal=isSettlementTaskTerminal;',context);

for(const status of ['可结算','可交付','待结算','结算','已结算','完成','已完成','结算完成']){
  assert.equal(context.ok(status),true,`${status} 应视为任务完成态`);
  assert.equal(context.terminal(status),true,`${status} 应视为可结算终态`);
}
for(const status of ['失败','已失败','任务失败']){
  assert.equal(context.fail(status),true,`${status} 应视为失败态`);
  assert.equal(context.terminal(status),true,`${status} 应视为终态`);
}
for(const status of ['进行中','未知','不可结算','']){
  assert.equal(context.ok(status),false,`${status||'空值'} 不得误判为完成`);
  assert.equal(context.fail(status),false,`${status||'空值'} 不得误判为失败`);
}

assert.match(html,/if \(isSettlementTaskSuccessful\(task\.状态\)\)/,'空间币结算必须复用统一完成态判定，且不得要求任务身份');
assert.match(html,/else if \(isSettlementTaskFailed\(task\.状态\)\)/,'只有明确失败态才能扣任务惩罚');
assert.match(html,/if \(!isSettlementTaskSuccessful\(task\.状态\)\) return;/,'权限凭证必须复用主神任务完成态判定');
assert.match(html,/tasks\.every\(function\(task\) \{ return isSettlementTaskSuccessful\(task\.status\); \}\)/,'晋升试炼通过必须复用完成态判定');
assert.equal((html.match(/trialTasks\.some\(function\(task\)\{return !isSettlementTaskTerminal\(task\.status\);\}\)/g)||[]).length,1,'只有晋升资格与最终清理需要等待试炼进入认可终态，空间币写回不得被阻断');

console.log('settlement status alias regression passed');

// SETTLEMENT_CREDENTIAL_BASELINE_REGRESSION
const worldBook=fs.readFileSync('World Book/【结算任务】[mvu_plot].txt','utf8');
assert.match(worldBook,/const SETTLEMENT_SUCCESS_STATUSES\s*=\s*new Set\(\['可结算','可交付','待结算','结算','已结算','完成','已完成','结算完成'\]\)/,'结算世界书必须与美化器共享完成态别名');
assert.match(worldBook,/success:\s*SETTLEMENT_SUCCESS_STATUSES\.has\(status\)/,'结算世界书必须用完成态集合判定成功');
assert.match(worldBook,/failed:\s*SETTLEMENT_FAILURE_STATUSES\.has\(status\)/,'结算世界书必须只把明确失败态判为失败');
assert.doesNotMatch(worldBook,/仅`状态=可结算`视为成功/,'结算世界书不得继续只认可结算');

const trialIdentityBlock=html.match(/function extractTrialTasks\(data\) \{[\s\S]*?function settlementTaskKeysForData\(data\) \{[\s\S]*?\n          \}(?=\n\n          let achievementBaselineData)/);
assert.ok(trialIdentityBlock,'凭证基线回归必须加载隐藏试炼身份识别器');
const baselineBlock=html.match(/const SETTLEMENT_BASELINE_LOOKBACK\s*=\s*\d+;[\s\S]*?function readSettlementBaselineData\(\) \{[\s\S]*?\n          \}(?=\n\n          \/\/ SETTLEMENT_COIN_SNAPSHOT_V2)/);
assert.ok(baselineBlock,'任务/凭证基线必须保持按任务快照择优，并与空间币独立基线分离');
const snapshots={
  9:{stat_data:{角色:{层级:'Ⅰ'},任务:{列表:{}}}},
  8:{stat_data:{角色:{层级:'Ⅰ'},任务:{列表:{主线:{委托方:'主神任务',状态:'可交付',难度:'D'}}}}},
};
const baselineContext={Object,String,Number,Array,Set,Math};
baselineContext.getMvuContext=()=>({win:{Mvu:{getMvuData:({message_id})=>snapshots[message_id]||null}},data:snapshots[9]});
baselineContext.getPanelMessageId=()=>10;
vm.createContext(baselineContext);
vm.runInContext(trialIdentityBlock[0]+'\n'+baselineBlock[0]+'\nthis.pickSettlementBaseline=readSettlementBaselineData;',baselineContext);
const pickedBaseline=baselineContext.pickSettlementBaseline();
assert.equal(pickedBaseline.stat_data.任务.列表.主线.状态,'可交付','凭证基线必须跳过仅有角色但任务已空的近楼层，继续找到最近任务快照');
