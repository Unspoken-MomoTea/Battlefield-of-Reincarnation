from pathlib import Path
import re

path = Path('script/世界推进系统.js')
text = path.read_text(encoding='utf-8')

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text = text.replace(old, new, 1)

def regex_once(pattern, repl, label, flags=0):
    global text
    new_text, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text = new_text

anchor = "    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);\n"
helpers = r'''    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    // P1-C 诊断只需要稳定的近似量级；不同模型 tokenizer 不同，只有 API usage 才视为精确 token。
    function estimateTokens(value) {
        const source=typeof value==='string'?value:JSON.stringify(value??'');
        if(!source)return 0;
        let eastAsian=0,nonAscii=0,ascii=0;
        for(const ch of source){
            const cp=ch.codePointAt(0);
            const east=(cp>=0x3400&&cp<=0x9fff)||(cp>=0xf900&&cp<=0xfaff)||(cp>=0x3040&&cp<=0x30ff)||(cp>=0x31f0&&cp<=0x31ff)||(cp>=0xac00&&cp<=0xd7af)||(cp>=0x3100&&cp<=0x312f)||(cp>=0xff00&&cp<=0xffef);
            if(east)eastAsian++;
            else if(cp<=0x7f)ascii++;
            else nonAscii++;
        }
        return Math.max(1,Math.ceil(eastAsian*1.08+nonAscii+ascii/3.8));
    }
    function formatTokenCount(count,estimated=true) {
        const n=Math.max(0,Math.round(Number(count)||0));
        let value=String(n);
        if(n>=1000){
            const digits=n>=100000?0:n>=10000?1:2;
            value=(n/1000).toFixed(digits).replace(/\.0+$|(?<=\.[0-9])0+$/,'')+'k';
        }
        return (estimated?'≈':'')+value+' tk';
    }
    function normalizeTokenUsage(usage) {
        if(!plain(usage))return null;
        const finite=value=>Number.isFinite(Number(value))&&Number(value)>=0?Math.round(Number(value)):null;
        const inputTokens=finite(usage.prompt_tokens??usage.input_tokens??usage.promptTokens??usage.inputTokens);
        const outputTokens=finite(usage.completion_tokens??usage.output_tokens??usage.completionTokens??usage.outputTokens);
        let totalTokens=finite(usage.total_tokens??usage.totalTokens);
        if(totalTokens===null&&inputTokens!==null&&outputTokens!==null)totalTokens=inputTokens+outputTokens;
        return inputTokens===null&&outputTokens===null&&totalTokens===null?null:{inputTokens,outputTokens,totalTokens};
    }
    function requestTokenTelemetry(system,input,schema) {
        const systemText=String(system||''),inputText=String(input||'');
        let payload=null;try{payload=JSON.parse(inputText);}catch(_){}
        const systemParts=systemText.split(/\n(?=【)/).filter(Boolean).map((part,index)=>({
            名称:(part.match(/^【([^】]+)】/)||[])[1]||'system '+(index+1),
            估算Tokens:estimateTokens(part)
        }));
        const userParts=plain(payload)?Object.entries(payload).filter(([,value])=>value!==undefined).map(([name,value])=>({
            名称:name,估算Tokens:estimateTokens(JSON.stringify({[name]:value},null,2))
        })):[];
        const systemTokens=estimateTokens(systemText),userTokens=estimateTokens(inputText);
        return {
            估算:true,
            请求估算Tokens:systemTokens+userTokens,
            System估算Tokens:systemTokens,
            User估算Tokens:userTokens,
            Schema估算Tokens:estimateTokens(JSON.stringify(schema||{},null,2)),
            System分段:systemParts,
            User分段:userParts
        };
    }
'''
replace_once(anchor, helpers, 'insert token helpers')

replace_once(
"            this.lastRequest=null; this.previewRequest=null; this.lastReply=''; this.lastFailure='';\n            this.lastRetryLog=[]; this.lastAttemptCount=0; this.lastWorldResult=null; this.lastCompiledPatches=[]; this.lastCompileWarnings=[];",
"            this.lastRequest=null; this.previewRequest=null; this.lastReply=''; this.lastFailure='';\n            this.lastRetryLog=[]; this.lastAttemptCount=0; this.lastAttemptTelemetry=[]; this.lastTransportInfo=null; this.lastWorldResult=null; this.lastCompiledPatches=[]; this.lastCompileWarnings=[];",
'constructor telemetry state')

replace_once(
"            let lastError='';\n            for(const mode of modes){",
"            let lastError='';const modeAttempts=[];\n            for(const mode of modes){\n                modeAttempts.push(mode);",
'dedicated mode attempts')

replace_once(
"                    if(mode!=='plain'&&this.structuredUnsupported(response.status,err)){delete this.apiModeCache[cacheKey];continue;}\n                    throw new Error(lastError);",
"                    if(mode!=='plain'&&this.structuredUnsupported(response.status,err)){delete this.apiModeCache[cacheKey];continue;}\n                    this.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:mode,尝试模式:copy(modeAttempts),usage:null};\n                    throw new Error(lastError);",
'dedicated failure telemetry')

replace_once(
"                const data=await response.json(),message=data?.choices?.[0]?.message;\n                const raw=message?.content;\n                const content=typeof raw==='string'?raw:(plain(raw)?JSON.stringify(raw):message?.parsed?JSON.stringify(message.parsed):'');\n                if(!content)throw new Error('专属 API 返回内容为空');\n                if(wants)this.apiModeCache[cacheKey]=mode;\n                return content;",
"                const data=await response.json(),message=data?.choices?.[0]?.message;\n                const raw=message?.content;\n                const content=typeof raw==='string'?raw:(plain(raw)?JSON.stringify(raw):message?.parsed?JSON.stringify(message.parsed):'');\n                if(!content)throw new Error('专属 API 返回内容为空');\n                if(wants)this.apiModeCache[cacheKey]=mode;\n                this.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:mode,尝试模式:copy(modeAttempts),usage:normalizeTokenUsage(data?.usage)};\n                return content;",
'dedicated success telemetry')

replace_once(
"        async requestAI(system,input,options={}) {\n            if(this.usesDedicatedApi())return this.requestDedicatedApi(system,input,options);\n            const terminal=this.host.Samsara&&this.host.Samsara.terminal;\n            if(!terminal||typeof terminal.request!=='function'||!terminal.apiReady?.())throw new Error('请在主神终端设置中启用额外模型并选择模型');\n            return terminal.request(system,input,options);\n        }",
"        async requestAI(system,input,options={}) {\n            if(this.usesDedicatedApi()){\n                const api=this.normalizeDedicatedApi(this.config.dedicatedApi);\n                this.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:'请求中',尝试模式:[],usage:null};\n                return this.requestDedicatedApi(system,input,options);\n            }\n            const terminal=this.host.Samsara&&this.host.Samsara.terminal;\n            if(!terminal||typeof terminal.request!=='function'||!terminal.apiReady?.())throw new Error('请在主神终端设置中启用额外模型并选择模型');\n            this.lastTransportInfo={接口:'主神终端额外模型',模型:'',结构化模式:options.structured==='auto'?'auto（由主神终端协商）':'plain',尝试模式:[],usage:null};\n            return terminal.request(system,input,options);\n        }",
'requestAI telemetry')

replace_once(
"            if(system.length+input.length>240000)throw new Error('请求超过24万字，请减少所选条目或正文层数');",
"            if(system.length+input.length>240000)throw new Error('请求超过内部安全上限（'+formatTokenCount(estimateTokens(system)+estimateTokens(input),true)+'），请减少所选条目或正文层数');",
'over-limit token wording')

old_manifest = "return {system,input,schema:copy(WORLD_RESULT_SCHEMA),seedPatches,due,unscheduled,staleActive,timeAnomalies,alienActivity,npcAudit:copy(npcAudit),timeline:copy(timeline),manifest:{输出协议:'WorldResult v1',结构化输出:'auto',读取判定:copy(books.report||[]),世界书条目:books.map(b=>({世界书:b.世界书,条目ID:b.条目ID,名称:b.名称,字符数:b.内容.length})),正文楼层:floors.map(f=>({楼层:f.楼层,角色:f.角色,字符数:f.正文.length})),导入节点:seedPatches.map(p=>tokens(p.path).at(-1)),到期节点:due.map(e=>e.名称),待补时间锚点:unscheduled.map(e=>e.名称),超期活动事件:staleActive.map(e=>e.名称),时间越界记录:timeAnomalies.map(e=>e.类型+'/'+e.名称),程序结构修复:copy(structuralFixes),生命周期整理:copy(lifecycle),NPC构筑审计:npcAudit.map(x=>({名称:x.名称,审计级别:x.审计级别,缺口:copy(x.缺口)})),本轮时间容量:copy(capacity),可选宏观资料补充:needBackbone,请求字符数:system.length+input.length}};"
new_manifest = "return {system,input,schema:copy(WORLD_RESULT_SCHEMA),seedPatches,due,unscheduled,staleActive,timeAnomalies,alienActivity,npcAudit:copy(npcAudit),timeline:copy(timeline),manifest:{输出协议:'WorldResult v1',结构化输出:'auto',接口来源:this.apiSourceLabel(),读取判定:copy(books.report||[]),世界书读取:{实际读取:books.length,检查条目:(books.report||[]).length,跳过:Math.max(0,(books.report||[]).length-books.length)},世界书条目:books.map(b=>({世界书:b.世界书,条目ID:b.条目ID,名称:b.名称,估算Tokens:estimateTokens(b.内容)})),正文楼层:floors.map(f=>({楼层:f.楼层,角色:f.角色,估算Tokens:estimateTokens(f.正文)})),导入节点:seedPatches.map(p=>tokens(p.path).at(-1)),到期节点:due.map(e=>e.名称),待补时间锚点:unscheduled.map(e=>e.名称),超期活动事件:staleActive.map(e=>e.名称),时间越界记录:timeAnomalies.map(e=>e.类型+'/'+e.名称),程序结构修复:copy(structuralFixes),生命周期整理:copy(lifecycle),NPC构筑审计:npcAudit.map(x=>({名称:x.名称,审计级别:x.审计级别,缺口:copy(x.缺口)})),本轮时间容量:copy(capacity),可选宏观资料补充:needBackbone,观测:requestTokenTelemetry(system,input,WORLD_RESULT_SCHEMA)}};"
replace_once(old_manifest, new_manifest, 'manifest token telemetry')

replace_once(
"                    actualRequest.manifest=Object.assign({},copy(request.manifest),{\n                        请求字符数:request.system.length+attemptInput.length,\n                        尝试序号:attempt+1,\n                        最大失败重试:maxRetries,\n                        失败记录:copy(this.lastRetryLog)\n                    });\n                    this.lastRequest=actualRequest;",
"                    actualRequest.manifest=Object.assign({},copy(request.manifest),{\n                        观测:requestTokenTelemetry(request.system,attemptInput,request.schema),\n                        尝试序号:attempt+1,\n                        最大失败重试:maxRetries,\n                        失败记录:copy(this.lastRetryLog)\n                    });\n                    actualRequest.manifest.观测.请求类型=attempt===0?'首次请求':'纠错重试';\n                    this.lastAttemptCount=attempt+1;\n                    this.lastRequest=actualRequest;",
'attempt manifest telemetry')

replace_once(
"                    let received='';\n                    try{\n                        received=String(await this.requestAI(request.system,attemptInput,{signal:this.controller.signal,schema:request.schema,schemaName:'samsara_world_result_v1',structured:'auto',temperature:0.3}));\n                        clearTimeout(timeout);\n                        if(token!==this.generation||this.controller.signal.aborted)throw new Error('请求已取消');\n                        this.lastReply=received;this.lastFailure='';",
"                    let received='',attemptTelemetry=null;\n                    const attemptStarted=Date.now();this.lastTransportInfo=null;\n                    try{\n                        received=String(await this.requestAI(request.system,attemptInput,{signal:this.controller.signal,schema:request.schema,schemaName:'samsara_world_result_v1',structured:'auto',temperature:0.3}));\n                        clearTimeout(timeout);\n                        if(token!==this.generation||this.controller.signal.aborted)throw new Error('请求已取消');\n                        this.lastReply=received;this.lastFailure='';\n                        const elapsed=Math.max(0,Date.now()-attemptStarted),transport=this.lastTransportInfo||{},usage=transport.usage||null,observation=actualRequest.manifest.观测;\n                        Object.assign(observation,{接口来源:transport.接口||this.apiSourceLabel(),模型:transport.模型||'',结构化实际模式:transport.结构化模式||'未知',模式尝试:copy(transport.尝试模式||[]),耗时毫秒:elapsed,输出估算Tokens:estimateTokens(received)});\n                        if(usage){observation.实际输入Tokens=usage.inputTokens;observation.实际输出Tokens=usage.outputTokens;observation.实际总Tokens=usage.totalTokens;}\n                        attemptTelemetry={尝试:attempt+1,结果:'待验收',输入估算Tokens:observation.请求估算Tokens,输出估算Tokens:observation.输出估算Tokens,API输入Tokens:usage?.inputTokens??null,API输出Tokens:usage?.outputTokens??null,API总Tokens:usage?.totalTokens??null,接口:observation.接口来源,模型:observation.模型,结构化模式:observation.结构化实际模式,模式尝试:copy(observation.模式尝试||[]),耗时毫秒:elapsed};\n                        this.lastAttemptTelemetry.push(attemptTelemetry);",
'attempt response telemetry')

replace_once(
"                        prepared={reply,next,current};\n                        this.lastAttemptCount=attempt+1;\n                        break;",
"                        prepared={reply,next,current};\n                        if(attemptTelemetry)attemptTelemetry.结果='接受';\n                        break;",
'attempt accepted telemetry')

replace_once(
"                    }catch(error){\n                        clearTimeout(timeout);\n                        lastError=error;",
"                    }catch(error){\n                        clearTimeout(timeout);\n                        if(attemptTelemetry){attemptTelemetry.结果='拒绝';attemptTelemetry.原因=String(error.message||error);}\n                        else{\n                            const elapsed=Math.max(0,Date.now()-attemptStarted),transport=this.lastTransportInfo||{},observation=actualRequest.manifest.观测;\n                            Object.assign(observation,{接口来源:transport.接口||this.apiSourceLabel(),模型:transport.模型||'',结构化实际模式:transport.结构化模式||'未返回',模式尝试:copy(transport.尝试模式||[]),耗时毫秒:elapsed});\n                            this.lastAttemptTelemetry.push({尝试:attempt+1,结果:'请求失败',输入估算Tokens:observation.请求估算Tokens,输出估算Tokens:0,API输入Tokens:null,API输出Tokens:null,API总Tokens:null,接口:observation.接口来源,模型:observation.模型,结构化模式:observation.结构化实际模式,模式尝试:copy(observation.模式尝试||[]),耗时毫秒:elapsed,原因:String(error.message||error)});\n                        }\n                        lastError=error;",
'attempt failure telemetry')

replace_once(
"            this.lastRequest=null;this.previewRequest=null;this.lastReply='';this.lastFailure='';\n            this.lastRetryLog=[];this.lastAttemptCount=0;this.lastWorldResult=null;this.lastCompiledPatches=[];this.lastCompileWarnings=[];",
"            this.lastRequest=null;this.previewRequest=null;this.lastReply='';this.lastFailure='';\n            this.lastRetryLog=[];this.lastAttemptCount=0;this.lastAttemptTelemetry=[];this.lastTransportInfo=null;this.lastWorldResult=null;this.lastCompiledPatches=[];this.lastCompileWarnings=[];",
'reset telemetry state')

# Prompt editor length badges become token estimates; hard character limits remain internal validation only.
count = text.count("'+part.body.length+' 字")
if count != 2:
    raise SystemExit(f'prompt segment char badges: expected 2 matches, got {count}')
text = text.replace("'+part.body.length+' 字", "'+formatTokenCount(estimateTokens(part.body),true)+'")

ui_pattern = re.escape("                const retryLog=(this.lastRetryLog||[]).map(item=>'<div class=\"we-change\"><time>#'+text(item.重试)+'</time><div><b>模型回复被拒绝</b><p>'+text(item.错误)+'</p></div></div>').join('');") + r"[\s\S]*?(?=                if\(this\.lastWorldResult\))"
ui_repl = r'''                const retryLog=(this.lastRetryLog||[]).map(item=>'<div class="we-change"><time>#'+text(item.重试)+'</time><div><b>模型回复被拒绝</b><p>'+text(item.错误)+'</p></div></div>').join('');
                const tokenLabel=(value,estimated=true)=>Number.isFinite(Number(value))?formatTokenCount(Number(value),estimated):'—';
                const attemptRows=(this.lastAttemptTelemetry||[]).map(item=>({
                    名称:'尝试 #'+item.尝试,
                    结果:item.结果,
                    输入:item.API输入Tokens!=null?tokenLabel(item.API输入Tokens,false):tokenLabel(item.输入估算Tokens,true),
                    输出:item.API输出Tokens!=null?tokenLabel(item.API输出Tokens,false):tokenLabel(item.输出估算Tokens,true),
                    总量:item.API总Tokens!=null?tokenLabel(item.API总Tokens,false):'',
                    接口:item.接口,
                    模型:item.模型,
                    结构化模式:item.结构化模式,
                    模式尝试:Array.isArray(item.模式尝试)&&item.模式尝试.length?item.模式尝试.join(' → '):'',
                    耗时:Number.isFinite(Number(item.耗时毫秒))?(Number(item.耗时毫秒)/1000).toFixed(2).replace(/\.00$/,'')+' s':'',
                    原因:item.原因||''
                }));
                html+=section('失败自动重试','<div class="we-config-row"><label>失败重试次数 <input data-retries type="number" min="0" max="5" value="'+text(this.config.retryAttempts??3)+'"> 次</label><span class="we-muted">首次请求失败后，最多再请求这么多次；默认 3，最大 5。只纠正 WorldResult 业务结果/编译校验，危险越权、上下文变化和写入未确认不会自动重试。</span></div>'+(this.lastAttemptCount?'<p class="we-muted">最近一次共尝试 '+text(this.lastAttemptCount)+' 次。</p>':'')+(retryLog||'')+(attemptRows.length?fold('每次尝试观测（点击展开）',readable('尝试',attemptRows)) : ''));
                html+='<div class="we-tools"><button data-action="preview">生成下一次请求预览（不调用 API）</button></div>';
                for(const [label,r] of [['最近实际发送',this.lastRequest],['下一次请求预览',this.previewRequest]]){
                    if(!r){html+=section(label,empty('暂无'+label));continue;}
                    const m=r.manifest||{},books=m.世界书条目||[],floors=m.正文楼层||[],obs=m.观测||requestTokenTelemetry(r.system,r.input,r.schema||WORLD_RESULT_SCHEMA);
                    const exactInput=obs.实际输入Tokens!=null,exactOutput=obs.实际输出Tokens!=null;
                    let body='<div class="we-request-summary">'+pill(m.输出协议||'WorldResult v1','dim')+pill('结构化 '+(obs.结构化实际模式||m.结构化输出||'auto'),'dim')+pill(obs.接口来源||m.接口来源||this.apiSourceLabel(),'dim')+pill(books.length+' 条世界书','dim')+pill(floors.length+' 层正文','dim')+pill((exactInput?tokenLabel(obs.实际输入Tokens,false):tokenLabel(obs.请求估算Tokens,true))+' 输入','dim')+(obs.输出估算Tokens!=null?pill((exactOutput?tokenLabel(obs.实际输出Tokens,false):tokenLabel(obs.输出估算Tokens,true))+' 输出','dim'):'')+(m.尝试序号?pill('尝试 '+m.尝试序号,'dim'):'')+(m.最大失败重试!==undefined?pill('最多重试 '+m.最大失败重试,'dim'):'')+'</div>';
                    body+='<p class="we-muted">带“≈”的 tk 为本地估算；不同模型 tokenizer 会有差异。专属 API 返回 usage 时，输入/输出总量改用服务端实际 token；分段构成仍保持估算。Schema 已包含在 system 内，不要与 system 再相加。</p>';
                    body+=fold('Token 构成（点击展开）',fields({总输入:exactInput?tokenLabel(obs.实际输入Tokens,false):tokenLabel(obs.请求估算Tokens,true),System:tokenLabel(obs.System估算Tokens,true),User:tokenLabel(obs.User估算Tokens,true),Schema子项:tokenLabel(obs.Schema估算Tokens,true),世界书:tokenLabel(books.reduce((sum,item)=>sum+(Number(item.估算Tokens)||0),0),true),正文:tokenLabel(floors.reduce((sum,item)=>sum+(Number(item.估算Tokens)||0),0),true),接口:obs.接口来源||m.接口来源||'',模型:obs.模型||'',模式尝试:Array.isArray(obs.模式尝试)&&obs.模式尝试.length?obs.模式尝试.join(' → '):'',耗时:Number.isFinite(Number(obs.耗时毫秒))?(Number(obs.耗时毫秒)/1000).toFixed(2).replace(/\.00$/,'')+' s':''})+fold('system 分段',fields({分段:(obs.System分段||[]).map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))}))+fold('user 分段',fields({分段:(obs.User分段||[]).map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))})));
                    body+=fold('资料清单与命中判定（点击展开）',readable('条目',m.读取判定||[])+fold('实际读取世界书',fields({条目:books.map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))}))+fold('实际正文楼层',fields({楼层:floors.map(f=>'第 '+f.楼层+' 层 · '+f.角色+' · '+tokenLabel(f.估算Tokens,true))}))+fold('时间容量',fields(m.本轮时间容量||{})));
                    body+=fold('输出契约 · JSON Schema',raw('samsara_world_result_v1',JSON.stringify(r.schema||WORLD_RESULT_SCHEMA,null,2)));
                    body+=fold('system · 分段阅读',r.system.split(/\n(?=【)/).map((part,i)=>fold((part.match(/^【([^】]+)】/)||[])[1]||'身份 / 协议 '+(i+1),'<div class="we-prose">'+text(part)+'</div>')).join(''))+raw('system · 完整原文',r.system);
                    let payload;try{payload=JSON.parse(r.input);}catch(_){payload={正文:r.input};}
                    body+=fold('user · 分段阅读',Object.entries(payload).map(([name,v])=>fold(name,readable(name,v))).join(''))+raw('user · 完整原文',r.input);
                    html+=section(label,body);
                }
'''
regex_once(ui_pattern, ui_repl, 'request inspection UI', flags=re.M)

replace_once(
"                if(this.lastReply)html+=section('副 API 原始回复',raw('查看模型返回原文（用于定位格式问题）',this.lastReply));",
"                if(this.lastReply){const lastAttempt=(this.lastAttemptTelemetry||[]).at(-1),replyTk=lastAttempt?.API输出Tokens!=null?formatTokenCount(lastAttempt.API输出Tokens,false):formatTokenCount(estimateTokens(this.lastReply),true);html+=section('副 API 原始回复 · '+replyTk,raw('查看模型返回原文（用于定位格式问题）',this.lastReply));}",
'raw reply token badge')

old_export = "projectHotWorldPeople,WORLD_UI_THEMES,WORLD_FONT_SCALES}; return; }"
new_export = "projectHotWorldPeople,WORLD_UI_THEMES,WORLD_FONT_SCALES,estimateTokens,formatTokenCount,normalizeTokenUsage,requestTokenTelemetry}; return; }"
replace_once(old_export, new_export, 'export observability helpers')

path.write_text(text, encoding='utf-8')
print('P1-C observability source refactor staged')
