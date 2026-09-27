    class WorldDueEventPolicy {
        constructor(timePolicy=DEFAULT_WORLD_TIME_POLICY){this.timePolicy=timePolicy||DEFAULT_WORLD_TIME_POLICY;}

        reviewPoint(event) {
            const nextCheck=String(event?.下次检查||'').trim();
            if(nextCheck)return {原文:nextCheck,键:this.timePolicy.key(nextCheck),来源:'下次检查'};
            const planned=String(event?.时间||event?.开始时间||'').trim();
            return {原文:planned,键:this.timePolicy.key(planned),来源:'计划时间'};
        }

        review(stat) {
            const now=this.timePolicy.key(stat?.世界?.时间);if(now===null)return [];
            const events=stat?.世界?.[PATH]?.事件||{},due=[];
            for(const [名称,event] of Object.entries(events)){
                if(!plain(event)||event.状态!=='待发生')continue;
                const review=this.reviewPoint(event);
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

        ensureHandled(_next,_dueList,_worldTime) {
            return [];
        }
    }

    const DEFAULT_WORLD_DUE_EVENT_POLICY=new WorldDueEventPolicy();
    function dueEventReviewPoint(event){return DEFAULT_WORLD_DUE_EVENT_POLICY.reviewPoint(event);}
    function relaxedDueEvents(stat){return DEFAULT_WORLD_DUE_EVENT_POLICY.review(stat);}
