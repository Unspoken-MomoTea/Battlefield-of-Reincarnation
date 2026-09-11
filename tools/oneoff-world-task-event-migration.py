from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, got {count}')
    return text.replace(old, new, 1)

# 1) Remove the legacy world-engine script/plot store entirely and make event->task
# links a first-class event field visible to the model.
path = 'script/world-engine-src/10-world-state.part.js'
text = read(path)
text = replace_once(text,
"        剧本: { 描述:'', 关联任务:[], 前置条件:'', 下一节点:'', 关联事件:[], 公开动态:'' },\n",
'', 'RECORDS.剧本')
text = replace_once(text,
"        剧本: {状态:'',来源:'',更新时间:'',期限:'',完成条件:'',失败条件:'',结果:'',参与者:[],地点:[],阻碍:[],阶段:[{名称:'',状态:'',时间:'',说明:'',前置阶段:''}]},\n",
'', 'DETAILS.剧本')
text = replace_once(text,
"    const MODEL_RECORDS = Object.fromEntries(Object.entries(RECORDS).filter(([name])=>name!=='剧本'));\n    const MODEL_DETAILS = copy(DETAILS);\n    delete MODEL_DETAILS.剧本;\n    delete MODEL_DETAILS.事件.关联任务;\n",
"    const MODEL_RECORDS = copy(RECORDS);\n    const MODEL_DETAILS = copy(DETAILS);\n",
'MODEL legacy filtering')
write(path, text)

# 2) Keep event->task links in the hot world projection instead of stripping and
# later restoring them as a compatibility patch.
path = 'script/world-engine-src/30-context-protocol.part.js'
text = read(path)
text = replace_once(text,
"        // 旧档中可能仍有事件→任务引用；后台不再消费任务数据。\n        for(const event of Object.values(projectedBackend.事件))if(plain(event))delete event.关联任务;\n",
'', 'context task-link stripping')
write(path, text)

# 3) No legacy script/plot compatibility store in runtime snapshots.
path = 'script/world-engine-src/40-engine-runtime.part.js'
text = read(path)
text = replace_once(text,
"            // 旧剧本数据只为兼容存档保留，不进入新世界调度请求。\n            state.世界[PATH].剧本={};\n",
'', 'runtime legacy plot compatibility')
write(path, text)

# 4) Task awareness: compact prompt, readonly task ledger, event links validated
# against the existing task ledger. WorldResult still has no task write surface.
path = 'script/world-engine-src/57-task-awareness.part.js'
text = read(path)
start = text.index('    const TASK_AWARENESS_RULES=`')
end = text.index('    const TASK_WORLD_BOOK_TITLE=', start)
new_rules = """    const TASK_AWARENESS_RULES=`【任务感知 · 只读】
任务列表是世界因果来源之一。世界推进不得创建、删除或修改任务，也不得推进任务状态、交付、结算或奖励；任务影响只通过事件、人物行动、势力地区、探索与传播表现。事件可用“关联任务”引用当前任务.列表中已存在的任务名，作为因果来源；禁止引用不存在的任务。
情报交易由世界引擎生成或刷新；购买、扣款、消费性删除及购买后创建任务由MVU/变量AI处理，世界引擎下一轮只读接续。副本成就、击杀、奖励与惩罚不进入世界推进上下文。`;
"""
text = text[:start] + new_rules + text[end:]
old_projection = """        // 旧存档里已有的事件→任务索引仍有因果价值，只读恢复；WorldResult 仍没有任务写入口。
        const sourceEvents=stat?.世界?.[PATH]?.事件||{},projectedEvents=out?.世界?.[PATH]?.事件||{};
        for(const [name,event] of Object.entries(projectedEvents)){
            const related=sourceEvents?.[name]?.关联任务;
            if(plain(event)&&Array.isArray(related)&&related.length)event.关联任务=copy(related);
        }
"""
if old_projection not in text:
    raise SystemExit('task-awareness legacy event restoration block missing')
text = text.replace(old_projection, '', 1)
insert_marker = '    const SamsaraWorldEngineBeforeTaskAwareness=SamsaraWorldEngine;\n'
validation = """    const compileWorldResultBeforeTaskAwareness=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=normalizeWorldResult(value);
        const taskNames=new Set(Object.keys(stat?.任务?.列表||{}));
        for(const event of result.事件||[]){
            if(!Array.isArray(event?.关联任务))continue;
            for(const taskName of event.关联任务){
                const name=String(taskName||'').trim();
                if(name&&!taskNames.has(name))throw new Error('事件/'+String(event.名称||'未命名')+'：关联任务不存在：'+name);
            }
        }
        return compileWorldResultBeforeTaskAwareness(stat,result);
    };

"""
text = replace_once(text, insert_marker, validation + insert_marker, 'task-link validator insertion')
text = text.replace(
"payload.输入语义.任务列表='只读。用于人物、事件、势力地区、探索与传播的因果连续性；正式状态机、购买转任务、交付、结算与奖励仍由MVU及<任务与委托系统>负责。';",
"payload.输入语义.任务列表='只读因果账本。事件可通过关联任务引用已存在任务；不得创建、删除、改状态、交付或结算任务。';")
write(path, text)

# 5) Remove the legacy backend key from the Zod world-state model.
path = 'script/ZOD脚本.js'
text = read(path)
text = replace_once(text,
"            剧本: z.record(z.string(), z.any()).prefault({}),\n",
'', 'ZOD 世界.后台.剧本')
write(path, text)

# 6) Update representative fixtures that still instantiate the deleted store.
for rel in [
    'tests/world-engine-overview.cjs',
    'tests/world-engine-prompt-editor.cjs',
    'tests/world-engine-ui.cjs',
]:
    text = read(rel)
    text, n = re.subn(r'^b\.剧本=.*\n', '', text, flags=re.M)
    if n != 1:
        raise SystemExit(f'{rel}: expected one b.剧本 fixture, got {n}')
    write(rel, text)

path = 'tests/world-engine.cjs'
text = read(path)
text, n = re.subn(r'^\s*s\.世界\.后台\.剧本\.旧剧本=.*\n', '', text, flags=re.M)
if n != 1:
    raise SystemExit(f'{path}: expected one legacy plot fixture, got {n}')
write(path, text)

# 7) Strengthen the task-awareness regression at the public seams.
path = 'tests/world-engine-task-awareness.cjs'
text = read(path)
text = replace_once(text,
"const {SamsaraWorldEngine:Engine,emptyState,RECORDS,projectWorldContext}=require('../script/世界推进系统.js');",
"const {SamsaraWorldEngine:Engine,emptyState,RECORDS,projectWorldContext,compileWorldResult,WORLD_RESULT_SCHEMA}=require('../script/世界推进系统.js');",
'task awareness imports')
anchor = """  assert.deepEqual(ctx.世界.后台.事件['黑鸦商队失踪'].关联任务,['调查黑鸦商队'],'事件的任务关联必须保留给世界后台');

"""
extra = """  assert.equal(Object.hasOwn(RECORDS,'剧本'),false,'新版世界后台不再定义剧本记录');
  assert.equal(Object.hasOwn(emptyState(),'剧本'),false,'新版世界后台不再初始化剧本字段');
  assert.equal(WORLD_RESULT_SCHEMA.properties.任务,undefined,'WorldResult 不得提供任务写入口');

  const accepted=compileWorldResult(state,{摘要:'任务推动世界变化',事件:[{名称:'黑鸦商队失踪',关联任务:['调查黑鸦商队'],公开征兆:'商会追加了失踪者悬赏。'}]});
  assert.ok(accepted.patches.some(p=>p.path.includes('/事件/黑鸦商队失踪/关联任务')),'存在的任务名允许作为事件因果索引');
  assert.throws(
    ()=>compileWorldResult(state,{摘要:'错误关联',事件:[{名称:'黑鸦商队失踪',关联任务:['调查黑龙阴谋']}]}),
    /事件\/黑鸦商队失踪：关联任务不存在：调查黑龙阴谋/,
    '不存在的任务关联必须显式拒绝'
  );
  state.世界.后台.剧本={旧剧本:{描述:'不应进入上下文'}};
  const noLegacyPlot=projectWorldContext(state);
  assert.equal(noLegacyPlot.世界.后台.剧本,undefined,'旧剧本数据不得进入世界推进上下文');

"""
text = replace_once(text, anchor, anchor + extra, 'task-awareness assertions')
# Prompt expectations now follow the concise rule rather than the old compatibility wording.
text = text.replace(
"  assert.match(request.system,/任务状态机以<任务与委托系统>为准/,'世界推进必须以正式任务系统为权威');\n",
"  assert.match(request.system,/任务列表是世界因果来源之一/,'任务列表必须作为只读世界因果来源');\n  assert.match(request.system,/事件可用“关联任务”引用当前任务\.列表中已存在的任务名/,'事件应允许关联已有任务');\n")
write(path, text)

# 8) Documentation: describe the new architecture, not legacy plot compatibility.
path = 'script/世界引擎接入说明.md'
text = read(path)
old = "- `世界.后台` 的调度核心是事件、人物行动、势力地区、历史与传播；`剧本`仅为旧存档兼容字段，新推演不再写入或依赖。另存最后处理标识与最近20轮运行说明。"
new = "- `世界.后台` 的调度核心是事件、人物行动、势力地区、历史与传播；不再存在独立`剧本`后台。任务只作为只读因果账本，事件可通过`关联任务`引用`任务.列表`中的既有任务。另存最后处理标识与最近20轮运行说明。"
if old not in text:
    raise SystemExit('world-engine documentation architecture line missing')
text = text.replace(old, new, 1)
write(path, text)

# Guard the code paths that belong to the world engine. Narrative/example content
# elsewhere in the repository may legitimately use the Chinese word “剧本”.
for rel in [
    'script/world-engine-src/10-world-state.part.js',
    'script/world-engine-src/30-context-protocol.part.js',
    'script/world-engine-src/40-engine-runtime.part.js',
    'script/world-engine-src/57-task-awareness.part.js',
    'script/ZOD脚本.js',
]:
    body = read(rel)
    if '世界[PATH].剧本' in body or 'RECORDS.剧本' in body or 'MODEL_DETAILS.剧本' in body:
        raise SystemExit(f'{rel}: legacy plot reference remains')

print('world task-event migration applied')
