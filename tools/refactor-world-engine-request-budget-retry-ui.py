from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
state=ROOT/'script/world-engine-src/10-world-state.part.js'
runtime=ROOT/'script/world-engine-src/40-engine-runtime.part.js'
ui=ROOT/'script/world-engine-src/50-engine-ui.part.js'
guide=ROOT/'script/世界引擎接入说明.md'
audit=ROOT/'docs/世界引擎V2审计.md'


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 anchor, got {count}')
    return text.replace(old,new,1)

# Retry payload: configured number is total attempts, including the initial call.
text=state.read_text(encoding='utf-8')
text=replace_once(text,
    'function retryInput(baseInput,error,lastReply,attempt,maxRetries,acceptedResult,retryPlan=[])',
    'function retryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan=[])',
    'retry signature')
text=replace_once(text,
    "            当前总尝试:attempt+1,\n            最大总尝试:maxRetries+1,\n            当前额外重试:attempt,\n            额外重试上限:maxRetries,",
    "            当前尝试:attempt+1,\n            最大尝试次数:maxAttempts,",
    'retry counters')
state.write_text(text,encoding='utf-8')

text=runtime.read_text(encoding='utf-8')
text=replace_once(text,
    "            this.config.retryAttempts=Math.max(0,Math.min(5,Number(this.config.retryAttempts) || 0));",
    "            this.config.retryAttempts=Math.max(1,Math.min(5,Number(this.config.retryAttempts) || 3));",
    'retry config clamp')
text=replace_once(text,
    "                const maxRetries=Math.max(0,Math.min(5,Number(this.config.retryAttempts)||0));\n                let attempt=0,lastError=null,lastRejectedReply='',prepared=null,acceptedWorldResult=null,lastRetryPlan=[];\n\n                while(attempt<=maxRetries){",
    "                const maxAttempts=Math.max(1,Math.min(5,Number(this.config.retryAttempts)||3));\n                let attempt=0,lastError=null,lastRejectedReply='',prepared=null,acceptedWorldResult=null,lastRetryPlan=[];\n\n                while(attempt<maxAttempts){",
    'retry loop semantics')
text=replace_once(text,
    "clearTimeout(timeout);timeout=setTimeout(()=>{timedOut=true;this.controller.abort();},120000);",
    "clearTimeout(timeout);timeout=setTimeout(()=>{timedOut=true;this.controller.abort();},300000);",
    'request timeout')
text=replace_once(text,
    "const attemptInput=attempt===0?request.input:retryInput(request.input,lastError,lastRejectedReply,attempt,maxRetries,acceptedWorldResult,lastRetryPlan);",
    "const attemptInput=attempt===0?request.input:retryInput(request.input,lastError,lastRejectedReply,attempt,maxAttempts,acceptedWorldResult,lastRetryPlan);",
    'retry input max attempts')
text=replace_once(text,
    "                        最大失败重试:maxRetries,",
    "                        最大尝试次数:maxAttempts,",
    'request manifest max attempts')
text=replace_once(text,
    "                    this.status=attempt===0?'六模块联合推演中':'纠错重试 '+attempt+'/'+maxRetries;",
    "                    this.status=attempt===0?'六模块联合推演中':'纠错重试 '+(attempt+1)+'/'+maxAttempts;",
    'retry running status')
old_catch="""                        lastError=error;
                        lastRejectedReply=received||this.lastReply||'';
                        lastRetryPlan=Array.isArray(error?.retryPlan)&&error.retryPlan.length?copy(error.retryPlan):retryPlanForFailure(error,[]);
                        const canRetry=!!received&&retryableModelFailure(error)&&attempt<maxRetries;
                        if(!canRetry)throw error;
                        this.lastRetryLog.push({重试:attempt+1,错误:String(error.message||error),片段:Array.isArray(error?.rejectedSlices)?copy(error.rejectedSlices):[],补充清单:copy(lastRetryPlan)});
                        attempt++;
                        this.status='回复未通过 · 自动纠错 '+attempt+'/'+maxRetries;
                        this.render();"""
new_catch="""                        lastError=error;
                        lastRejectedReply=received||this.lastReply||'';
                        lastRetryPlan=Array.isArray(error?.retryPlan)&&error.retryPlan.length?copy(error.retryPlan):retryPlanForFailure(error,[]);
                        const rejectedByModel=!!received&&retryableModelFailure(error);
                        if(rejectedByModel)this.lastRetryLog.push({尝试:attempt+1,错误:String(error.message||error),片段:Array.isArray(error?.rejectedSlices)?copy(error.rejectedSlices):[],补充清单:copy(lastRetryPlan)});
                        const canRetry=rejectedByModel&&attempt+1<maxAttempts;
                        if(!canRetry)throw error;
                        attempt++;
                        this.status='回复未通过 · 自动纠错 '+(attempt+1)+'/'+maxAttempts;
                        this.render();"""
text=replace_once(text,old_catch,new_catch,'retry failure logging')
text=replace_once(text,
    "                this.status='已更新 · '+prepared.reply.summary+(this.lastRetryLog.length?' · 重试'+this.lastRetryLog.length+'次':'');",
    "                this.status='已更新 · '+prepared.reply.summary+(this.lastRetryLog.length?' · 前序失败'+this.lastRetryLog.length+'次':'');",
    'success retry status')
text=replace_once(text,
    "                const failureMessage=error.name==='AbortError'?(timedOut?'请求超时（120秒）':'请求已取消'):String(error.message||error);",
    "                const failureMessage=error.name==='AbortError'?(timedOut?'请求超时（300秒）':'请求已取消'):String(error.message||error);",
    'timeout error text')
text=replace_once(text,
    "                const retryNote=this.lastRetryLog?.length?' · 已重试'+this.lastRetryLog.length+'次':'';",
    "                const retryNote=this.lastRetryLog?.length?' · 已记录失败'+this.lastRetryLog.length+'次':'';",
    'failure log status')
if 'maxRetries' in text:
    raise SystemExit('runtime still contains maxRetries after total-attempt migration')
runtime.write_text(text,encoding='utf-8')

text=ui.read_text(encoding='utf-8')
text=replace_once(text,
    "                    const value=Math.max(0,Math.min(5,Number(event.target.value)||0));\n                    this.config.retryAttempts=value;event.target.value=value;this.saveConfig();\n                    this.status='额外重试次数已设为 '+value+' 次 · 最多总尝试 '+(value+1)+' 次';",
    "                    const value=Math.max(1,Math.min(5,Number(event.target.value)||1));\n                    this.config.retryAttempts=value;event.target.value=value;this.saveConfig();\n                    this.status='最大尝试次数已设为 '+value+' 次';",
    'retry UI input handler')
text=replace_once(text,
    "<time>#'+text(item.重试)+'</time>",
    "<time>#'+text(item.尝试)+'</time>",
    'retry log attempt label')
# Remove the redundant per-attempt token telemetry fold from request inspection. Telemetry stays in memory for diagnostics/tests.
text,n=re.subn(r"\n\s*const attemptRows=\(this\.lastAttemptTelemetry\|\|\[\]\)\.map\(item=>\(\{[\s\S]*?\n\s*\}\)\);",'',text,count=1)
if n!=1: raise SystemExit(f'attemptRows removal: got {n}')
old_section="""                html+=section('失败自动重试','<div class="we-config-row"><label>失败后额外重试 <input data-retries type="number" min="0" max="5" value="'+text(this.config.retryAttempts??3)+'"> 次</label><span class="we-muted">首次请求 1 次 + 最多额外重试 0~5 次；设为 5 时最多总尝试 6 次。默认额外 3，最大额外 5。只纠正 WorldResult 业务结果/编译校验，危险越权、上下文变化和写入未确认不会自动重试。</span></div>'+(this.lastAttemptCount?'<p class="we-muted">最近一次：首次请求 1 次 + 额外重试 '+text(Math.max(0,this.lastAttemptCount-1))+' 次 = 共 '+text(this.lastAttemptCount)+' 次。</p>':'')+(retryLog||'')+(attemptRows.length?fold('每次尝试观测（点击展开）',readable('尝试',attemptRows)) : ''));"""
new_section="""                html+=section('失败自动重试','<div class="we-config-row"><label>最大尝试次数 <input data-retries type="number" min="1" max="5" value="'+text(this.config.retryAttempts??3)+'"> 次</label><span class="we-muted">包含首次请求。1 = 只请求一次；5 = 最多总共尝试 5 次。只纠正 WorldResult 业务结果/编译校验，危险越权、上下文变化和写入未确认不会自动重试。</span></div>'+(this.lastAttemptCount?'<p class="we-muted">最近一次共尝试 '+text(this.lastAttemptCount)+' 次；每次模型业务拒绝都会在下方完整保留，包括最后一次失败。</p>':'')+(retryLog||''));"""
text=replace_once(text,old_section,new_section,'retry section')
text=replace_once(text,
    "(m.最大失败重试!==undefined?pill('最多重试 '+m.最大失败重试,'dim'):'')",
    "(m.最大尝试次数!==undefined?pill('最多尝试 '+m.最大尝试次数,'dim'):'')",
    'request summary max attempts')
old_token="""                    body+='<p class="we-muted">带“≈”的 tk 为本地估算；不同模型 tokenizer 会有差异。专属 API 返回 usage 时，输入/输出总量改用服务端实际 token；分段构成仍保持估算。Schema 已包含在 system 内，不要与 system 再相加。</p>';
                    body+=fold('Token 构成（点击展开）',fields({总输入:exactInput?tokenLabel(obs.实际输入Tokens,false):tokenLabel(obs.请求估算Tokens,true),System:tokenLabel(obs.System估算Tokens,true),User:tokenLabel(obs.User估算Tokens,true),Schema子项:tokenLabel(obs.Schema估算Tokens,true),世界书:tokenLabel(books.reduce((sum,item)=>sum+(Number(item.估算Tokens)||0),0),true),正文:tokenLabel(floors.reduce((sum,item)=>sum+(Number(item.估算Tokens)||0),0),true),接口:obs.接口来源||m.接口来源||'',模型:obs.模型||'',模式尝试:Array.isArray(obs.模式尝试)&&obs.模式尝试.length?obs.模式尝试.join(' → '):'',耗时:Number.isFinite(Number(obs.耗时毫秒))?(Number(obs.耗时毫秒)/1000).toFixed(2).replace(/\\.00$/,'')+' s':''})+fold('system 分段',fields({分段:(obs.System分段||[]).map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))}))+fold('user 分段',fields({分段:(obs.User分段||[]).map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))})));"""
new_token="""                    const userTokenFields=Object.fromEntries((obs.User分段||[]).map(item=>[item.名称,tokenLabel(item.估算Tokens,true)]));
                    body+='<p class="we-muted">带“≈”的 tk 只是本地容量粗估，不等于服务商真实 token；主神终端通道拿不到 usage 时无法确认精确总量。总输入 = System + 下列 User 分项；这里不再重复显示 User 总项或 Schema 子项。专属 API 返回 usage 时仅总输入/输出改用服务端实际 token。</p>';
                    body+=fold('Token 构成（点击展开）',fields(Object.assign({总输入:exactInput?tokenLabel(obs.实际输入Tokens,false):tokenLabel(obs.请求估算Tokens,true),System:tokenLabel(obs.System估算Tokens,true)},userTokenFields,{接口:obs.接口来源||m.接口来源||'',模型:obs.模型||'',模式尝试:Array.isArray(obs.模式尝试)&&obs.模式尝试.length?obs.模式尝试.join(' → '):'',耗时:Number.isFinite(Number(obs.耗时毫秒))?(Number(obs.耗时毫秒)/1000).toFixed(2).replace(/\\.00$/,'')+' s':''}))+fold('system 分段',fields({分段:(obs.System分段||[]).map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))})));"""
text=replace_once(text,old_token,new_token,'token composition UI')
if '每次尝试观测（点击展开）' in text: raise SystemExit('redundant attempt telemetry UI still present')
if '失败后额外重试' in text: raise SystemExit('extra retry wording still present in UI')
ui.write_text(text,encoding='utf-8')

text=guide.read_text(encoding='utf-8')
text=text.replace('每次请求 120 秒超时','每次请求 300 秒超时')
text=replace_once(text,
    '“请求检查”只显示当前聊天/存档上下文的运行资料，并以 token 为主要容量单位：带 `≈` 的 `tk` 是本地估算；专属 API 返回 `usage` 时，请求总输入/输出改用服务端实际 token。页面同时显示 system/user/Schema 子项、世界书与正文楼层构成、接口来源、模型、实际结构化模式/降级链、耗时和逐次纠错结果。Schema 是 system 的子项，不与总输入重复相加。',
    '“请求检查”只显示当前聊天/存档上下文的运行资料，并以 token 为主要容量单位：带 `≈` 的 `tk` 只是本地容量粗估，不等于服务商真实 token；专属 API 返回 `usage` 时，请求总输入/输出改用服务端实际 token。Token 构成只显示“总输入 + System + User 各顶层分项”，不再把 User 总项、Schema 子项与其中的世界书/正文并列成可相加项目；System 的内部组成仍可展开查看。页面同时显示接口来源、模型、实际结构化模式/降级链、耗时和失败原因。',
    'request inspection token docs')
text=replace_once(text,
    '世界推进的“请求检查”页提供 **失败后额外重试**，默认 `3`，可设置 `0~5`。该数字只表示首次请求之后还能追加多少次纠错请求，因此设为 `5` 时最多总尝试 `6` 次（首次 1 次 + 额外 5 次），不是“总共只请求 5 次”。重试期间不落盘；只有累计业务结果完整通过后才执行一次 MVU 写回。',
    '世界推进的“请求检查”页提供 **最大尝试次数**，默认 `3`，可设置 `1~5`，并且**首次请求本身就计为第 1 次**：设为 `1` 时不自动重试，设为 `5` 时最多总共请求 5 次。每次模型已经返回、但 WorldResult 业务/编译验收失败时都会写入上方失败列表，包含达到上限后的最后一次失败；请求失败或危险越权等不可自动纠错错误仍直接终止。重试期间不落盘；只有累计业务结果完整通过后才执行一次 MVU 写回。',
    'retry docs')
guide.write_text(text,encoding='utf-8')

text=audit.read_text(encoding='utf-8')
text=replace_once(text,
    '- 每次请求记录 system / user / Schema 子项、世界书、正文楼层的 token 构成，以及接口来源、模型、实际结构化模式、`json_schema → json_object → plain` 尝试链和耗时。',
    '- 每次请求记录总输入、System 与 User 各顶层分项的 token 构成，以及接口来源、模型、实际结构化模式、`json_schema → json_object → plain` 尝试链和耗时；不再把 User 总项或 Schema 子项与其包含项并列，避免视觉重复计数。',
    'audit token composition')
text=replace_once(text,
    '- 自动纠错按尝试单独记录输入/输出 token、接受/拒绝/请求失败状态与失败原因，因此可以区分“Prompt 太大”“提供方结构化不兼容”和“业务验收失败”。',
    '- 自动纠错仍在内存保留逐次技术观测供诊断，但请求检查 UI 只展示完整失败记录，不再额外显示“每次尝试观测”折叠区；最后一次业务拒绝也必须进入失败列表。',
    'audit retry observability')
text=replace_once(text,
    '- Schema 已包含在 system 请求中；诊断页将其标为 system 的子项，不与总输入重复相加。',
    '- Schema 已包含在 System 请求中；需要细看时从 System 分段展开，不再作为 Token 构成的平级项目。',
    'audit schema nesting')
audit.write_text(text,encoding='utf-8')

# Update permanent tests from old “extra retries” semantics to total-attempt semantics.
for rel in ['tests/world-engine-prose.cjs','tests/world-engine-macro-open-backbone.cjs','tests/world-engine.cjs']:
    p=ROOT/rel
    if not p.exists(): continue
    t=p.read_text(encoding='utf-8')
    def bump(m):
        old=int(m.group(1)); return 'config.retryAttempts='+str(min(5,old+1))
    t=re.sub(r'config\.retryAttempts=([012])\b',bump,t)
    p.write_text(t,encoding='utf-8')

p=ROOT/'tests/world-engine-schema-retry-diagnostics.cjs'
t=p.read_text(encoding='utf-8')
t=t.replace('a.engine.config.retryAttempts=0','a.engine.config.retryAttempts=1')
t=t.replace('b.engine.config.retryAttempts=1','b.engine.config.retryAttempts=2')
t=replace_once(t,
    "  assert.equal(retry.当前总尝试,2);\n  assert.equal(retry.最大总尝试,2);\n  assert.equal(retry.当前额外重试,1);\n  assert.equal(retry.额外重试上限,1);\n  assert.equal(retry.当前重试,undefined,'旧的歧义字段不再发送');\n\n  assert.match(source,/失败后额外重试/,'UI 应明确这是首次请求之外的额外重试');\n  assert.match(source,/首次请求 1 次 \\+ 最多额外/,'UI 应明确总尝试次数的组成');\n  assert.doesNotMatch(source,/label>失败重试次数 /,'旧歧义标签应移除');",
    "  assert.equal(retry.当前尝试,2);\n  assert.equal(retry.最大尝试次数,2);\n  for(const key of ['当前总尝试','最大总尝试','当前额外重试','额外重试上限'])assert.equal(retry[key],undefined);\n\n  assert.match(source,/最大尝试次数/,'UI 应直接使用包含首次请求的总尝试次数');\n  assert.match(source,/1 = 只请求一次/);\n  assert.doesNotMatch(source,/失败后额外重试/);",
    'schema retry test expectations')
p.write_text(t,encoding='utf-8')

# Legacy source assertion follows the new UI label.
p=ROOT/'tests/world-engine.cjs'
t=p.read_text(encoding='utf-8').replace('assert.match(sourceText,/失败后额外重试/);','assert.match(sourceText,/最大尝试次数/);')
p.write_text(t,encoding='utf-8')

print('request budget/retry UI patch applied')
