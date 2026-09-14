    // 活跃异端活动时间戳：模型提交活动事实，程序统一写入当前世界时间，避免等价时间字符串触发误拒绝。
    const activeAlienActivityRequirementsBeforeTimestampNormalization=activeAlienActivityRequirements;
    activeAlienActivityRequirements=function(stat) {
        return activeAlienActivityRequirementsBeforeTimestampNormalization(stat).map(item=>Object.assign({},item,{
            要求:'本轮必须在 WorldResult.人物 中提交该活跃异端的活动复核；至少给出非空地点、目标、行动。更新时间由程序统一记录为当前世界时间；若本轮已确认其死亡，则只把异端状态更新为死亡，不再提交人物活动。'
        }));
    };

    const compileWorldResultBeforeAlienActivityNormalization=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=normalizeWorldResult(value);
        const roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
        const plannedDead=new Set((result.异端||[])
            .filter(item=>item?.操作!=='撤销本轮'&&item?.状态==='死亡')
            .map(item=>nameKey(item.名称)));
        const worldTime=String(stat?.世界?.时间||'').trim();
        if(worldTime&&Array.isArray(result.人物)){
            for(const item of result.人物){
                if(!plain(item)||item.操作==='撤销本轮')continue;
                const rosterName=stableNameIn(roster,item.名称),alien=rosterName?roster[rosterName]:null;
                if(!alien||alien.状态==='死亡'||plannedDead.has(nameKey(rosterName||item.名称)))continue;
                const submitted=String(item.地点||'').trim()&&String(item.目标||'').trim()&&String(item.行动||'').trim();
                if(submitted)item.更新时间=worldTime;
            }
        }
        return compileWorldResultBeforeAlienActivityNormalization(stat,result);
    };

    ensureActiveAlienActivity=function(next,required,acceptedResult,worldTime) {
        const roster=next?.世界?.异端雷达?.名单||{},people=next?.世界?.[PATH]?.人物||{},proposals=acceptedResult?.人物||[],missing=[];
        for(const item of required||[]){
            const rosterName=stableNameIn(roster,item.雷达名称||item.名称),alien=rosterName?roster[rosterName]:null;
            if(!alien||alien.状态==='死亡')continue;
            const personName=stableNameIn(people,item.名称)||stableNameIn(people,rosterName),person=personName?people[personName]:null;
            const proposal=proposals.find(p=>nameKey(p.名称)===nameKey(item.名称)||nameKey(p.名称)===nameKey(rosterName));
            const submitted=proposal&&String(proposal.地点||'').trim()&&String(proposal.目标||'').trim()&&String(proposal.行动||'').trim();
            const complete=person&&String(person.地点||'').trim()&&String(person.目标||'').trim()&&String(person.行动||'').trim()&&sameWorldTimeAnchor(person?.更新时间,worldTime);
            if(!submitted||!complete)missing.push(rosterName||item.名称);
        }
        if(missing.length)throw new Error('异端活动未复核：'+missing.join('、')+'；活跃异端每轮都必须提交人物活动并写明地点、目标、行动；更新时间由程序统一记录为当前世界时间；若已死亡则更新异端状态为死亡');
    };

    const retryPlanForFailureBeforeAlienActivityNormalization=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        return retryPlanForFailureBeforeAlienActivityNormalization(error,rejected).map(item=>String(item).replace(
            '在 WorldResult.人物 中补写该活跃异端本轮的地点、目标、行动，并把更新时间精确写为当前世界时间；若本轮已确认死亡',
            '在 WorldResult.人物 中补写该活跃异端本轮的地点、目标、行动；更新时间由程序统一记录为当前世界时间；若本轮已确认死亡'
        ));
    };
