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

// 正则替换偶发未展开 $1 时，美化器必须能从当前消息原文恢复 <settlement tasks>，
// 否则整个 AI 结算正文会只剩字面量 "$1"，界面只能显示程序后插入的收益区块。
assert.match(html,/function extractSettlementBlock\(/,'必须能从消息原文提取 settlement tasks');
assert.match(html,/function resolveSettlementRawText\(/,'必须提供 $1 捕获失败的运行时恢复');
assert.match(html,/const rawText = resolveSettlementRawText\(/,'实际解析必须使用恢复后的结算正文');

// 未完成的晋升试炼只应阻止晋升资格/清理，不应阻止已完成主神任务的空间币结算。
const terminalGateCount=(html.match(/trialTasks\.some\(function\(task\)\{return !isSettlementTaskTerminal\(task\.status\);\}\)/g)||[]).length;
assert.equal(terminalGateCount,1,'试炼未终态只允许在最终清理处拦截，不能拦截整次结算写回');

// 结算核验不能盲信“最近一份非空快照”。变量更新存在消息级时序差时，
// 必须比较候选快照的任务完成度，并允许当前/latest 的更成熟状态覆盖旧楼层。
assert.match(html,/function settlementSnapshotTaskScore\(/,'缺少任务快照完成度评分');
assert.match(html,/function preferSettlementSnapshot\(/,'缺少任务快照择优逻辑');
assert.match(html,/let settlementBaselineData = readSettlementBaselineData\(\);/,'结算基线必须允许在变量更新完成后升级');

// 成就同样必须择优而不是“当前楼有 6 条就立即返回”。典型回归：当前楼 6 条未达成，
// latest 已经 6 条已达成；UI 必须显示 6/6，且随后清空数据库不能把面板降回 0/6。
assert.match(html,/function achievementTaskScore\(/,'缺少成就快照完成度评分');
assert.match(html,/function preferAchievementTasks\(/,'缺少成就快照择优逻辑');
assert.match(html,/let achievementTasks = readAchievementTasks\(\);/,'成就面板必须允许刷新到更成熟快照');
assert.doesNotMatch(html,/const achievementTasks = readAchievementTasks\(\);/,'成就状态不能在初次渲染时永久冻结');
assert.match(html,/function refreshAchievementTasks\(/,'VARIABLE_UPDATE_ENDED 后必须刷新成就快照');
assert.match(html,/\.st-achievement-host/,'刷新后必须重绘成就面板');

// 任务状态必须随已确认剧情同步；“状态变化≠流程执行”不能被写成“AI不得更新状态”。
assert.match(taskRules,/目标已明确完成[^\n]*可结算/,'主神/试炼任务目标完成后必须明确同步为可结算');
assert.doesNotMatch(taskRules,/AI不得自动推进状态机/,'不得用笼统禁令阻止变量AI同步任务状态');
assert.match(updateRules,/主神任务\/晋升试炼[^\n]*目标已明确完成[^\n]*可结算/,'变量规则必须明确主神/试炼完成态同步');

console.log('settlement current panel regression passed');
