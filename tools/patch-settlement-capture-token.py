from pathlib import Path

path = Path('Regular/结算任务美化.html')
text = path.read_text(encoding='utf-8')
old = "            if (raw.trim() && raw.trim() !== '$1') return raw;"
new = "            const captureToken = '\\u0024' + '1';\n            if (raw.trim() && raw.trim() !== captureToken) return raw;"

count = text.count(old)
if count != 1:
    raise SystemExit(f'expected exactly one unsafe capture-token comparison, found {count}')

text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
