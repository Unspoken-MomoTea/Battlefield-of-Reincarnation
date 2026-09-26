    const VAGUE_EVENT_TIME=/^(?:近期|稍后|未来|之后|待定|未定|未知|不详|待确认|时间未定|日期未定)$/;
    const STALE_CURRENT_EVENT_HOURS=7*24;
    const STALE_NEAR_EVENT_HOURS=30*24;
    class WorldTimelinePolicy {
        storyStages(value) {
            return String(value||'').split(/\s*(?:→|⇒|->|=>|\n)\s*/).map(x=>x.trim()).filter(x=>x&&!/^(待初始化|无|未知)$/.test(x));
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
            const all=this.temporalAnomalies(next);
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
    function eventTimeAnchor(event){return ACTIVE_WORLD_TIMELINE_POLICY.eventTimeAnchor(event);}
    function eventScheduleLabel(event){return ACTIVE_WORLD_TIMELINE_POLICY.eventScheduleLabel(event);}
    function staleActiveEvents(stat){return ACTIVE_WORLD_TIMELINE_POLICY.staleActiveEvents(stat);}
    function temporalAnomalies(stat){return ACTIVE_WORLD_TIMELINE_POLICY.temporalAnomalies(stat);}
    function validateTemporalWrites(before,next,patches){return ACTIVE_WORLD_TIMELINE_POLICY.validateTemporalWrites(before,next,patches);}
    function eventDisplayBucket(event){return ACTIVE_WORLD_TIMELINE_POLICY.eventDisplayBucket(event);}
    function sortWorldEvents(records,orbit={}){return ACTIVE_WORLD_TIMELINE_POLICY.sortWorldEvents(records,orbit);}
