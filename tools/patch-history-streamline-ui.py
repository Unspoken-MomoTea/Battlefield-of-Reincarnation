from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
renderer=ROOT/'src/WorldEngine/ui/WorldPanelRenderer.part.js'
history_view=ROOT/'src/WorldEngine/ui/views/WorldHistoryView.part.js'

# Navigation belongs to the shared panel renderer after Phase 50.
s=renderer.read_text(encoding='utf-8')
if "['运行记录','≋','历史记忆']" not in s:
    if "['运行记录','≋']" not in s:
        raise RuntimeError('history navigation anchor missing in WorldPanelRenderer')
    s=s.replace("['运行记录','≋']","['运行记录','≋','历史记忆']",1)
if 'tabs.map(([t,i,label])=>' not in s:
    if 'tabs.map(([t,i])=>' not in s:
        raise RuntimeError('navigation tab renderer anchor missing')
    s=s.replace('tabs.map(([t,i])=>','tabs.map(([t,i,label])=>',1)
if "+'</span>'+(label||t)+'</button>'" not in s:
    if "+'</span>'+t+'</button>'" not in s:
        raise RuntimeError('navigation visible-label anchor missing')
    s=s.replace("+'</span>'+t+'</button>'","+'</span>'+(label||t)+'</button>'",1)
renderer.write_text(s,encoding='utf-8')

# History page content belongs to the dedicated View class.
s=history_view.read_text(encoding='utf-8')
lines=[]
for line in s.splitlines(True):
    if "section('推演记录'" in line:
        continue
    if "section('近期历史锚点'" in line:
        line=line.replace("<h3>'+text(n)+'</h3>",'')
    lines.append(line)
s=''.join(lines)
if "section('推演记录'" in s:
    raise RuntimeError('duplicate run section still present')
if "section('近期历史锚点'" not in s or "section('长期历史总结'" not in s:
    raise RuntimeError('history memory sections missing in WorldHistoryView')
history_view.write_text(s,encoding='utf-8')

print('[history-ui] done')
