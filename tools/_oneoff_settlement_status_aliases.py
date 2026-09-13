from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'Regular' / '结算任务美化.html'
text = PATH.read_text(encoding='utf-8')
TEST_PATH = ROOT / 'tests' / 'task-settlement-simplified.cjs'
test_text = TEST_PATH.read_text(encoding='utf-8')

if 'const SETTLEMENT_SUCCESS_STATUSES' in text and 'const statusHelperMatch = settleUi.match' in test_text:
    print('settlement status alias patch already applied')
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text = text.replace(old, new, 1)


replace_once(
    "          const GRADES = ['F','E','D','C','B','A','S','SS','SSS'];\n",
    "          const GRADES = ['F','E','D','C','B','A','S','SS','SSS'];\n\n"
    "          // 结算容错：主神任务/晋升试炼的完成态允许常见同义写法，避免AI偶发措辞漂移被误判失败。\n"
    "          const SETTLEMENT_SUCCESS_STATUSES = new Set(['可结算','可交付','待结算','结算','已结算','完成','已完成','结算完成']);\n"
    "          const SETTLEMENT_FAILURE_STATUSES = new Set(['失败','已失败','任务失败']);\n"
    "          function settlementTaskStatus(value) { return String(value || '').trim(); }\n"
    "          function isSettlementTaskSuccessful(value) { return SETTLEMENT_SUCCESS_STATUSES.has(settlementTaskStatus(value)); }\n"
    "          function isSettlementTaskFailed(value) { return SETTLEMENT_FAILURE_STATUSES.has(settlementTaskStatus(value)); }\n"
    "          function isSettlementTaskTerminal(value) { return isSettlementTaskSuccessful(value) || isSettlementTaskFailed(value); }\n",
    'insert status helpers'
)

replace_once(
    "              const success = String(task.状态 || '').trim() === '可结算';\n              if (success) {\n                const amount = parseSpaceCoinTotal(task.奖励, false);\n                if (amount > 0) taskRewardDetails.push({ name:name, amount:amount });\n              } else {\n                const amount = parseSpaceCoinTotal(task.惩罚, true);\n                if (amount > 0) penaltyDetails.push({ name:name, amount:amount });\n              }",
    "              const success = isSettlementTaskSuccessful(task.状态);\n              if (success) {\n                const amount = parseSpaceCoinTotal(task.奖励, false);\n                if (amount > 0) taskRewardDetails.push({ name:name, amount:amount });\n              } else if (isSettlementTaskFailed(task.状态)) {\n                const amount = parseSpaceCoinTotal(task.惩罚, true);\n                if (amount > 0) penaltyDetails.push({ name:name, amount:amount });\n              }",
    'coin success/failure decision'
)

replace_once(
    "              if (String(task.状态 || '').trim() !== '可结算') return;",
    "              if (!isSettlementTaskSuccessful(task.状态)) return;",
    'credential success decision'
)

replace_once(
    "          function trialScore(tasks) {\n            return (tasks || []).reduce(function(sum, task) {\n              if (task.status === '可结算' || task.status === '失败') return sum + 3;\n              if (task.status === '可交付') return sum + 2;\n              if (task.status === '进行中') return sum + 1;\n              return sum;\n            }, 0);\n          }",
    "          function trialScore(tasks) {\n            return (tasks || []).reduce(function(sum, task) {\n              if (isSettlementTaskTerminal(task.status)) return sum + 3;\n              if (task.status === '进行中') return sum + 1;\n              return sum;\n            }, 0);\n          }",
    'trial score'
)

replace_once(
    "          function isTrialPassed(tasks) {\n            return tasks.length > 0 && tasks.every(function(task) { return task.status === '可结算'; });\n          }",
    "          function isTrialPassed(tasks) {\n            return tasks.length > 0 && tasks.every(function(task) { return isSettlementTaskSuccessful(task.status); });\n          }",
    'trial pass decision'
)

replace_once(
    "            const done = displayTasks.filter(function(task) { return task.status === '可结算'; }).length;\n            const displayPassed = displayTasks.every(function(task) { return task.status === '可结算'; });",
    "            const done = displayTasks.filter(function(task) { return isSettlementTaskSuccessful(task.status); }).length;\n            const displayPassed = displayTasks.every(function(task) { return isSettlementTaskSuccessful(task.status); });",
    'trial display count'
)

replace_once(
    "              if (task.status === '可结算') { cls = 'ok'; label = '已完成'; }\n              else if (task.status === '失败') { cls = 'bad'; label = '失败'; }\n              else if (task.status === '可交付') { label = '待结算'; }\n              else if (task.status === '进行中') { label = '未完成'; }",
    "              if (isSettlementTaskSuccessful(task.status)) { cls = 'ok'; label = '已完成'; }\n              else if (isSettlementTaskFailed(task.status)) { cls = 'bad'; label = '失败'; }\n              else if (task.status === '进行中') { label = '未完成'; }",
    'trial row status'
)

text = text.replace(
    "trialTasks.some(function(task){return task.status !== '可结算' && task.status !== '失败';})",
    "trialTasks.some(function(task){return !isSettlementTaskTerminal(task.status);})"
)
if text.count("trialTasks.some(function(task){return !isSettlementTaskTerminal(task.status);})") != 2:
    raise SystemExit('terminal guard replacement mismatch')

text = text.replace('只要数据库中的晋升试炼全部可结算就记为完成。', '只要数据库中的晋升试炼全部处于认可完成态就记为完成。')
text = text.replace('等待任务变量落到可结算/失败，避免先清空后再也无法核验晋升资格。', '等待任务变量落到认可完成态/失败，避免先清空后再也无法核验晋升资格。')
PATH.write_text(text, encoding='utf-8', newline='\n')

# 旧的确定性结算测试会单独抽取 coin/credential core；把新状态 helper 一起注入测试沙箱。
def replace_test_once(old: str, new: str, label: str) -> None:
    global test_text
    count = test_text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 test match, got {count}')
    test_text = test_text.replace(old, new, 1)

replace_test_once(
    "const core = new Function(coreMatch[1] + '\\nreturn { calculateSpaceCoinSettlement, stripSpaceCoinText };')();",
    "const statusHelperMatch = settleUi.match(/const SETTLEMENT_SUCCESS_STATUSES[\\s\\S]*?function isSettlementTaskTerminal\\(value\\) \\{[^\\n]+\\}/);\n"
    "assert(statusHelperMatch, 'settlement task status helpers should be extractable');\n"
    "const statusHelper = statusHelperMatch[0];\n"
    "const core = new Function(statusHelper + '\\n' + coreMatch[1] + '\\nreturn { calculateSpaceCoinSettlement, stripSpaceCoinText };')();",
    'coin regression helper injection'
)
replace_test_once(
    "  ${credentialMatch[1]}\n  return { resolveCredentialGrant, resolveCredentialDecision };",
    "  ${statusHelper}\n  ${credentialMatch[1]}\n  return { resolveCredentialGrant, resolveCredentialDecision };",
    'credential regression helper injection'
)
TEST_PATH.write_text(test_text, encoding='utf-8', newline='\n')
print('settlement status alias patch applied')
