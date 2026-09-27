    class WorldValidationPolicy {
        constructor(timeline,duePolicy,activityPolicy,softMaintenancePolicy){this.timeline=timeline||DEFAULT_WORLD_TIMELINE_POLICY;this.duePolicy=duePolicy||DEFAULT_WORLD_DUE_EVENT_POLICY;this.activityPolicy=activityPolicy||DEFAULT_WORLD_ACTIVITY_POLICY;this.softMaintenancePolicy=softMaintenancePolicy||DEFAULT_WORLD_SOFT_MAINTENANCE_POLICY;}
        ensureDueHandled(next,dueList,worldTime) { return this.duePolicy.ensureHandled(next,dueList,worldTime); }

        unscheduledEvents(stat) { return this.softMaintenancePolicy.unscheduledEvents(stat); }

        ensureEventTimeAnchors(next,required=[]) { return this.softMaintenancePolicy.ensureEventTimeAnchors(next,required); }

        ensureStaleActiveHandled(next,required=[],worldTime='') {
            const now=worldDateKey(worldTime),state=next?.世界?.[PATH];
            const unresolved=[],resolved=[];
            for(const item of required||[]){
                const event=state?.事件?.[item.名称];
                if(!event)continue;
                if(['已完成','已取消'].includes(event.状态)){resolved.push(item.名称);continue;}
                const updated=worldDateKey(event.更新时间);
                if(event.状态==='进行中'&&updated!==null&&now!==null&&updated===now&&String(event.下次检查||'').trim())continue;
                unresolved.push(item.名称);
            }
            if(unresolved.length)throw new Error('超期活动事件仍未复核：'+unresolved.join('、')+'；局部事件跨越过长时间仍标记进行中，必须结束/取消，或更新到当前时间并填写下次检查');
            // 对“本轮刚刚确认早已结束”的陈旧局部事件绕过24小时展示宽限：
            // 清理人物/地区/传播的软引用；若没有活跃事件继续依赖它，则立即压成历史。
            for(const name of resolved){
                const event=state?.事件?.[name];if(!event)continue;
                detachEventSoftRefs(state,name);
                const hardRef=Object.entries(state.事件||{}).some(([other,record])=>other!==name&&!['已完成','已取消'].includes(record?.状态)&&Array.isArray(record?.前因)&&record.前因.includes(name));
                if(!hardRef)archiveFinishedEvent(next,state,name,event,[]);
            }
        }

        ensureTemporalAnomaliesResolved(next,required=[]) {
            if(!(required||[]).length)return;
            // Validation must observe runtime decorators applied to temporalAnomalies.
            const remaining=temporalAnomalies(next);
            const keys=new Set((required||[]).map(item=>item.类型+'\u0000'+item.名称));
            const bad=remaining.filter(item=>keys.has(item.类型+'\u0000'+item.名称));
            if(bad.length)throw new Error('时间越界记录仍未修复：'+bad.map(item=>item.类型+'/'+item.名称+'('+item.字段+'='+item.值+')').join('、'));
        }

        ensureMacroBackbone(next,timeline,required=true) {
            if(required&&timeline?.需要补充远期){
                const allMacro=Object.entries(next?.世界?.[PATH]?.事件||{}).filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消');
                const activeMacro=allMacro.filter(([,e])=>e.状态==='进行中');
                const futureMacro=allMacro.filter(([,e])=>e.状态==='待发生');
                const openMacro=allMacro.filter(([,e])=>['进行中','待发生'].includes(e.状态));
                if(openMacro.length<3)throw new Error('宏观事件不足：需要至少3个可推进宏观节点（进行中+待发生），当前仅'+openMacro.length+'个（进行中'+activeMacro.length+'个，待发生'+futureMacro.length+'个）');
                const stages=this.timeline.storyStages(next?.世界?.因果轨道?.故事线);
                const names=new Set(allMacro.map(([name])=>name));
                if(stages.length<3||stages.length>5||stages.some(name=>!names.has(name)))throw new Error('因果轨道未形成有效宏观投影：请用已建立的宏观节点生成3~5节点故事线');
            }
            return this.activityPolicy.ensureDelivery(next,timeline?.世界活动要求);
        }

        progressionAnchorChanged(before,after) {
            return before?.世界?.名称!==after?.世界?.名称||before?.世界?.时间!==after?.世界?.时间||!!before?.系统状态?.是否在主神空间!==!!after?.系统状态?.是否在主神空间;
        }
    }
    const DEFAULT_WORLD_VALIDATION_POLICY=new WorldValidationPolicy(DEFAULT_WORLD_TIMELINE_POLICY,DEFAULT_WORLD_DUE_EVENT_POLICY,DEFAULT_WORLD_ACTIVITY_POLICY,DEFAULT_WORLD_SOFT_MAINTENANCE_POLICY);
    let ACTIVE_WORLD_VALIDATION_POLICY=DEFAULT_WORLD_VALIDATION_POLICY;
    function ensureDueHandled(next,dueList,worldTime){return ACTIVE_WORLD_VALIDATION_POLICY.ensureDueHandled(next,dueList,worldTime);}
    function unscheduledEvents(stat){return ACTIVE_WORLD_VALIDATION_POLICY.unscheduledEvents(stat);}
    function ensureEventTimeAnchors(next,required=[]){return ACTIVE_WORLD_VALIDATION_POLICY.ensureEventTimeAnchors(next,required);}
    function ensureStaleActiveHandled(next,required=[],worldTime=''){return ACTIVE_WORLD_VALIDATION_POLICY.ensureStaleActiveHandled(next,required,worldTime);}
    function ensureTemporalAnomaliesResolved(next,required=[]){return ACTIVE_WORLD_VALIDATION_POLICY.ensureTemporalAnomaliesResolved(next,required);}
    function ensureMacroBackbone(next,timeline,required=true){return ACTIVE_WORLD_VALIDATION_POLICY.ensureMacroBackbone(next,timeline,required);}
    function progressionAnchorChanged(before,after){return ACTIVE_WORLD_VALIDATION_POLICY.progressionAnchorChanged(before,after);}
