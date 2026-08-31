from pathlib import Path

p = Path('script/悬浮球状态栏.js')
raw = p.read_bytes().decode('utf-8')
nl = '\r\n' if '\r\n' in raw else '\n'
s = raw.replace('\r\n', '\n')

old_source = """                payer.空间币 = Math.max(0, safeNum(payer.空间币, 0) - check.cost);\n                target.层级 = check.nextTier;\n                if (check.isHero && statData.系统状态) statData.系统状态.试炼已完成 = false;\n                applied = true;\n"""
new_source = """                payer.空间币 = Math.max(0, safeNum(payer.空间币, 0) - check.cost);\n                target.层级 = check.nextTier;\n                var receiptActor = check.isHero ? '主角' : check.targetName;\n                shopAppendReceipt(statData, '[普升]['+receiptActor+'] 源力灌注：'+check.currentTier+' → '+check.nextTier+'｜消耗 '+sourceInfusionFmtNum(check.cost)+'空间币、'+check.credentialName+'×1');\n                if (check.isHero && statData.系统状态) statData.系统状态.试炼已完成 = false;\n                applied = true;\n"""
if s.count(old_source) != 1:
    raise SystemExit(f'source infusion anchor mismatch: {s.count(old_source)}')
s = s.replace(old_source, new_source, 1)

old_trial = """                    if (statData.主角) statData.主角.层级 = nextTier;\n                    // 进阶完成后重置试炼标记, 为下一轮进阶流程做准备\n                    if (statData.系统状态) statData.系统状态.试炼已完成 = false;\n"""
new_trial = """                    if (statData.主角) {\n                        var oldTier = normalizeLifeTier(statData.主角.层级);\n                        statData.主角.层级 = nextTier;\n                        shopAppendReceipt(statData, '[普升][主角] 晋升试炼完成：'+oldTier+' → '+nextTier);\n                    }\n                    // 进阶完成后重置试炼标记, 为下一轮进阶流程做准备\n                    if (statData.系统状态) statData.系统状态.试炼已完成 = false;\n"""
if s.count(old_trial) != 1:
    raise SystemExit(f'trial advance anchor mismatch: {s.count(old_trial)}')
s = s.replace(old_trial, new_trial, 1)

for required in [
    "[普升][主角] 晋升试炼完成：",
    "[普升]['," if False else "源力灌注：",
    "shopAppendReceipt(statData",
]:
    if required not in s:
        raise SystemExit(f'missing expected receipt marker: {required}')

out = s if nl == '\n' else s.replace('\n', '\r\n')
p.write_bytes(out.encode('utf-8'))
print('tier success receipts patched')
