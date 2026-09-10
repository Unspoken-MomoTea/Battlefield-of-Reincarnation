from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / 'tests/world-engine-asset-writeback.cjs'
s = p.read_text(encoding='utf-8')
replacements = {
    "assert.match(zod, /所属对象:\\s*safeStr\\('<user>'\\)/, '旧资产应兼容迁移为玩家所属');": "assert.match(zod, /const assetOwners[\\s\\S]{0,220}z\\.array\\(z\\.string\\(\\)\\)/, '旧资产所属对象应兼容迁移为数组');\nassert.match(zod, /所属对象:\\s*assetOwners/, '资产 Schema 应使用所属对象数组规范器');",
    "assert.match(mvuRules, /所属对象:[\\s\\S]{0,220}个人或势力/, '变量规则必须定义资产归属');": "assert.match(mvuRules, /所属对象:[\\s\\S]{0,260}string\\[\\][\\s\\S]{0,260}(?:多个对象|共同持有|共管|空数组)/, '变量规则必须定义多主体/无主资产归属');",
    "assert.match(assetRules, /所属对象[\\s\\S]{0,220}个人或势力/, '资产规则必须定义个人/势力归属');": "assert.match(assetRules, /所属对象[\\s\\S]{0,320}字符串数组[\\s\\S]{0,320}(?:多方共管|空数组|无主)/, '资产规则必须定义数组、多主体与无主归属');",
    "assert.match(source, /version:12,\\n        builtin:true,\\n        name:'默认设置'/, '资产写回语义变更应升级内置默认提示词到 v12');": "assert.match(source, /version:13,\\n        builtin:true,\\n        name:'默认设置'/, '多主体资产语义应升级内置默认提示词到 v13');",
}
for old, new in replacements.items():
    if old not in s:
        raise SystemExit('stale asset-writeback assertion not found: ' + old[:48])
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('migrated stale asset writeback assertions')
