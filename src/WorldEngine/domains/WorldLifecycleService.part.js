    class WorldLifecycleService {
        personActivityMeta(stat,name,person) {
            const relations=stat?.关系列表||{},roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
            const events=stat?.世界?.[PATH]?.事件||{},worldTime=String(stat?.世界?.时间||''),currentLocation=String(stat?.世界?.地点||'');
            const formalName=stableNameIn(relations,name),alienName=stableNameIn(roster,name),alien=alienName?roster[alienName]:null;
            const activeAlien=!!(alien&&alien.状态!=='死亡'),deadAlien=!!(alien&&alien.状态==='死亡');
            const liveEntries=Object.entries(events).filter(([,event])=>event&&['待发生','进行中'].includes(event.状态));
            const liveNames=new Set(liveEntries.map(([eventName])=>eventName));
            const linked=Array.isArray(person?.关联事件)&&person.关联事件.some(eventName=>liveNames.has(eventName));
            const participant=liveEntries.some(([,event])=>(event.参与者||[]).some(item=>nameKey(item)===nameKey(name)));
            const here=!!(person?.地点&&currentLocation&&worldLocationRelated(person.地点,currentLocation));
            const now=worldDateKey(worldTime),updated=worldDateKey(person?.更新时间);
            const ageHours=now!==null&&updated!==null?now-updated:null;
            const recent=sameWorldTimeAnchor(person?.更新时间,worldTime)||(ageHours!==null&&ageHours>=0&&ageHours<=HOT_PERSON_RECENT_HOURS);
            const checkAt=worldDateKey(person?.下次检查);
            const dueSoon=now!==null&&checkAt!==null&&checkAt>=now-HOT_PERSON_RECENT_HOURS&&checkAt<=now+7*24;
            const terminal=TERMINAL_PERSON_STATUS.test(String(person?.状态||'').trim());
            return {formalName,activeAlien,deadAlien,linked,participant,here,recent,dueSoon,terminal,ageHours};
        }
        pruneColdTemporaryPeople(stat) {
            const people=stat?.世界?.[PATH]?.人物;if(!plain(people))return [];
            const removed=[];
            for(const [name,person] of Object.entries(people)){
                if(!plain(person))continue;
                const meta=this.personActivityMeta(stat,name,person);
                const protectedNow=!!(meta.formalName||meta.activeAlien||meta.linked||meta.participant||meta.here||meta.dueSoon);
                if(protectedNow)continue;
                const stale=meta.ageHours!==null&&meta.ageHours>COLD_TEMP_PERSON_GRACE_HOURS;
                if(meta.terminal||stale){delete people[name];removed.push(name);}
            }
            const cold=Object.entries(people).filter(([name,person])=>{
                if(!plain(person))return false;
                const meta=this.personActivityMeta(stat,name,person);
                const protectedNow=!!(meta.formalName||meta.activeAlien||meta.linked||meta.participant||meta.here||meta.dueSoon);
                const recentlyActive=meta.ageHours!==null&&meta.ageHours>=0&&meta.ageHours<=COLD_TEMP_PERSON_GRACE_HOURS;
                return !protectedNow&&!recentlyActive;
            });
            while(cold.length>COLD_TEMP_PERSON_TARGET){
                const [name]=cold.shift();
                if(Object.hasOwn(people,name)){delete people[name];removed.push(name);}
            }
            return removed;
        }
        pruneDeadAlienPeople(stat) {
            const people=stat?.世界?.[PATH]?.人物,roster=stat?.世界?.异端雷达?.名单;
            if(!plain(people)||!plain(roster))return [];
            const removed=[];
            for(const [alienName,alien] of Object.entries(roster)){
                if(alien?.状态!=='死亡')continue;
                const personName=stableNameIn(people,alienName);
                if(personName){delete people[personName];removed.push(personName);}
            }
            return removed;
        }
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
            // 历史锚点是永久已确认事实，不再按固定数量删除；旧事实由分层历史总结退出热上下文。
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
        compact(stat) {
            const state=stat?.世界?.[PATH];
            if(!state)return {归档事件:[],回收传播:[],回收人物:[],回收探索:[]};
            const now=worldDateKey(stat?.世界?.时间),removedPropagation=[];
            for(const [name,record] of Object.entries(state.传播||{})){
                if(this.propagationEnded(record,now)){delete state.传播[name];removedPropagation.push(name);}
            }
            const archived=this.compactFinishedEvents(stat);
            const removedPeople=[...this.pruneDeadAlienPeople(stat),...this.pruneColdTemporaryPeople(stat)];
            return {
                归档事件:archived,
                回收传播:removedPropagation,
                回收人物:[...new Set(removedPeople)],
                // 探索是玩家长期台账：离开区域后不再由 lifecycle 回收。
                回收探索:[]
            };
        }
    }
    const DEFAULT_WORLD_LIFECYCLE_SERVICE=new WorldLifecycleService();
    let ACTIVE_WORLD_LIFECYCLE_SERVICE=DEFAULT_WORLD_LIFECYCLE_SERVICE;
    function personActivityMeta(stat,name,person){return ACTIVE_WORLD_LIFECYCLE_SERVICE.personActivityMeta(stat,name,person);}
    function pruneColdTemporaryPeople(stat){return ACTIVE_WORLD_LIFECYCLE_SERVICE.pruneColdTemporaryPeople(stat);}
    function pruneDeadAlienPeople(stat){return ACTIVE_WORLD_LIFECYCLE_SERVICE.pruneDeadAlienPeople(stat);}
    function collectEventRefs(state){return ACTIVE_WORLD_LIFECYCLE_SERVICE.collectEventRefs(state);}
    function detachEventSoftRefs(state,eventName){return ACTIVE_WORLD_LIFECYCLE_SERVICE.detachEventSoftRefs(state,eventName);}
    function archiveFinishedEvent(stat,state,name,event,archived){return ACTIVE_WORLD_LIFECYCLE_SERVICE.archiveFinishedEvent(stat,state,name,event,archived);}
    function propagationEnded(record,nowKey){return ACTIVE_WORLD_LIFECYCLE_SERVICE.propagationEnded(record,nowKey);}
    function pruneSoftRefsToColdFinishedEvents(state,now){return ACTIVE_WORLD_LIFECYCLE_SERVICE.pruneSoftRefsToColdFinishedEvents(state,now);}
    function compactFinishedEvents(stat,target=EVENT_TARGET){return ACTIVE_WORLD_LIFECYCLE_SERVICE.compactFinishedEvents(stat,target);}
    function compactWorldLifecycle(stat){return ACTIVE_WORLD_LIFECYCLE_SERVICE.compact(stat);}
