from pathlib import Path
p=Path(__file__).resolve().parents[1]/'tests/world-engine-observability.cjs'
t=p.read_text(encoding='utf-8')
old="assert.match(source, /带“≈”的 tk 为本地估算/, 'UI must explain estimated vs provider token usage');"
new="assert.match(source, /带“≈”的 tk 只是本地容量粗估/, 'UI must explain estimated vs provider token usage');"
if t.count(old)!=1:
    raise SystemExit('observability wording anchor not found exactly once')
p.write_text(t.replace(old,new,1),encoding='utf-8')
