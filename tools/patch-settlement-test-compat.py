from pathlib import Path

p = Path(__file__).resolve().parents[1] / 'tests/task-settlement-simplified.cjs'
text = p.read_text(encoding='utf-8')
old = "assert.match(taskRules, /任意状态[\\s\\S]*角色输入【结算任务】[\\s\\S]*立即结算；未完成按未完成结算/);"
new = "assert.match(taskRules, /主神\/试炼任务[\\s\\S]*可结算 \/ 失败[\\s\\S]*角色输入【结算任务】[\\s\\S]*立即结算；未完成按未完成结算/);\nassert.match(taskRules, /目标已明确完成立即同步为可结算/);\nassert.match(taskRules, /状态变化≠流程执行；更新状态不得自动发奖、交付、结算或remove/);"
if text.count(old) != 1:
    raise SystemExit(f'expected one old settlement-state assertion, got {text.count(old)}')
p.write_text(text.replace(old, new, 1), encoding='utf-8')
print('settlement task regression expectations updated')
