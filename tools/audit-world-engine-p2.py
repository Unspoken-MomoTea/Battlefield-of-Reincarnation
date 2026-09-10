from pathlib import Path
import re

path=Path('script/世界推进系统.js')
lines=path.read_text(encoding='utf-8').splitlines()
print('lines',len(lines),'chars',sum(len(x)+1 for x in lines))

print('\n=== top-level-ish declarations ===')
for i,line in enumerate(lines,1):
    if line.startswith('    function ') or line.startswith('    const ') or line.startswith('    class '):
        m=re.match(r'\s*(?:function|const|class)\s+([^\s=(]+)',line)
        if m: print(f'{i:4} {m.group(1):40} {line[:120]}')

print('\n=== class methods ===')
in_class=False
for i,line in enumerate(lines,1):
    if line.startswith('    class SamsaraWorldEngine'): in_class=True
    if in_class:
        m=re.match(r'\s{8}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(',line)
        if m: print(f'{i:4} {m.group(1)}')
    if in_class and line.startswith('    // CommonJS'): break

print('\n=== section comments ===')
for i,line in enumerate(lines,1):
    if re.search(r'/{2,}|/\*|=====|【',line) and ('//' in line or '/*' in line):
        if len(line.strip())<180: print(f'{i:4} {line.strip()}')

print('\n=== deployment constraints ===')
print('IIFE open', next((i for i,l in enumerate(lines,1) if '(function (root)' in l), None))
print('CommonJS export', next((i for i,l in enumerate(lines,1) if 'module.exports' in l), None))
print('IIFE close', max(i for i,l in enumerate(lines,1) if '})(typeof window' in l))
