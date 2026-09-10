from pathlib import Path

p = Path(__file__).resolve().parent / 'refactor-asset-multi-owner.py'
s = p.read_text(encoding='utf-8')
start_marker = 's=replace_once(s,"            + \'<span class=\\"sam-asset-badge\\">\' + esc(type) + \'</span>\''
start = s.find(start_marker)
if start < 0:
    raise SystemExit('status badge patch statement start not found')
end_marker = "'status head owner badge')"
end = s.find(end_marker, start)
if end < 0:
    raise SystemExit('status badge patch statement end not found')
end += len(end_marker)
replacement = '''badge = "            + '<span class=\\"sam-asset-badge\\">' + esc(type) + '</span>'"
badge_with_owner = badge + "\\n            + '<span class=\\"sam-asset-badge\\">' + esc(ownerHead) + '</span>'"
s=replace_once(s,badge,badge_with_owner,'status head owner badge')'''
s = s[:start] + replacement + s[end:]
p.write_text(s, encoding='utf-8')
print('patched one-shot refactor anchor')
