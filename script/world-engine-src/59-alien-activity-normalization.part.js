    // 活跃异端不再“每轮强制改策”。已有完整活动默认持续，仅在初始化、复核到期、关联事件/所在地区变化或长期未复核时要求提交新活动。
    const ALIEN_ACTIVITY_STALE_HOURS=24;
    function alienActivityReviewReasons(stat,item) {
        const people=stat?.世界?.[PATH]?.人物||{};
        const personName=stableNameIn(people,item?.名称)||stableNameIn(people,item?.雷达名称),person=personName?people[personName]:null;
        const reasons=[];
        const factsComplete=!!(person&&String(person.地点||'').trim()&&String(person.目标||'').trim()&&String(person.行动||'').trim());
        if(!factsComplete)reasons.push('活动档案缺失');

        const now=worldDateKey(stat?.世界?.时间),updated=worldDateKey(person?.更新时间),nextCheck=worldDateKey(person?.下次检查);
        if(now!==null&&nextCheck!==null&&nextCheck<=now)reasons.push('下次检查到期');
        if(factsComplete&&now!==null&&updated!==null&&now-updated>=ALIEN_ACTIVITY_STALE_HOURS)reasons.push('活动已超过24小时未复核');

        const linkedEvents=new Set(Array.isArray(person?.关联事件)?person.关联事件.filter(Boolean):[]);
        const location=String(person?.地点||'').trim();
        for(const change of stat?.世界?.[PATH]?.最近变化||[]){
            if(!plain(change))continue;
            const category=String(change.类别||change.类型||'').trim(),name=String(change.名称||'').trim();
            if(name&&/事件/.test(category)&&linkedEvents.has(name))reasons.push('关联事件变化');
            if(name&&/(?:势力地区|地区)/.test(category)&&location&&worldLocationRelated(location,name))reasons.push('所在地区变化');
        }
        return Array.from(new Set(reasons));
    }

    const activeAlienActivityRequirementsBeforeTimestampNormalization=activeAlienActivityRequirements;
    activeAlienActivityRequirements=function(stat) {
        return activeAlienActivityRequirementsBeforeTimestampNormalization(stat).map(item=>{
            const reasons=alienActivityReviewReasons(stat,item);
            if(!reasons.length)return null;
            return Object.assign({},item,{
                触发原因:reasons,
                要求:'仅因本轮触发复核才需要在 WorldResult.人物 中提交该活跃异端的新活动；至少给出非空地点、目标、行动。人物更新时间无需抄写，由程序使用本轮最终世界时间统一记录。未获得新情报时沿用既有目标/行动，不得因为模型看见<user>行为就自动追踪或改策；若因<user>行为改变目标/行动，必须已有认知或同轮写入可追溯的认知/认知来源。若本轮已确认死亡，则只把异端状态更新为死亡。'
            });
        }).filter(Boolean);
    };

    const compileWorldResultBeforeAlienActivityNormalization=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=normalizeWorldResult(value);
        const roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
        const plannedDead=new Set((result.异端||[])
            .filter(item=>item?.操作!=='撤销本轮'&&item?.状态==='死亡')
            .map(item=>nameKey(item.名称)));
        const proposedTime=typeof resolveWorldTimeProposal==='function'?resolveWorldTimeProposal(stat,result):'';
        const worldTime=String(proposedTime||stat?.世界?.时间||'').trim();
        if(Array.isArray(result.人物)){
            for(const item of result.人物){
                if(!plain(item)||item.操作==='撤销本轮')continue;
                const rosterName=stableNameIn(roster,item.名称),alien=rosterName?roster[rosterName]:null;
                if(!alien||alien.状态==='死亡'||plannedDead.has(nameKey(rosterName||item.名称)))continue;
                const submitted=String(item.地点||'').trim()&&String(item.目标||'').trim()&&String(item.行动||'').trim();
                if(!submitted)continue;
                if(worldTime)item.更新时间=worldTime;
                else delete item.更新时间;
            }
        }
        return compileWorldResultBeforeAlienActivityNormalization(stat,result);
    };

    ensureActiveAlienActivity=function(next,required,acceptedResult,worldTime) {
        const roster=next?.世界?.异端雷达?.名单||{},people=next?.世界?.[PATH]?.人物||{},proposals=acceptedResult?.人物||[],missing=[];
        const canonicalTime=String(next?.世界?.时间||worldTime||'').trim();
        for(const item of required||[]){
            const rosterName=stableNameIn(roster,item.雷达名称||item.名称),alien=rosterName?roster[rosterName]:null;
            if(!alien||alien.状态==='死亡')continue;
            const personName=stableNameIn(people,item.名称)||stableNameIn(people,rosterName),person=personName?people[personName]:null;
            const proposal=proposals.find(p=>nameKey(p.名称)===nameKey(item.名称)||nameKey(p.名称)===nameKey(rosterName));
            const submitted=proposal&&String(proposal.地点||'').trim()&&String(proposal.目标||'').trim()&&String(proposal.行动||'').trim();
            const factsComplete=person&&String(person.地点||'').trim()&&String(person.目标||'').trim()&&String(person.行动||'').trim();
            const timeComplete=!canonicalTime||sameWorldTimeAnchor(person?.更新时间,canonicalTime);
            if(!submitted||!factsComplete||!timeComplete)missing.push(rosterName||item.名称);
        }
        if(missing.length)throw new Error('异端活动未复核：'+missing.join('、')+'；仅本轮触发复核的活跃异端需要提交地点、目标、行动，人物更新时间由程序使用世界时间统一记录。未触发者沿用既有活动，不得为了刷新而凭空改策；若已死亡则更新异端状态为死亡');
    };

    const retryPlanForFailureBeforeAlienActivityNormalization=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        return retryPlanForFailureBeforeAlienActivityNormalization(error,rejected).map(item=>String(item)
            .replace('在 WorldResult.人物 中补写该活跃异端本轮的地点、目标、行动，并把更新时间精确写为当前世界时间；若本轮已确认死亡','仅对本轮触发复核的该活跃异端补写地点、目标、行动；人物更新时间由程序使用世界时间统一记录；若本轮已确认死亡')
            .replace('在 WorldResult.人物 中补写该活跃异端本轮的地点、目标、行动；更新时间由程序统一记录为当前世界时间；若本轮已确认死亡','仅对本轮触发复核的该活跃异端补写地点、目标、行动；人物更新时间由程序使用世界时间统一记录；若本轮已确认死亡')
            .replace('在 WorldResult.人物 中补写该活跃异端本轮的地点、目标、行动；人物更新时间由程序使用世界时间统一记录；若本轮已确认死亡','仅对本轮触发复核的该活跃异端补写地点、目标、行动；人物更新时间由程序使用世界时间统一记录；若本轮已确认死亡')
        );
    };
