from pathlib import Path

# One-shot migration: keep reward source text intact, sanitize only the MVU object key.
html_path = Path('Regular/结算任务美化.html')
html = html_path.read_text(encoding='utf-8')
old = """          function parseAchievementReward(reward, fallbackWorld) {\n            const v = String(reward || '').trim();\n            let m = v.match(/^(SSS|SS|S|A|B|C|D|E|F)\\s*级盲盒\\s*[·・]\\s*(.+)$/i);\n            if (!m) m = v.match(/^(SSS|SS|S|A|B|C|D|E|F)\\s*级盲盒\\s*[（(]\\s*([^）)]*)\\s*[）)]$/i);\n            if (!m) m = v.match(/^(SSS|SS|S|A|B|C|D|E|F)\\s*级盲盒\\s*$/i);\n            if (!m) return null;\n            const grade = gradeTier(m[1]);\n            const world = String(m[2] || fallbackWorld || '').replace(/[【】《》]/g, '').trim();\n            return { grade:grade, world:world, name:grade + '级盲盒' + (world ? '·' + world : '') };\n          }\n"""
new = """          function sanitizeMvuObjectKey(value) {\n            return String(value || '')\n              .replace(/[.\\/\\\\]+/g, '·')\n              .replace(/·{2,}/g, '·')\n              .replace(/^·+|·+$/g, '')\n              .trim();\n          }\n\n          function parseAchievementReward(reward, fallbackWorld) {\n            const v = String(reward || '').trim();\n            let m = v.match(/^(SSS|SS|S|A|B|C|D|E|F)\\s*级盲盒\\s*[·・]\\s*(.+)$/i);\n            if (!m) m = v.match(/^(SSS|SS|S|A|B|C|D|E|F)\\s*级盲盒\\s*[（(]\\s*([^）)]*)\\s*[）)]$/i);\n            if (!m) m = v.match(/^(SSS|SS|S|A|B|C|D|E|F)\\s*级盲盒\\s*$/i);\n            if (!m) return null;\n            const grade = gradeTier(m[1]);\n            const world = String(m[2] || fallbackWorld || '').replace(/[【】《》]/g, '').trim();\n            const safeWorldKey = sanitizeMvuObjectKey(world);\n            return { grade:grade, world:world, name:grade + '级盲盒' + (safeWorldKey ? '·' + safeWorldKey : '') };\n          }\n"""
if old not in html:
    raise SystemExit('parseAchievementReward anchor not found')
html_path.write_text(html.replace(old, new, 1), encoding='utf-8')

test_path = Path('tests/settlement-current-panel-regression.cjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace("assert.equal(unsafeReward.world,'Fate·stay night','世界名中的 / 必须替换为安全分隔符');", "assert.equal(unsafeReward.world,'Fate/stay night','奖励来源世界应保留原始作品名');")
test = test.replace("assert.equal(dottedReward.world,'Steins·Gate·Zero','世界名中的 . 与 / 必须统一替换为安全分隔符');", "assert.equal(dottedReward.world,'Steins.Gate/Zero','奖励来源世界应保留原始作品名');")
test_path.write_text(test, encoding='utf-8')
