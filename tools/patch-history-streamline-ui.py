from pathlib import Path

path=Path(__file__).resolve().parents[1]/'script/world-engine-src/50-engine-ui.part.js'
s=path.read_text(encoding='utf-8')
s=s.replace("['运行记录','≋']","['运行记录','≋','历史记忆']",1)
s=s.replace('tabs.map(([t,i])=>','tabs.map(([t,i,label])=>',1)
s=s.replace("+'</span>'+t+'</button>'","+'</span>'+(label||t)+'</button>'",1)
lines=[]
for line in s.splitlines(True):
    if "section('推演记录'" in line:
        continue
    if "section('近期历史锚点'" in line:
        line=line.replace("<h3>'+text(n)+'</h3>",'')
    lines.append(line)
s=''.join(lines)
if "section('推演记录'" in s: raise RuntimeError('duplicate run section still present')
if "['运行记录','≋','历史记忆']" not in s: raise RuntimeError('history label missing')
path.write_text(s,encoding='utf-8')
print('[history-ui] done')
