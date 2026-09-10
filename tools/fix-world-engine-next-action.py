from pathlib import Path

path = Path('script/世界推进系统.js')
text = path.read_text(encoding='utf-8')
old = '#sam-world-engine[data-tone] .we-next-node>span{background:var(--we-accent)!important;color:#fff!important}'
new = '#sam-world-engine[data-tone] .we-next-node>span{background:var(--we-action)!important;color:var(--we-action-ink)!important}'
count = text.count(old)
if count != 1:
    raise SystemExit(f'next-node action token: expected 1 match, got {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('next-node action tokens aligned')
