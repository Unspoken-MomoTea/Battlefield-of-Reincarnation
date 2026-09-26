    // 到期事件采用软复核：提醒模型处理，但不再作为整轮写入的硬门槛。
    function dueEventReviewPoint(event) {
        const nextCheck=String(event?.下次检查||'').trim();
        if(nextCheck)return {原文:nextCheck,键:worldDateKey(nextCheck),来源:'下次检查'};
        const planned=String(event?.时间||event?.开始时间||'').trim();
        return {原文:planned,键:worldDateKey(planned),来源:'计划时间'};
    }
    function relaxedDueEvents(stat) {
        const now=worldDateKey(stat?.世界?.时间);if(now===null)return [];
        const events=stat?.世界?.[PATH]?.事件||{},due=[];
        for(const [名称,event] of Object.entries(events)){
            if(!plain(event)||event.状态!=='待发生')continue;
            const review=dueEventReviewPoint(event);
            // 明确的未来复核时间尚未到，不重复催办；语义型“下次检查”无法比较时只做软提醒，不阻断写入。
            if(review.来源==='下次检查'&&review.键!==null&&review.键>now)continue;
            if(review.来源==='计划时间'&&(review.键===null||review.键>now))continue;
            due.push({
                名称,
                时间:String(event.时间||event.开始时间||''),
                下次检查:String(event.下次检查||''),
                条件:String(event.条件||''),
                前因:copy(event.前因||[]),
                复核依据:review.来源,
                说明:'软提醒：该事件已到计划/复核时间。条件与前因满足则转为进行中；若暂不发生，可保持待发生并优先填写新的“下次检查”。“条件”只表示事件触发条件，不要改写成延期阻碍。未处理不会导致本轮世界推进被驳回。'
            });
        }
        return due;
    }

    // 旧版会要求“更新时间===当前时间 + 下次检查 + 条件”三项齐全，否则整轮驳回。
    // 到期事件现在只作为模型的软复核清单；未处理时保留原事件，下一轮继续提醒，而不是制造重试死循环。
    ensureDueHandled=function() { return []; };
