from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
runtime=(ROOT/'script/world-engine-src/40-engine-runtime.part.js').read_text(encoding='utf-8')
history=(ROOT/'src/WorldEngine/runtime/WorldHistoryMemoryFeature.part.js').read_text(encoding='utf-8')
if "if(typeof this.beforeWorldCommit==='function')" not in runtime:
    raise RuntimeError('[history-leaf] missing atomic history commit hook')
if 'beforeWorldCommit(next, context={})' not in history:
    raise RuntimeError('[history-leaf] missing per-advance L0 history writer')
for name in ('patch-history-streamline-core.py','patch-history-streamline-ui.py','patch-history-streamline-prompt.py','patch-history-streamline-tests.py'):
    subprocess.run([sys.executable,str(ROOT/'tools'/name)],check=True)
print('[history-leaf] streamline patches applied')
