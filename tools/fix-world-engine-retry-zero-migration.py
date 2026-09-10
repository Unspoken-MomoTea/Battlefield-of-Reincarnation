from pathlib import Path
p=Path(__file__).resolve().parents[1]/'script/world-engine-src/40-engine-runtime.part.js'
t=p.read_text(encoding='utf-8')
old="            this.config.retryAttempts=Math.max(1,Math.min(5,Number(this.config.retryAttempts) || 3));"
new="            {\n                const retryLimit=Number(this.config.retryAttempts);\n                this.config.retryAttempts=Math.max(1,Math.min(5,Number.isFinite(retryLimit)?retryLimit:3));\n            }"
if t.count(old)!=1: raise SystemExit('constructor retry clamp anchor mismatch')
t=t.replace(old,new,1)
old="                const maxAttempts=Math.max(1,Math.min(5,Number(this.config.retryAttempts)||3));"
new="                const configuredAttempts=Number(this.config.retryAttempts),maxAttempts=Math.max(1,Math.min(5,Number.isFinite(configuredAttempts)?configuredAttempts:3));"
if t.count(old)!=1: raise SystemExit('run retry clamp anchor mismatch')
t=t.replace(old,new,1)
p.write_text(t,encoding='utf-8')
