from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
def patch(rel,old,new,label):
    p=ROOT/rel; s=p.read_text(encoding='utf-8')
    if new in s: print('[history-tests] already',label); return
    if s.count(old)!=1: raise RuntimeError(f'{label}: {s.count(old)} anchors')
    p.write_text(s.replace(old,new,1),encoding='utf-8'); print('[history-tests] patched',label)

def patch_prompt_version_test(rel,old,new,label):
    p=ROOT/rel; s=p.read_text(encoding='utf-8')
    versions=[int(v) for v in re.findall(r'version:(\d+)',s)]
    if any(v>=20 for v in versions):
        print('[history-tests] already',label,'at',max(versions))
        return
    patch(rel,old,new,label)

patch('script/世界引擎接入说明.md','另存最后处理标识与最近20轮运行说明。','另存最后处理标识；每次成功推进直接写入当前楼层的近期历史锚点，同楼重推覆盖该叶子。','architecture docs')
patch('script/世界引擎接入说明.md','`最近变化`只保存本轮成功提交产生的新变化，跨轮记录由运行记录与历史锚点承担。','`最近变化`只保存本轮成功提交产生的新变化；跨轮记忆由近期历史锚点与长期历史总结承担，运行诊断只保留在当前会话的请求检查中。','memory docs')
patch('tests/world-engine.cjs',"assert.equal(calls,1); assert.equal(x.writes(),1); assert.equal(x.get().世界.后台.运行记录.length,1);","assert.equal(calls,1); assert.equal(x.writes(),1); assert.equal(Object.hasOwn(x.get().世界.后台,'运行记录'),false);",'core regression')
patch_prompt_version_test('tests/world-engine-prompt-pipeline.cjs',"assert(source.includes(\"version:19,\\n        builtin:true,\\n        name:'默认设置'\"), 'built-in prompt version should be 19');","assert(source.includes(\"version:20,\\n        builtin:true,\\n        name:'默认设置'\"), 'built-in prompt version should be 20');",'prompt version regression')
patch_prompt_version_test('tests/world-engine-asset-writeback.cjs',"assert.match(source, /version:19,\\n        builtin:true,\\n        name:'默认设置'/, '资产边界收紧应升级内置默认提示词到 v19');","assert.match(source, /version:20,\\n        builtin:true,\\n        name:'默认设置'/, '内置默认提示词应包含当前历史摘要规则版本 v20');",'asset prompt version regression')
patch('tests/world-engine-history-memory.cjs',"assert.equal(Object.keys(projected.近期锚点||{}).length,1,'首次推进后运行记录中的近期历史不得继续显示0');","assert.equal(Object.keys(projected.近期锚点||{}).length,1,'首次推进后近期历史不得继续显示0');",'history wording')
patch('tests/world-engine-history-memory.cjs',"    assert.equal(projected.统计.原始锚点总数,1);\n  }","    assert.equal(projected.统计.原始锚点总数,1);\n    assert.equal(Object.hasOwn(backend,'运行记录'),false,'每轮摘要只应保留为 L0 历史，不再重复持久化推演记录');\n  }",'no duplicate persistence')
patch('tests/world-engine-history-memory.cjs',"    const runtime=fs.readFileSync(path.join(__dirname,'../script/world-engine-src/40-engine-runtime.part.js'),'utf8');\n    assert.match(runtime,/sendHistoryToProse", "    const runtime=fs.readFileSync(path.join(__dirname,'../script/world-engine-src/40-engine-runtime.part.js'),'utf8');\n    const zod=fs.readFileSync(path.join(__dirname,'../script/ZOD脚本.js'),'utf8');\n    assert.doesNotMatch(zod,/运行记录\\s*:/,'MVU schema must not keep the removed duplicate run-record field');\n    assert.match(runtime,/sendHistoryToProse",'ZOD removal regression')
patch('tests/world-engine-history-memory.cjs',"    assert.match(ui,/向正文提供历史记忆/,'设置页必须提供明确的历史记忆开关');\n    const recentIndex=ui.indexOf(\"section('近期历史锚点'\");","    assert.match(ui,/向正文提供历史记忆/,'设置页必须提供明确的历史记忆开关');\n    assert.doesNotMatch(ui,/section\\('推演记录'/,'历史记忆页不得再重复展示推演摘要');\n    assert.match(ui,/\\['运行记录','≋','历史记忆'\\]/,'玩家侧导航应显示为历史记忆');\n    const recentLine=ui.split('\\n').find(line=>line.includes(\"section('近期历史锚点'\"))||'';\n    assert.doesNotMatch(recentLine,/<h3>'\\+text\\(n\\)/,'近期历史不得暴露推进·楼层这类内部索引');\n    const recentIndex=ui.indexOf(\"section('近期历史锚点'\");",'history UI regression')
patch('tests/world-engine-history-memory.cjs',"assert.ok(recentIndex>=0&&longIndex>=0&&recentIndex<longIndex,'运行记录应先展示近期历史锚点，再展示长期历史总结');","assert.ok(recentIndex>=0&&longIndex>=0&&recentIndex<longIndex,'历史记忆页应先展示近期历史锚点，再展示长期历史总结');",'history order wording')
patch('tests/world-engine-history-memory-safety.cjs',"    assert.equal((current.世界.后台.运行记录||[]).length,1,'主世界推进结果必须已经提交');","    assert.equal(Object.hasOwn(current.世界.后台,'运行记录'),false,'主推进不应再重复持久化推演记录');",'history safety no duplicate record')
print('[history-tests] done')
