from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
patcher = ROOT / 'tools/refactor-world-engine-asset-ledger-cleanup.py'
s = patcher.read_text(encoding='utf-8')
pattern = r"s=replace_once\(s,\n\s*'\"version:10,[\s\S]*?'pipeline version assertion'\)\n"
s, n = re.subn(pattern, '', s, count=1)
if n != 1:
    raise SystemExit(f'patcher version-block count={n}')
patcher.write_text(s, encoding='utf-8')

subprocess.run([sys.executable, str(patcher)], cwd=ROOT, check=True)

p = ROOT / 'tests/world-engine-prompt-pipeline.cjs'
s = p.read_text(encoding='utf-8')
old = 'assert(source.includes("version:10,\\n        builtin:true,\\n        name:\'默认设置\'"), \'built-in prompt version should be 10\');'
new = 'assert(source.includes("version:11,\\n        builtin:true,\\n        name:\'默认设置\'"), \'built-in prompt version should be 11\');'
if s.count(old) != 1:
    raise SystemExit(f'pipeline version assertion count={s.count(old)}')
p.write_text(s.replace(old, new, 1), encoding='utf-8')

p = ROOT / 'tests/world-engine-asset-ledger-cleanup.cjs'
s = p.read_text(encoding='utf-8')
old = """for (const [name, text] of [
  ['交付脚本', source],
  ['世界状态源码', stateSource],
  ['运行时源码', runtimeSource],
  ['UI源码', uiSource],
  ['正文只读投影', proseProjection],
]) {
  assert.doesNotMatch(text, /资源点/, `${name} 不应继续维护误加的资源点概念`);
}"""
new = """for (const [name, text] of [
  ['世界状态源码', stateSource],
  ['运行时源码', runtimeSource],
  ['UI源码', uiSource],
  ['正文只读投影', proseProjection],
]) {
  assert.doesNotMatch(text, /资源点/, `${name} 不应继续维护误加的资源点概念`);
}
assert.match(source, /delete area\.资源点/, '交付脚本只允许保留旧存档资源点的只读过滤兼容');"""
if s.count(old) != 1:
    raise SystemExit(f'asset cleanup compatibility test block count={s.count(old)}')
p.write_text(s.replace(old, new, 1), encoding='utf-8')

print('asset-ledger cleanup construction wrapper completed')
