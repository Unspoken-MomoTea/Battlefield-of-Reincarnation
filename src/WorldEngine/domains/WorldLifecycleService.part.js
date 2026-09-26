    class WorldLifecycleService {
        collectEventRefs(state) {
            const refs=new Set();
            for(const event of Object.values(state.事件||{}))for(const id of event.前因||[])refs.add(id);
            for(const category of ['人物','势力地区','传播'])for(const record of Object.values(state[category]||{}))for(const id of record.关联事件||[])refs.add(id);
            return refs;
        }
        detachEventSoftRefs(state,eventName) {
            const changed=[];
            for(const category of ['人物','势力地区','传播']){
                for(const [name,record] of Object.entries(state?.[category]||{})){
                    if(!Array.isArray(record?.关联事件)||!record.关联事件.includes(eventName))continue;
                    record.关联事件=record.关联事件.filter(id=>id!==eventName);
                    changed.push(category+'/'+name);
                }
            }
            return changed;
        }
        archiveFinishedEvent(stat,state,name,event,archived) {
            let key='归档·'+name,seq=2;
            while(Object.hasOwn(state.历史||{},key))key='归档·'+name+'#'+seq++;
            state.历史=state.历史||{};
            state.历史[key]={
                时间:event.更新时间||event.预计结束||event.时间||stat.世界.时间||'',
                事实:event.结果||event.描述||(event.状态==='已取消'?'事件已取消':'事件已结束'),
                关联事件:[]
            };
            delete state.事件[name];
            archived.push(name);
        }
        propagationEnded(record,nowKey) {
            if(!plain(record))return true;
            const status=String(record.状态||'').trim();
            if(/^(?:已结束|结束|已停止|停止|已失效|失效|已过期|过期|传播结束)$/.test(status))return true;
            const expiry=worldDateKey(record.到期时间);
            return expiry!==null&&nowKey!==null&&expiry<=nowKey;
        }
        pruneSoftRefsToColdFinishedEvents(state,now) {
            if(now===null)return [];
            const cold=new Set();
            for(const [name,event] of Object.entries(state?.事件||{})){
                if(!['已完成','已取消'].includes(event?.状态))continue;
                const endedAt=worldDateKey(event.更新时间||event.预计结束||event.时间);
                if(endedAt!==null&&now-endedAt>=FINISHED_EVENT_GRACE_HOURS)cold.add(name);
            }
            if(!cold.size)return [];
            const changed=[];
            for(const eventName of cold)changed.push(...this.detachEventSoftRefs(state,eventName));
            // 冷结束事件之间不再互相作为热前因；活跃/未来事件对旧事实的前因引用继续保护归档。
            for(const [name,event] of Object.entries(state?.事件||{})){
                if(!cold.has(name)||!Array.isArray(event?.前因)||!event.前因.some(id=>cold.has(id)))continue;
                event.前因=event.前因.filter(id=>!cold.has(id));
                changed.push('事件/'+name);
            }
            return changed;
        }
        compactFinishedEvents(stat,target=EVENT_TARGET) {
            const state=stat?.世界?.[PATH]; if(!state?.事件)return [];
            const archived=[],now=worldDateKey(stat?.世界?.时间);
            this.pruneSoftRefsToColdFinishedEvents(state,now);
            const protectedNames=new Set(storyStages(stat?.世界?.因果轨道?.故事线));
            let refs=this.collectEventRefs(state);
            const finished=()=>Object.entries(state.事件||{}).filter(([name,event])=>['已完成','已取消'].includes(event.状态)&&!refs.has(name)&&!protectedNames.has(name));
            // 有明确时间的旧结束事件，在经过一个世界日后直接冷归档；刚结束内容至少保留到下一阶段。
            for(const [name,event] of finished()){
                const endedAt=worldDateKey(event.更新时间||event.预计结束||event.时间);
                if(now!==null&&endedAt!==null&&now-endedAt>=FINISHED_EVENT_GRACE_HOURS)this.archiveFinishedEvent(stat,state,name,event,archived);
            }
            refs=this.collectEventRefs(state);
            let candidates=finished();
            while(candidates.length>RECENT_FINISHED_EVENT_TARGET){
                const [name,event]=candidates[0];
                this.archiveFinishedEvent(stat,state,name,event,archived);
                refs=this.collectEventRefs(state);candidates=finished();
            }
            while(Object.keys(state.事件||{}).length>target){
                refs=this.collectEventRefs(state);
                const candidate=Object.entries(state.事件||{}).find(([name,event])=>['已完成','已取消'].includes(event.状态)&&!refs.has(name));
                if(!candidate)break;
                this.archiveFinishedEvent(stat,state,candidate[0],candidate[1],archived);
            }
            return archived;
        }
    }
    const DEFAULT_WORLD_LIFECYCLE_SERVICE=new WorldLifecycleService();
    let ACTIVE_WORLD_LIFECYCLE_SERVICE=DEFAULT_WORLD_LIFECYCLE_SERVICE;
    function collectEventRefs(state){return ACTIVE_WORLD_LIFECYCLE_SERVICE.collectEventRefs(state);}
    function detachEventSoftRefs(state,eventName){return ACTIVE_WORLD_LIFECYCLE_SERVICE.detachEventSoftRefs(state,eventName);}
    function archiveFinishedEvent(stat,state,name,event,archived){return ACTIVE_WORLD_LIFECYCLE_SERVICE.archiveFinishedEvent(stat,state,name,event,archived);}
    function propagationEnded(record,nowKey){return ACTIVE_WORLD_LIFECYCLE_SERVICE.propagationEnded(record,nowKey);}
    function pruneSoftRefsToColdFinishedEvents(state,now){return ACTIVE_WORLD_LIFECYCLE_SERVICE.pruneSoftRefsToColdFinishedEvents(state,now);}
    function compactFinishedEvents(stat,target=EVENT_TARGET){return ACTIVE_WORLD_LIFECYCLE_SERVICE.compactFinishedEvents(stat,target);}
