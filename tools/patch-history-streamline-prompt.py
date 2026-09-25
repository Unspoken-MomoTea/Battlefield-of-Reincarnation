from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
def patch(rel,old,new,label):
    p=ROOT/rel; s=p.read_text(encoding='utf-8')
    if new in s: print('[history-prompt] already',label); return
    if s.count(old)!=1: raise RuntimeError(f'{label}: {s.count(old)} anchors')
    p.write_text(s.replace(old,new,1),encoding='utf-8'); print('[history-prompt] patched',label)

patch('script/world-engine-src/00-foundation-prompt.part.js',
'Step 7 · 输出差分：只输出本轮新增或变化的 WorldResult；无业务变化只写摘要。',
'Step 7 · 输出差分：先按“历史摘要”规则写摘要，再只输出本轮新增或变化的 WorldResult；无业务变化也要客观说明本轮没有新增世界事实。','summary pipeline')
patch('script/world-engine-src/00-foundation-prompt.part.js',
'8. 公开与基础：当前事件公开字段只写已成为现实且可合理感知的信息。货币只随真实流通体系变化，任务世界不用空间币作本地货币；历法只在可靠设定明确时维护。`;',
'8. 公开与基础：当前事件公开字段只写已成为现实且可合理感知的信息。货币只随真实流通体系变化，任务世界不用空间币作本地货币；历法只在可靠设定明确时维护。\n9. 历史摘要：摘要只写本轮已确认的主体、动作、结果、关键状态变化与持续影响；区分计划、进行与完成，禁止“已建立骨架”“已完成推演”“局势暗涌”等运行话术或空泛概括。`;','history summary rule')
def ensure_prompt_version_floor():
    p=ROOT/'script/world-engine-src/00-foundation-prompt.part.js'
    s=p.read_text(encoding='utf-8')
    m=re.search(r"        version:(\\d+),\\n        builtin:true,",s)
    if not m: raise RuntimeError('prompt version: anchor missing')
    version=int(m.group(1))
    if version>=20:
        print('[history-prompt] already prompt version',version)
        return
    if version!=19: raise RuntimeError(f'prompt version: unsupported {version}')
    p.write_text(s[:m.start(1)]+'20'+s[m.end(1):],encoding='utf-8')
    print('[history-prompt] patched prompt version 19 -> 20')

ensure_prompt_version_floor()
patch('script/world-engine-src/59-history-memory.part.js','可以删除：重复描述、已经失去后续意义的过程细节、UI/运行记录信息。','可以删除：重复描述、已经失去后续意义的过程细节、UI/调试信息。','compression wording')
print('[history-prompt] done')
