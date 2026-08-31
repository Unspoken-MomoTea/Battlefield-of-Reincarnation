from pathlib import Path

p = Path('script/ZOD脚本.js')
raw = p.read_bytes().decode('utf-8')
nl = '\r\n' if '\r\n' in raw else '\n'
s = raw.replace('\r\n', '\n')

old_reinforce_def = """const clampNum = (defaultVal, min, max) => safeNum(defaultVal).transform(v => _.clamp(v, min, max));
// 血统/技能/装备/形态的同阶强化次数：只由商城程序维护，每阶 0~3。
const reinforcementLevel = safeNum(0).transform(v => Math.trunc(_.clamp(v, 0, 3)));

"""
new_reinforce_def = """const clampNum = (defaultVal, min, max) => safeNum(defaultVal).transform(v => _.clamp(v, min, max));

"""
if s.count(old_reinforce_def) != 1:
    raise SystemExit(f'reinforcement definition anchor mismatch: {s.count(old_reinforce_def)}')
s = s.replace(old_reinforce_def, new_reinforce_def, 1)

field = "    强化: reinforcementLevel,\n"
if s.count(field) != 4:
    raise SystemExit(f'reinforcement field count mismatch: {s.count(field)}')
s = s.replace(field, '')

old_alien = """const E_alienStatus = z.preprocess(v => {
    const s = String(v ?? '').trim();
    return ['未登场', '活跃', '死亡'].includes(s) ? s : '未登场';
}, z.enum(['未登场', '活跃', '死亡']));
"""
new_alien = """const E_alienStatus = z.preprocess(v => {
    const s = String(v ?? '').trim();
    return s === '死亡' ? '死亡' : '活跃';
}, z.enum(['活跃', '死亡']));
"""
if s.count(old_alien) != 1:
    raise SystemExit(f'alien status enum anchor mismatch: {s.count(old_alien)}')
s = s.replace(old_alien, new_alien, 1)

old_default = "                状态: E_alienStatus.prefault('未登场')\n"
new_default = "                状态: E_alienStatus.prefault('活跃')\n"
if s.count(old_default) != 1:
    raise SystemExit(f'alien status default anchor mismatch: {s.count(old_default)}')
s = s.replace(old_default, new_default, 1)

if 'reinforcementLevel' in s:
    raise SystemExit('reinforcementLevel still present')
if '    强化:' in s:
    raise SystemExit('entity reinforcement field still present')
if '未登场' in s:
    raise SystemExit('legacy alien status still present in ZOD')
if "z.enum(['活跃', '死亡'])" not in s:
    raise SystemExit('new alien status enum missing')
if "状态: E_alienStatus.prefault('活跃')" not in s:
    raise SystemExit('new alien status default missing')

out = s if nl == '\n' else s.replace('\n', '\r\n')
p.write_bytes(out.encode('utf-8'))
print('ZOD cleanup patch applied')
