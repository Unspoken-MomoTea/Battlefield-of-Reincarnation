    class WorldValidationPolicy {
        constructor(timeline){this.timeline=timeline||DEFAULT_WORLD_TIMELINE_POLICY;}
        ensureDueHandled(next,dueList,worldTime) {
            for(const due of dueList||[]){
                const event=next.世界[PATH].事件[due.名称];
                if(!event)continue;
                if(event.状态==='待发生'&&(event.更新时间!==worldTime||!event.下次检查||!event.条件)){
                    throw new Error('到期事件未处理：'+due.名称+'。需启动事件，或记录本轮复核日期、阻碍条件与下次检查。');
                }
            }
        }

        unscheduledEvents(stat) {
            return Object.entries(stat?.世界?.[PATH]?.事件||{}).filter(([,event])=>{
                if(!['待发生','进行中'].includes(event?.状态))return false;
                const anchor=this.timeline.eventTimeAnchor(event);
                return !anchor||VAGUE_EVENT_TIME.test(anchor);
            }).map(([名称,event])=>({名称,分类:event.分类,状态:event.状态,条件:event.条件,前因:copy(event.前因||[]),当前时间:this.timeline.eventTimeAnchor(event)}));
        }

        ensureEventTimeAnchors(next,required=[]) {
            const missing=[];
            for(const item of required||[]){
                const event=next?.世界?.[PATH]?.事件?.[item.名称];
                if(!event||!['待发生','进行中'].includes(event.状态))continue;
                const anchor=this.timeline.eventTimeAnchor(event);
                if(!anchor||VAGUE_EVENT_TIME.test(anchor))missing.push(item.名称);
            }
            if(missing.length)throw new Error('事件时间锚点仍未补全：'+missing.join('、')+'；请逐项补写具体世界日期/时段，或明确相对/因果时间，禁止空值和“近期/稍后/未来/待定/未知”');
        }

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
            if(!required||!timeline?.需要补充远期)return;
            const allMacro=Object.entries(next?.世界?.[PATH]?.事件||{}).filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消');
            const activeMacro=allMacro.filter(([,e])=>e.状态==='进行中');
            const futureMacro=allMacro.filter(([,e])=>e.状态==='待发生');
            const openMacro=allMacro.filter(([,e])=>['进行中','待发生'].includes(e.状态));
            if(openMacro.length<3)throw new Error('宏观事件不足：需要至少3个可推进宏观节点（进行中+待发生），当前仅'+openMacro.length+'个（进行中'+activeMacro.length+'个，待发生'+futureMacro.length+'个）');
            const stages=this.timeline.storyStages(next?.世界?.因果轨道?.故事线);
            const names=new Set(allMacro.map(([name])=>name));
            if(stages.length<3||stages.length>5||stages.some(name=>!names.has(name)))throw new Error('因果轨道未形成有效宏观投影：请用已建立的宏观节点生成3~5节点故事线');
        }

        progressionAnchorChanged(before,after) {
            return before?.世界?.名称!==after?.世界?.名称||before?.世界?.时间!==after?.世界?.时间||!!before?.系统状态?.是否在主神空间!==!!after?.系统状态?.是否在主神空间;
        }
    }
    const DEFAULT_WORLD_VALIDATION_POLICY=new WorldValidationPolicy();
    let ACTIVE_WORLD_VALIDATION_POLICY=DEFAULT_WORLD_VALIDATION_POLICY;
    function ensureDueHandled(next,dueList,worldTime){return ACTIVE_WORLD_VALIDATION_POLICY.ensureDueHandled(next,dueList,worldTime);}
    function unscheduledEvents(stat){return ACTIVE_WORLD_VALIDATION_POLICY.unscheduledEvents(stat);}
    function ensureEventTimeAnchors(next,required=[]){return ACTIVE_WORLD_VALIDATION_POLICY.ensureEventTimeAnchors(next,required);}
    function ensureStaleActiveHandled(next,required=[],worldTime=''){return ACTIVE_WORLD_VALIDATION_POLICY.ensureStaleActiveHandled(next,required,worldTime);}
    function ensureTemporalAnomaliesResolved(next,required=[]){return ACTIVE_WORLD_VALIDATION_POLICY.ensureTemporalAnomaliesResolved(next,required);}
    function ensureMacroBackbone(next,timeline,required=true){return ACTIVE_WORLD_VALIDATION_POLICY.ensureMacroBackbone(next,timeline,required);}
    function progressionAnchorChanged(before,after){return ACTIVE_WORLD_VALIDATION_POLICY.progressionAnchorChanged(before,after);}
