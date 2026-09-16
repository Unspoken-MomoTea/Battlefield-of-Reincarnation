    // 到期事件采用宽松复核：只阻止“完全无视”，不再把条件/更新时间/下次检查绑成三项硬门槛。
    function dueEventReviewPoint(event) {
        const nextCheck=String(event?.下次检查||'').trim();
        if(nextCheck){
            const key=worldDateKey(nextCheck);
            return {原文:nextCheck,键:key,来源:'下次检查',语义延期:key===null};
        }
        const planned=String(event?.时间||event?.开始时间||'').trim();
        return {原文:planned,键:worldDateKey(planned),来源:'计划时间',语义延期:false};
    }
    function relaxedDueEvents(stat) {
        const now=worldDateKey(stat?.世界?.时间);if(now===null)return [];
        const events=stat?.世界?.[PATH]?.事件||{},due=[];
        for(const [名称,event] of Object.entries(events)){
            if(!plain(event)||event.状态!=='待发生')continue;
            const review=dueEventReviewPoint(event);
            // 已明确写了无法换算成日历时钟的语义复核点时，不再拿旧计划日期反复催办。
            if(review.来源==='下次检查'&&review.语义延期)continue;
            if(review.键===null||review.键>now)continue;
            due.push({
                名称,
                时间:String(event.时间||event.开始时间||''),
                下次检查:String(event.下次检查||''),
                条件:String(event.条件||''),
                前因:copy(event.前因||[]),
                复核依据:review.来源,
                说明:'已到复核时间。条件/前因满足则转为进行中；若暂不发生，更新该事件即可，优先填写新的“下次检查”。“条件”仍只表示事件触发条件，不要改写成延期阻碍。',
                原始事件:copy(event)
            });
        }
        return due;
    }
    function publicDueEvent(item) {
        if(!plain(item))return item;
        const out=copy(item);delete out.原始事件;return out;
    }

    // 原规则要求 更新时间===当前时间 + 下次检查 + 条件 三项同时成立，极易让一次世界推进连续重试到上限。
    // 新规则只要求模型没有完全无视到期事件：状态改变，或事件本身有任意实际更新，即视为完成本轮复核。
    ensureDueHandled=function(next,dueList,worldTime) {
        const now=worldDateKey(worldTime);
        for(const due of dueList||[]){
            const event=next?.世界?.[PATH]?.事件?.[due?.名称];
            if(!event||event.状态!=='待发生')continue;
            if(plain(due?.原始事件)&&!same(event,due.原始事件))continue;
            const nextCheck=String(event.下次检查||'').trim(),nextKey=worldDateKey(nextCheck);
            // 兼容旧调用：若没有原始快照，但已经给出了未来/语义复核点，也不要再驳回。
            if(!plain(due?.原始事件)&&nextCheck&&(nextKey===null||now===null||nextKey>now))continue;
            throw new Error('到期事件未处理：'+due.名称+'。已到复核时间；条件满足就改为“进行中”，否则只需更新该事件，优先填写新的“下次检查”。不要求填写“阻碍条件”，也不要求手工同步“更新时间”。');
        }
    };

    const retryPlanForFailureBeforeDueEventRelaxation=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        const plan=retryPlanForFailureBeforeDueEventRelaxation(error,rejected),message=String(error?.message||error||'');
        const match=message.match(/到期事件未处理：([^。]+)/);if(!match)return plan;
        const replacement='到期事件/'+match[1]+'：只需二选一——条件已满足就改为“进行中”；否则更新该事件，优先填写新的“下次检查”。不要把“条件”改写成阻碍说明，也不需要手工写“更新时间”。';
        let replaced=false;
        const out=(Array.isArray(plan)?plan:[]).map(item=>{
            if(/^到期事件\//.test(String(item))&&String(item).includes(match[1])){replaced=true;return replacement;}
            return item;
        });
        if(!replaced)out.unshift(replacement);
        return out;
    };

    const SamsaraWorldEngineBeforeDueEventRelaxation=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeDueEventRelaxation {
        async buildRequest(base) {
            const request=await super.buildRequest(base),due=relaxedDueEvents(base?.stat||{});
            request.due=due;
            try{
                const payload=JSON.parse(request.input);
                payload.本轮必须复核的到期事件=due.map(publicDueEvent);
                request.input=JSON.stringify(payload,null,2);
            }catch(_){}
            if(request.manifest)request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema);
            return request;
        }
    };
