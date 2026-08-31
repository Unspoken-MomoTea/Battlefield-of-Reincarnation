from pathlib import Path

path = Path('Regular/试炼任务美化.html')
raw = path.read_bytes()
text = raw.decode('utf-8').replace('\r\n', '\n')
crlf = b'\r\n' in raw

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text = text.replace(old, new, 1)

anchor = """        function validate(q) {\n"""
insert = """        // ===== 程序锁定值归一化 =====\n        // 这些字段本来就由 EJS/美化程序按层级、生态计算，AI只负责抄写。\n        // 若AI抄错，不应让整张试炼卡失效；在校验、渲染、落库前统一以程序计算值覆盖。\n        function normalizeLockedTrialData(q) {\n          if (!q || q.status !== '允许') return q;\n          const ex = expectedData(q);\n          if (ex.currentIndex < 0 || ex.targetIndex < 0) return q;\n\n          // 目标品质由目标层级唯一决定。\n          q.grade = ex.targetGrade;\n\n          // 轮回试炼的副本难度由目标品质 + 生态决定，禁止采用AI重算结果。\n          if (q.mode === '轮回试炼') {\n            q.world.副本难度 = ex.difficulty ? ex.difficulty + '级' : q.world.副本难度;\n          }\n\n          // 主任务难度与空间币全部由程序锁定；AI只提供名称、描述、惩罚等内容。\n          q.tasks.forEach(function(task,index){\n            const plan = ex.tasks[index];\n            if (!plan) return;\n            task.diff = plan.grade;\n            task.reward = String(plan.reward) + '空间币';\n          });\n\n          // 六档副本成就奖励品质同样由程序锁定；名称/达成条件仍取AI内容。\n          if (q.mode === '轮回试炼') {\n            const worldName = String(q.world.名称 || '').trim();\n            q.achievements.forEach(function(item,index){\n              const grade = ex.achievementGrades[index];\n              if (!grade) return;\n              item.grade = grade;\n              item.reward = grade + '级盲盒·' + worldName;\n            });\n          }\n          return q;\n        }\n\n"""
replace_once(anchor, insert + anchor, 'normalize helper')

old = """        const rawText = rawTextOf(raw);\n        const q = parseTrial(rawText);\n        const errors = validate(q);\n"""
new = """        const rawText = rawTextOf(raw);\n        const q = parseTrial(rawText);\n        normalizeLockedTrialData(q);\n        const errors = validate(q);\n"""
replace_once(old, new, 'normalize call')

if crlf:
    text = text.replace('\n', '\r\n')
path.write_bytes(text.encode('utf-8'))

check = path.read_bytes().decode('utf-8')
for needle in [
    'function normalizeLockedTrialData(q)',
    "q.world.副本难度 = ex.difficulty ? ex.difficulty + '级'",
    "task.reward = String(plan.reward) + '空间币'",
    "item.reward = grade + '级盲盒·' + worldName",
    'normalizeLockedTrialData(q);',
]:
    if needle not in check:
        raise SystemExit(f'missing expected token: {needle}')
