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
  assert.equal(context.ok(status),true,`${status} 应视为主神/试炼任务完成态`);
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

assert.match(html,/const success = isSettlementTaskSuccessful\(task\.状态\)/,'空间币结算必须复用完成态判定');
assert.match(html,/else if \(isSettlementTaskFailed\(task\.状态\)\)/,'只有明确失败态才能扣任务惩罚');
assert.match(html,/if \(!isSettlementTaskSuccessful\(task\.状态\)\) return;/,'权限凭证必须复用主神任务完成态判定');
assert.match(html,/tasks\.every\(function\(task\) \{ return isSettlementTaskSuccessful\(task\.status\); \}\)/,'晋升试炼通过必须复用完成态判定');
assert.equal((html.match(/trialTasks\.some\(function\(task\)\{return !isSettlementTaskTerminal\(task\.status\);\}\)/g)||[]).length,2,'清理与写回都应等待试炼进入认可终态');

console.log('settlement status alias regression passed');
