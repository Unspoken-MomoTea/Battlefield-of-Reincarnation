from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
state = ROOT / 'script/world-engine-src/10-world-state.part.js'
result = ROOT / 'script/world-engine-src/20-world-result.part.js'
runtime = ROOT / 'script/world-engine-src/40-engine-runtime.part.js'
ui = ROOT / 'script/world-engine-src/50-engine-ui.part.js'
guide = ROOT / 'script/世界引擎接入说明.md'
legacy_test = ROOT / 'tests/world-engine.cjs'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, got {count}')
    return text.replace(old, new, 1)


# retry payload: make total-attempt math explicit without changing stored retryAttempts semantics.
text = state.read_text(encoding='utf-8')
text = replace_once(
    text,
    "            当前重试:attempt,\n            最大重试次数:maxRetries,",
    "            当前总尝试:attempt+1,\n            最大总尝试:maxRetries+1,\n            当前额外重试:attempt,\n            额外重试上限:maxRetries,",
    'retry payload counters'
)
state.write_text(text, encoding='utf-8')

text = result.read_text(encoding='utf-8')
text = replace_once(
    text,
    "    const QUALITY_RANKS=['F','E','D','C','B','A','S','SS','SSS'];",
    "    const QUALITY_RANKS=['F','E','D','C','B','A','S','SS','SSS'];\n    const RUMOR_CREDIBILITY=['酒话','可疑','或许可信'];\n    const INTEL_RATINGS=[...QUALITY_RANKS,'日常','战略'];\n    function normalizeRumorCredibility(value) {\n        const raw=String(value??'').trim();\n        if(RUMOR_CREDIBILITY.includes(raw))return raw;\n        if(/^(?:可信|属实|真实|确实|高|较高|很高|基本属实)$/.test(raw))return '或许可信';\n        if(/^(?:不可信|虚假|谣言|低|较低|很低|纯属谣言)$/.test(raw))return '酒话';\n        return '可疑';\n    }",
    'rumor canonical constants'
)
text = replace_once(
    text,
    "    const EXPLORATION_RESULT_SCHEMA=namedEntitySchema(EXISTING.探索);\n    EXPLORATION_RESULT_SCHEMA.properties.风险={type:'string',enum:copy(QUALITY_RANKS)};\n    EXPLORATION_RESULT_SCHEMA.properties.探索度={type:'number',minimum:0,maximum:100};",
    "    const EXPLORATION_RESULT_SCHEMA=namedEntitySchema(EXISTING.探索);\n    EXPLORATION_RESULT_SCHEMA.properties.风险={type:'string',enum:copy(QUALITY_RANKS)};\n    EXPLORATION_RESULT_SCHEMA.properties.探索度={type:'number',minimum:0,maximum:100};\n    const EVENT_RESULT_SCHEMA=namedEntitySchema({...RECORDS.事件,...MODEL_DETAILS.事件});\n    EVENT_RESULT_SCHEMA.properties.状态={type:'string',enum:['待发生','进行中','已完成','已取消']};\n    EVENT_RESULT_SCHEMA.properties.分类={type:'string',enum:Array.from(EVENT_CATEGORIES)};\n    const OFFSET_RESULT_SCHEMA=namedEntitySchema(EXISTING.偏移记录);\n    OFFSET_RESULT_SCHEMA.properties.影响程度={type:'number',minimum:-100,maximum:120};\n    const STREET_RUMOR_RESULT_SCHEMA=namedEntitySchema(EXISTING.街头巷议,['更新','移除','撤销本轮'],['来源','内容','可信度']);\n    STREET_RUMOR_RESULT_SCHEMA.properties.可信度={type:'string',enum:copy(RUMOR_CREDIBILITY)};\n    const INTEL_TRADE_RESULT_SCHEMA=namedEntitySchema(EXISTING.情报交易,['更新','移除','撤销本轮'],['卖家','情报评级','摘要','要价','真实内幕']);\n    INTEL_TRADE_RESULT_SCHEMA.properties.情报评级={type:'string',enum:copy(INTEL_RATINGS)};",
    'specialized model schemas'
)
text = replace_once(
    text,
    "            事件:{type:'array',maxItems:30,items:namedEntitySchema({...RECORDS.事件,...MODEL_DETAILS.事件})},",
    "            事件:{type:'array',maxItems:30,items:EVENT_RESULT_SCHEMA},",
    'event schema binding'
)
text = replace_once(
    text,
    "                偏移记录:{type:'array',maxItems:10,items:namedEntitySchema(EXISTING.偏移记录)}",
    "                偏移记录:{type:'array',maxItems:10,items:OFFSET_RESULT_SCHEMA}",
    'offset schema binding'
)
text = replace_once(
    text,
    "                街头巷议:{type:'array',maxItems:3,items:namedEntitySchema(EXISTING.街头巷议,['更新','移除','撤销本轮'],['来源','内容','可信度'])},\n                情报交易:{type:'array',maxItems:3,items:namedEntitySchema(EXISTING.情报交易,['更新','移除','撤销本轮'],['卖家','情报评级','摘要','要价','真实内幕'])},",
    "                街头巷议:{type:'array',maxItems:3,items:STREET_RUMOR_RESULT_SCHEMA},\n                情报交易:{type:'array',maxItems:3,items:INTEL_TRADE_RESULT_SCHEMA},",
    'rumor schema bindings'
)
text = replace_once(
    text,
    "            if(key==='街头巷议'){\n                const seen=new Set(),deduped=[];",
    "            if(key==='街头巷议'){\n                for(const item of list)if(Object.hasOwn(item,'可信度'))item.可信度=normalizeRumorCredibility(item.可信度);\n                const seen=new Set(),deduped=[];",
    'rumor credibility normalization'
)
text = replace_once(
    text,
    "    function stageWorldResult(stat,accepted,incoming,validate) {",
    "    function shortSchemaValue(value) {\n        if(value===undefined)return 'undefined';\n        let raw;try{raw=JSON.stringify(value);}catch(_){raw=String(value);}\n        if(raw===undefined)raw=String(value);\n        return raw.length>140?raw.slice(0,137)+'…':raw;\n    }\n    function firstSchemaDifference(before,after,parts) {\n        if(same(before,after))return null;\n        if(plain(before)&&plain(after)){\n            const keys=Array.from(new Set([...Object.keys(before),...Object.keys(after)]));\n            for(const key of keys){\n                const diff=firstSchemaDifference(before[key],after[key],parts.concat(key));\n                if(diff)return diff;\n            }\n        }\n        if(Array.isArray(before)&&Array.isArray(after)&&before.length===after.length){\n            for(let i=0;i<before.length;i++){\n                const diff=firstSchemaDifference(before[i],after[i],parts.concat(String(i)));\n                if(diff)return diff;\n            }\n        }\n        return {parts,before,after};\n    }\n    function schemaMismatchError(beforeState,afterState,patchPath) {\n        const parts=tokens(patchPath),before=get(beforeState,parts),after=get(afterState,parts);\n        const diff=firstSchemaDifference(before,after,parts)||{parts,before,after};\n        return new Error('字段未通过完整 Schema 校验：'+pointer(diff.parts)+'（'+shortSchemaValue(diff.before)+' → '+shortSchemaValue(diff.after)+'）');\n    }\n    function stageWorldResult(stat,accepted,incoming,validate) {",
    'schema diff helpers'
)
text = replace_once(
    text,
    "                            if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(built.next,tokens(patch.path))))throw new Error('字段未通过完整 Schema 校验：'+patch.path);",
    "                            if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(built.next,tokens(patch.path))))throw schemaMismatchError(built.next,checked,patch.path);",
    'staging schema diagnostics'
)
text = replace_once(
    text,
    "            if (!['待发生','进行中','已完成','已取消'].includes(event.状态)) throw new Error('非法事件状态');",
    "            if (!['待发生','进行中','已完成','已取消'].includes(event.状态)) throw new Error('非法事件状态：'+name+' = '+String(event.状态||'空')+'；只允许 待发生/进行中/已完成/已取消');",
    'event status diagnostics'
)
result.write_text(text, encoding='utf-8')

text = runtime.read_text(encoding='utf-8')
text = replace_once(
    text,
    "                        this.lastRetryLog.push({重试:attempt+1,错误:String(error.message||error)});",
    "                        this.lastRetryLog.push({重试:attempt+1,错误:String(error.message||error),片段:Array.isArray(error?.rejectedSlices)?copy(error.rejectedSlices):[],补充清单:copy(lastRetryPlan)});",
    'structured retry log'
)
text = replace_once(
    text,
    "                            if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(next,tokens(patch.path))))throw new Error('字段未通过完整 Schema 校验：'+patch.path);",
    "                            if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(next,tokens(patch.path))))throw schemaMismatchError(next,checked,patch.path);",
    'final schema diagnostics'
)
runtime.write_text(text, encoding='utf-8')

text = ui.read_text(encoding='utf-8')
text = replace_once(
    text,
    "                    this.status='失败重试次数已设为 '+value+' 次';",
    "                    this.status='额外重试次数已设为 '+value+' 次 · 最多总尝试 '+(value+1)+' 次';",
    'retry setting status'
)
text = replace_once(
    text,
    "                const retryLog=(this.lastRetryLog||[]).map(item=>'<div class=\"we-change\"><time>#'+text(item.重试)+'</time><div><b>模型回复被拒绝</b><p>'+text(item.错误)+'</p></div></div>').join('');",
    "                const retryLog=(this.lastRetryLog||[]).map(item=>{\n                    const slices=Array.isArray(item.片段)?item.片段:[],plans=Array.isArray(item.补充清单)?item.补充清单:[];\n                    const details=slices.length?'<p><b>具体原因</b><br>'+slices.map(x=>text(x.片段)+'：'+text(x.原因)).join('<br>')+'</p>':'';\n                    const guidance=plans.length?'<p><b>下一次纠错要求</b><br>'+plans.map(text).join('<br>')+'</p>':'';\n                    return '<div class=\"we-change\"><time>#'+text(item.重试)+'</time><div><b>模型回复被拒绝</b><p>'+text(item.错误)+'</p>'+details+guidance+'</div></div>';\n                }).join('');",
    'retry log detail rendering'
)
text = replace_once(text, "<label>失败重试次数 <input data-retries", "<label>失败后额外重试 <input data-retries", 'retry label')
text = replace_once(
    text,
    "首次请求失败后，最多再请求这么多次；默认 3，最大 5。",
    "首次请求 1 次 + 最多额外重试 0~5 次；设为 5 时最多总尝试 6 次。默认额外 3，最大额外 5。",
    'retry helper text'
)
text = replace_once(
    text,
    "最近一次共尝试 '+text(this.lastAttemptCount)+' 次。",
    "最近一次：首次请求 1 次 + 额外重试 '+text(Math.max(0,this.lastAttemptCount-1))+' 次 = 共 '+text(this.lastAttemptCount)+' 次。",
    'retry total explanation'
)
ui.write_text(text, encoding='utf-8')

text = guide.read_text(encoding='utf-8')
text = replace_once(
    text,
    "世界推进的“请求检查”页提供 **失败重试次数**，默认 `3`，可设置 `0~5`。该数字表示：首次副 API 请求已经返回回复，但回复在 JSON 解析、WorldResult 业务校验、Compiler 编译、补丁应用、外部 Schema 校验或宏观骨架验收阶段被拒绝后，最多再请求多少次。重试期间不落盘；只有累计业务结果完整通过后才执行一次 MVU 写回。",
    "世界推进的“请求检查”页提供 **失败后额外重试**，默认 `3`，可设置 `0~5`。该数字只表示首次请求之后还能追加多少次纠错请求，因此设为 `5` 时最多总尝试 `6` 次（首次 1 次 + 额外 5 次），不是“总共只请求 5 次”。重试期间不落盘；只有累计业务结果完整通过后才执行一次 MVU 写回。"
    "\n\nCanonical WorldResult JSON Schema 直接公开模型可写字段的固定约束；事件状态/分类、因果偏移范围、街头巷议可信度和情报评级均与运行期校验对齐。`街头巷议.可信度` 只使用 `酒话 / 可疑 / 或许可信`，兼容接口若仍返回 `高/低/可信/谣言` 等常见同义值，会在 Compiler 入口归正为对应三档，不再为同义词重复请求模型。其他被完整 Schema 改写的字段会记录到具体字段路径，并把“校验前 → 校验后”的差异写入重试检查与下一次纠错要求。",
    'retry guide contract'
)
text = text.replace('若降级后待发生宏观节点不足3个', '若降级后“进行中+待发生”的可推进宏观节点合计不足3个')
text = text.replace('时间轴未初始化或待发生宏观节点不足3个时', '时间轴未初始化或可推进宏观节点（进行中+待发生）合计不足3个时')
guide.write_text(text, encoding='utf-8')

text = legacy_test.read_text(encoding='utf-8')
text = replace_once(text, "        assert.match(sourceText,/失败重试次数/);", "        assert.match(sourceText,/失败后额外重试/);", 'legacy retry label assertion')
legacy_test.write_text(text, encoding='utf-8')
