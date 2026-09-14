const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('Regular/结算任务美化.html','utf8');
const taskRules=fs.readFileSync('World Book/⚙️任务与委托系统.txt','utf8');
const updateRules=fs.readFileSync('World Book/[mvu_update]变量更新规则.txt','utf8');

// 当前结算面板即使拿不到 getCurrentMessageId，也必须能安全回落到 latest；
// 但历史结算不能因此改写最新楼层。
assert.match(html,/SETTLEMENT_PANEL_TARGET_START/,'缺少当前结算楼层安全识别器');
assert.match(html,/panelTextBelongsToMessage\(/,'必须校验当前结算文本确实属于 latest 消息');
assert.match(html,/resolveSettlementMessageTarget\(/,'结算写回必须通过统一目标解析器');
assert.doesNotMatch(html,/if \(panelMessageId === null\) return;/,'拿不到楼层号时不得直接放弃当前结算');

// 未完成的晋升试炼只应阻止晋升资格/清理，不应阻止已完成主神任务的空间币结算。
const terminalGateCount=(html.match(/trialTasks\.some\(function\(task\)\{return !isSettlementTaskTerminal\(task\.status\);\}\)/g)||[]).length;
assert.equal(terminalGateCount,1,'试炼未终态只允许在最终清理处拦截，不能拦截整次结算写回');

// 结算核验应以结算前任务快照为主，避免当前楼层 MVU 快照与 EJS 结算结果不同步。
assert.match(html,/const settlementBaselineData = readSettlementBaselineData\(\);[\s\S]*?let trialTasks = extractTrialTasks\(settlementBaselineData\);/,'晋升试炼核验必须优先读取结算前快照');

// 任务状态必须随已确认剧情同步；“状态变化≠流程执行”不能被写成“AI不得更新状态”。
assert.match(taskRules,/目标已明确完成[^\n]*可结算/,'主神/试炼任务目标完成后必须明确同步为可结算');
assert.doesNotMatch(taskRules,/AI不得自动推进状态机/,'不得用笼统禁令阻止变量AI同步任务状态');
assert.match(updateRules,/主神任务\/晋升试炼[^\n]*目标已明确完成[^\n]*可结算/,'变量规则必须明确主神/试炼完成态同步');

console.log('settlement current panel regression passed');
