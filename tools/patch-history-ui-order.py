from pathlib import Path

path = Path('script/world-engine-src/50-engine-ui.part.js')
text = path.read_text(encoding='utf-8')
long_line = "                html+=section('长期历史总结',(historyMemory.长期总结||[]).slice().reverse().map(r=>'<article class=\"we-card\"><div class=\"we-card-top\"><h3>'+text(r.名称)+'</h3>'+pill('L'+text(r.层级),'dim')+'</div><div class=\"we-meta\">'+text([r.起始时间,r.结束时间].filter(Boolean).join(' → '))+'</div><p>'+text(r.摘要)+'</p></article>').join('')||empty('尚无长期历史总结','历史锚点积累后会自动分层压缩；底层事实仍保留在MVU。'),(historyMemory.统计?.总结节点总数||0)+' 个总结节点 · 原始历史不删除');"
recent_line = "                html+=section('近期历史锚点',entries(historyMemory.近期锚点).reverse().map(([n,r])=>'<article class=\"we-card\"><div class=\"we-meta\">'+text(r.时间)+'</div><h3>'+text(n)+'</h3><p>'+text(r.事实)+'</p>'+fields({关联事件:r.关联事件})+'</article>').join('')||empty('尚无未收纳的近期历史锚点'),(historyMemory.统计?.原始锚点总数||0)+' 条原始历史 · 仅展示当前热根节点');"
old = long_line + '\n' + recent_line
new = recent_line + '\n' + long_line
if new in text:
    print('history UI order already fixed')
elif old in text:
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('swapped recent history before long-term summary')
else:
    raise SystemExit('history UI order anchor not found')
