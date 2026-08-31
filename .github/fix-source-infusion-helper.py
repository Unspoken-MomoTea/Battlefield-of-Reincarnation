from pathlib import Path
p = Path('.github/source-infusion-patch.py')
s = p.read_text(encoding='utf-8')
old = 'pat = re.compile(r"    /\\* 层级进度条:.*?\\n    function renderTierProgressBar\\(p, fa, sys\\) \\{.*?\\n    \\}\\n\\n    /\\* ===== 24\\. Tab: 信息\\(主角详情\\) ===== \\*/", re.S)'
new = 'pat = re.compile(r"    /\\* 层级进度条: 左=当前层级.*?\\n    function renderTierProgressBar\\(p, fa, sys\\) \\{.*?\\n    \\}\\n\\n    /\\* ===== 24\\. Tab: 信息\\(主角详情\\) ===== \\*/", re.S)'
assert s.count(old) == 1, 'target regex line not found exactly once'
p.write_text(s.replace(old, new, 1), encoding='utf-8')
