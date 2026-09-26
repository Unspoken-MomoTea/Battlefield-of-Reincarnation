    const VAGUE_EVENT_TIME=/^(?:近期|稍后|未来|之后|待定|未定|未知|不详|待确认|时间未定|日期未定)$/;
    const STALE_CURRENT_EVENT_HOURS=7*24;
    const STALE_NEAR_EVENT_HOURS=30*24;
    class WorldTimelinePolicy {
        storyStages(value) {
            return String(value||'').split(/\s*(?:→|⇒|->|=>|\n)\s*/).map(x=>x.trim()).filter(x=>x&&!/^(待初始化|无|未知)$/.test(x));
        }
        importStory(stat) {
            const orbit=stat.世界.因果轨道||{},events=stat.世界[PATH]?.事件||{};
            if(Object.values(events).some(e=>e.分类==='主线节点'))return [];
            const stages=this.storyStages(orbit.故事线);
            if(stages.length<2||stages.length>30)return [];
            const index=stages.findIndex(n=>n===orbit.下一节点);
            const remaining=index>=0?stages.slice(index):stages;
            let previous='';
            return remaining.filter(name=>!Object.hasOwn(events,name)).map(name=>{
                const value={...copy(RECORDS.事件),描述:name,分类:'主线节点',前因:previous?[previous]:[],条件:previous?'前置节点「'+previous+'」达到进入本阶段所需的条件':'待依据世界设定与正文明确触发条件',下次检查:'本轮首次排程'};
                previous=name;
                return {op:'add',path:'/世界/后台/事件/'+name.replace(/~/g,'~0').replace(/\//g,'~1'),value};
            });
        }
        timelineState(stat) {
            const state=stat.世界[PATH],events=Object.entries(state.事件||{}),now=worldDateKey(stat.世界.时间);
            const waiting=events.filter(([,e])=>['待发生','进行中'].includes(e.状态));
            const near=events.filter(([,e])=>['当前事件','近期节点'].includes(e.分类));
            const macro=events.filter(([,e])=>e.分类==='宏观节点');
            const macroFuture=macro.filter(([,e])=>e.状态==='待发生');
            const macroOpen=macro.filter(([,e])=>['进行中','待发生'].includes(e.状态));
            const expand=macroFuture.filter(([,e])=>{const t=worldDateKey(e.时间||e.开始时间);return now!==null&&t!==null&&t>=now&&t-now<=7*24;});
            const semantic=waiting.filter(([,e])=>String(e.时间||e.开始时间||'').trim()&&worldDateKey(e.时间||e.开始时间)===null);
            const orbit=stat.世界.因果轨道||{},orbitStages=this.storyStages(orbit.故事线);
            const macroNames=new Set(macro.map(([name])=>name));
            const orbitProjectionInvalid=orbitStages.length<3||orbitStages.length>5||orbitStages.some(name=>!macroNames.has(name));
            const orbitMacro=macroFuture.find(([name])=>name===orbit.下一节点);
            const datedMacro=macroFuture.map((item,index)=>({item,index,key:worldDateKey(item[1].时间||item[1].开始时间)}))
                .filter(x=>x.key!==null&&(now===null||x.key>=now))
                .sort((a,b)=>a.key-b.key||a.index-b.index);
            const nextPair=orbitMacro||datedMacro[0]?.item||macroFuture[0]||null;
            const nextMacro=nextPair?{
                名称:nextPair[0],
                时间:nextPair[1].时间||nextPair[1].开始时间||'',
                分类:nextPair[1].分类||'',
                条件:nextPair[1].条件||'',
                前因:nextPair[1].前因||[],
                来源:'宏观事件图'
            }:null;
            return {
                当前时间锚点:stat.世界.时间,
                因果轨道节点数:orbitStages.length,
                因果轨道需重建:orbitProjectionInvalid,
                需要初始化:near.length===0&&macro.length===0,
                当前活动事件数:waiting.filter(([,e])=>e.状态==='进行中').length,
                近期节点数:near.length,
                宏观节点数:macro.length,
                需要补充远期:macroOpen.length<3,
                下一宏观节点:nextMacro,
                桥接区间:{起点:stat.世界.时间,终点:nextMacro?.时间||'待建立宏观节点',边界事件:nextMacro?.名称||''},
                需要展开的宏观节点:expand.map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,前因:e.前因})),
                需语义复核节点:semantic.map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,下次检查:e.下次检查})),
                说明:'先用因果轨道、当前事实与模型已有世界/原著知识建立宏观骨架；世界书若存在只作补充校正。随后仅展开当前时间到下一宏观节点之间的近期事件、人物、势力与传播。非公历或作品内时间按作品语义比较，不强行改写为公历。'
            };
        }
        eventTimeAnchor(event) {
            return String(event?.时间||event?.开始时间||'').trim();
        }
        eventScheduleLabel(event) {
            const raw=this.eventTimeAnchor(event);
            if(raw&&!VAGUE_EVENT_TIME.test(raw))return raw;
            const condition=String(event?.条件||'').trim();
            if(condition)return '条件触发 · '+condition;
            const predecessors=Array.isArray(event?.前因)?event.前因.filter(Boolean):[];
            if(predecessors.length)return '前置节点后 · '+predecessors.join('、');
            return '时间待补';
        }
        staleActiveEvents(stat) {
            const now=worldDateKey(stat?.世界?.时间);if(now===null)return [];
            const out=[];
            for(const [名称,event] of Object.entries(stat?.世界?.[PATH]?.事件||{})){
                if(event?.状态!=='进行中'||event?.分类==='宏观节点')continue;
                const touched=worldDateKey(event.更新时间||event.时间||event.开始时间);
                if(touched===null)continue;
                const threshold=event.分类==='当前事件'?STALE_CURRENT_EVENT_HOURS:STALE_NEAR_EVENT_HOURS;
                const age=now-touched;
                if(age>threshold)out.push({名称,分类:event.分类,状态:event.状态,时间:event.时间||event.开始时间||'',更新时间:event.更新时间||'',已陈旧小时:age,说明:'局部活动长期停留在进行中；应结束/取消，或确认仍持续并更新到当前世界时间、当前进展与下次检查。'});
            }
            return out;
        }
        temporalAnomalies(stat) {
            const now=worldDateKey(stat?.世界?.时间);if(now===null)return [];
            const state=stat?.世界?.[PATH]||{},out=[];
            const push=(类型,名称,字段,值,原因)=>{
                const key=worldDateKey(值);if(key!==null&&key>now)out.push({类型,名称,字段,值:String(值||''),原因});
            };
            for(const [name,event] of Object.entries(state.事件||{})){
                if(['进行中','已完成'].includes(event?.状态))push('事件',name,'时间',event.时间||event.开始时间,'已发生/进行中的事件不能晚于当前世界时间');
                if(event?.更新时间)push('事件',name,'更新时间',event.更新时间,'事件更新时间不能晚于当前世界时间');
            }
            for(const [name,person] of Object.entries(state.人物||{}))if(person?.更新时间)push('人物',name,'更新时间',person.更新时间,'人物当前动态不能来自未来');
            for(const [name,area] of Object.entries(state.势力地区||{})){
                if(area?.更新时间)push('势力地区',name,'更新时间',area.更新时间,'地区当前状态不能来自未来');
                for(const change of area?.近期变化||[])if(change?.时间)push('势力地区',name,'近期变化.时间',change.时间,'已经发生的地区变化不能来自未来');
            }
            for(const [name,item] of Object.entries(state.历史||{}))if(item?.时间)push('历史',name,'时间',item.时间,'历史事实不能晚于当前世界时间');
            for(const [name,item] of Object.entries(state.传播||{}))if(item?.时间)push('传播',name,'时间',item.时间,'已经开始传播的信息不能晚于当前世界时间');
            return out;
        }
        validateTemporalWrites(before,next,patches) {
            const touched=new Set();
            for(const patch of patches||[]){
                let parts;try{parts=tokens(patch.path);}catch(_){continue;}
                if(parts[0]!=='世界'||parts[1]!==PATH)continue;
                if(['事件','人物','势力地区','历史','传播'].includes(parts[2])&&parts[3])touched.add(parts[2]+'\u0000'+parts[3]);
            }
            if(!touched.size)return;
            // Preserve later integrity/rumor decorators on the public compatibility seam.
            const all=temporalAnomalies(next);
            const hit=all.find(item=>touched.has(item.类型+'\u0000'+item.名称));
            if(hit)throw new Error('时间事实超过当前世界时间：'+hit.类型+'/'+hit.名称+' '+hit.字段+'='+hit.值+'；'+hit.原因);
        }
        eventDisplayBucket(event) {
            if(event?.状态==='进行中')return 0;
            if(event?.状态==='待发生'&&event?.分类==='当前事件')return 1;
            if(event?.状态==='待发生'&&event?.分类==='近期节点')return 2;
            if(event?.状态==='待发生'&&event?.分类==='宏观节点')return 3;
            if(event?.状态==='已完成')return 4;
            if(event?.状态==='已取消')return 5;
            return 6;
        }
        sortWorldEvents(records,orbit={}) {
            const storyIndex=new Map(this.storyStages(orbit?.故事线).map((name,index)=>[nameKey(name),index]));
            return Object.entries(records||{}).sort((a,b)=>{
                const bucket=this.eventDisplayBucket(a[1])-this.eventDisplayBucket(b[1]);if(bucket)return bucket;
                if(a[1]?.分类==='宏观节点'&&b[1]?.分类==='宏观节点'){
                    const ai=storyIndex.get(nameKey(a[0])),bi=storyIndex.get(nameKey(b[0]));
                    if(ai!==undefined||bi!==undefined){
                        if(ai===undefined)return 1;
                        if(bi===undefined)return -1;
                        if(ai!==bi)return ai-bi;
                    }
                }
                const da=worldDateKey(a[1]?.时间||a[1]?.开始时间),db=worldDateKey(b[1]?.时间||b[1]?.开始时间);
                if(da!==db)return (da??Infinity)-(db??Infinity);
                return String(a[0]).localeCompare(String(b[0]),'zh-CN');
            });
        }
    }
    const DEFAULT_WORLD_TIMELINE_POLICY=new WorldTimelinePolicy();
    let ACTIVE_WORLD_TIMELINE_POLICY=DEFAULT_WORLD_TIMELINE_POLICY;
    function storyStages(value){return ACTIVE_WORLD_TIMELINE_POLICY.storyStages(value);}
    function importStory(stat){return ACTIVE_WORLD_TIMELINE_POLICY.importStory(stat);}
    function timelineState(stat){return ACTIVE_WORLD_TIMELINE_POLICY.timelineState(stat);}
    function eventTimeAnchor(event){return ACTIVE_WORLD_TIMELINE_POLICY.eventTimeAnchor(event);}
    function eventScheduleLabel(event){return ACTIVE_WORLD_TIMELINE_POLICY.eventScheduleLabel(event);}
    function staleActiveEvents(stat){return ACTIVE_WORLD_TIMELINE_POLICY.staleActiveEvents(stat);}
    function temporalAnomalies(stat){return ACTIVE_WORLD_TIMELINE_POLICY.temporalAnomalies(stat);}
    function validateTemporalWrites(before,next,patches){return ACTIVE_WORLD_TIMELINE_POLICY.validateTemporalWrites(before,next,patches);}
    function eventDisplayBucket(event){return ACTIVE_WORLD_TIMELINE_POLICY.eventDisplayBucket(event);}
    function sortWorldEvents(records,orbit={}){return ACTIVE_WORLD_TIMELINE_POLICY.sortWorldEvents(records,orbit);}
