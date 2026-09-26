    // 请求检查页纯渲染：只读展示最近请求、重试诊断与 WorldResult 编译结果。
    function worldEngineRenderRequestInspector(ctx) {
        const {engine,text,section,empty,fields,pill}=ctx;
        let html='';
        const fold=(title,body)=>'<details class="we-inspect"><summary>'+text(title)+'</summary><div class="we-inspect-body">'+body+'</div></details>';
        const raw=(label,v)=>fold(label,'<textarea class="we-raw" readonly>'+text(v)+'</textarea>');
        const readable=(name,v)=>Array.isArray(v)?v.map((item,i)=>fold((item.名称||item.楼层!==undefined&&(item.角色+' · 第 '+item.楼层+' 层')||name+' '+(i+1)),fields(item))).join(''):fields(plain(v)?v:{内容:v});
        const retryLog=(engine.lastRetryLog||[]).map(item=>{
            const feedback=retryFeedback(item.错误,Array.isArray(item.片段)?item.片段:[],Array.isArray(item.补充清单)?item.补充清单:[]);
            const details=feedback.issues.length?'<p><b>具体问题</b><br>'+feedback.issues.map(text).join('<br>')+'</p>':'';
            const guidance=feedback.actions.length?'<p><b>修复要求</b><br>'+feedback.actions.map(text).join('<br>')+'</p>':'';
            return '<div class="we-change"><time>#'+text(item.尝试)+'</time><div><b>模型回复被拒绝</b><p>'+text(feedback.summary)+'</p>'+details+guidance+'</div></div>';
        }).join('');
        const tokenLabel=(value,estimated=true)=>Number.isFinite(Number(value))?formatTokenCount(Number(value),estimated):'—';
        html+=section('失败自动重试','<div class="we-config-row"><label>最大尝试次数 <input data-retries type="number" min="1" max="5" value="'+text(engine.config.retryAttempts??5)+'"> 次</label><span class="we-muted">包含首次请求。1 = 只请求一次；5 = 最多总共尝试 5 次。只纠正 WorldResult 业务结果/编译校验，危险越权、上下文变化和写入未确认不会自动重试。</span></div>'+(engine.lastAttemptCount?'<p class="we-muted">最近一次共尝试 '+text(engine.lastAttemptCount)+' 次；每次模型业务拒绝都会在下方完整保留，包括最后一次失败。</p>':'')+(retryLog||''));
        html+='<div class="we-tools"><button data-action="preview">生成下一次请求预览（不调用 API）</button></div>';
        for(const [label,r] of [['最近实际发送',engine.lastRequest],['下一次请求预览',engine.previewRequest]]){
            if(!r){html+=section(label,empty('暂无'+label));continue;}
            const m=r.manifest||{},books=m.世界书条目||[],floors=m.正文楼层||[],obs=m.观测||requestTokenTelemetry(r.system,r.input,r.schema||WORLD_RESULT_SCHEMA);
            const readChecks=(m.读取判定||[]).filter(item=>item.读取===true);
            const exactInput=obs.实际输入Tokens!=null,exactOutput=obs.实际输出Tokens!=null;
            let body='<div class="we-request-summary">'+pill(m.输出协议||'WorldResult v1','dim')+pill('结构化 '+(obs.结构化实际模式||m.结构化输出||'auto'),'dim')+pill(obs.接口来源||m.接口来源||engine.apiSourceLabel(),'dim')+pill(books.length+' 条世界书','dim')+pill(floors.length+' 层正文','dim')+pill((exactInput?tokenLabel(obs.实际输入Tokens,false):tokenLabel(obs.请求估算Tokens,true))+' 输入','dim')+(obs.输出估算Tokens!=null?pill((exactOutput?tokenLabel(obs.实际输出Tokens,false):tokenLabel(obs.输出估算Tokens,true))+' 输出','dim'):'')+(m.尝试序号?pill('尝试 '+m.尝试序号,'dim'):'')+(m.最大尝试次数!==undefined?pill('最多尝试 '+m.最大尝试次数,'dim'):'')+'</div>';
            const userTokenFields=Object.fromEntries((obs.User分段||[]).map(item=>[item.名称,tokenLabel(item.估算Tokens,true)]));
            body+='<p class="we-muted">带“≈”的 tk 只是本地容量粗估，不等于服务商真实 token；主神终端通道拿不到 usage 时无法确认精确总量。总输入 = System + 下列 User 分项；这里不再重复显示 User 总项或 Schema 子项。专属 API 返回 usage 时仅总输入/输出改用服务端实际 token。</p>';
            body+=fold('Token 构成（点击展开）',fields(Object.assign({总输入:exactInput?tokenLabel(obs.实际输入Tokens,false):tokenLabel(obs.请求估算Tokens,true),System:tokenLabel(obs.System估算Tokens,true)},userTokenFields,{接口:obs.接口来源||m.接口来源||'',模型:obs.模型||'',模式尝试:Array.isArray(obs.模式尝试)&&obs.模式尝试.length?obs.模式尝试.join(' → '):'',耗时:Number.isFinite(Number(obs.耗时毫秒))?(Number(obs.耗时毫秒)/1000).toFixed(2).replace(/\.00$/,'')+' s':''}))+fold('system 分段',fields({分段:(obs.System分段||[]).map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))})));
            body+=fold('本轮实际读取资料（点击展开）',(readChecks.length?readable('条目',readChecks):empty('本轮未读取世界书','没有勾选命中或强制读取的世界书条目。'))+fold('实际读取世界书',fields({条目:books.map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))}))+fold('实际正文楼层',fields({楼层:floors.map(f=>'第 '+f.楼层+' 层 · '+f.角色+' · '+tokenLabel(f.估算Tokens,true))}))+fold('时间容量',fields(m.本轮时间容量||{})));
            body+=fold('输出契约 · JSON Schema',raw('samsara_world_result_v1',JSON.stringify(r.schema||WORLD_RESULT_SCHEMA,null,2)));
            body+=fold('system · 分段阅读',r.system.split(/\n(?=【)/).map((part,i)=>fold((part.match(/^【([^】]+)】/)||[])[1]||'身份 / 协议 '+(i+1),'<div class="we-prose">'+text(part)+'</div>')).join(''))+raw('system · 实际发送原文',r.system);
            let payload;try{payload=JSON.parse(r.input);}catch(_){payload={正文:r.input};}
            body+=fold('user · 分段阅读',Object.entries(payload).map(([name,v])=>fold(name,readable(name,v))).join(''))+raw('user · 实际发送原文',r.input);
            html+=section(label,body);
        }
        if(engine.lastWorldResult)html+=section('最近 WorldResult · 业务层',raw('模型已接受并累计的业务结果',JSON.stringify(engine.lastWorldResult,null,2)));
        if((engine.lastCompiledPatches||[]).length)html+=section('程序编译补丁 · 存储层',raw('由 WorldResult Compiler 生成，模型不直接控制这些路径',JSON.stringify(engine.lastCompiledPatches,null,2)));
        if((engine.lastCompileWarnings||[]).length)html+=section('编译警告',(engine.lastCompileWarnings||[]).map(w=>'<div class="we-notice">'+text(w)+'</div>').join(''));
        if(engine.lastFailure)html+='<div class="we-notice">'+text(engine.lastFailure)+'</div>';
        if(engine.lastReply){
            const lastAttempt=(engine.lastAttemptTelemetry||[]).at(-1),replyTk=lastAttempt?.API输出Tokens!=null?formatTokenCount(lastAttempt.API输出Tokens,false):formatTokenCount(estimateTokens(engine.lastReply),true);
            html+=section('副 API 原始回复 · '+replyTk,raw('查看模型返回原文（用于定位格式问题）',engine.lastReply));
        }
        return html;
    }
