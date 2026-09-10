from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / 'tests/world-engine-asset-writeback.cjs'
s = p.read_text(encoding='utf-8')
old = "assert.match(zod, /所属对象:\\s*safeStr\\('<user>'\\)/, '旧资产应兼容迁移为玩家所属');"
new = "assert.match(zod, /const assetOwners[\\s\\S]{0,220}z\\.array\\(z\\.string\\(\\)\\)/, '旧资产所属对象应兼容迁移为数组');\nassert.match(zod, /所属对象:\\s*assetOwners/, '资产 Schema 应使用所属对象数组规范器');"
if old not in s:
    raise SystemExit('stale asset-writeback ZOD assertion not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('migrated stale asset writeback assertion')
