    class WorldEventService {
        constructor(engine){this.engine=engine;}
        get(name){
            const events=this.engine.snapshot().stat?.世界?.[PATH]?.事件||{};
            return plain(events?.[name])?events[name]:null;
        }
        async save(oldName,newName,record){
            oldName=String(oldName||'').trim();newName=String(newName||'').trim();
            if(!oldName||!newName)throw new Error('事件名称不能为空');
            if(forbidden.has(newName))throw new Error('事件名称包含非法键');
            return this.engine.services.mutations.commit(stat=>{
                const backend=worldEditorBackend(stat),events=backend.事件||{};
                const current=events[oldName];
                if(!plain(current))throw new Error('事件不存在：'+oldName);
                if(newName!==oldName&&Object.hasOwn(events,newName))throw new Error('事件名称已存在：'+newName);
                const next=normalizeBackendRecord('事件',record,current);
                next.前因=worldEditorTextList(next.前因);
                next.参与者=worldEditorTextList(next.参与者);
                next.关联任务=worldEditorTextList(next.关联任务);
                next.可见影响=worldEditorJsonList(next.可见影响,'可见影响');
                if(next.前因.includes(oldName)||next.前因.includes(newName))throw new Error('事件不能把自己设为前因');
                if(newName!==oldName)delete events[oldName];
                events[newName]=next;
                if(newName!==oldName)worldEventRetargetReferences(stat,oldName,newName,false);
                worldEventValidateGraph(stat);
                return {oldName,newName};
            },newName===oldName?'已修正世界事件：'+newName:'已重命名并修正世界事件：'+oldName+' → '+newName);
        }
        async remove(name){
            name=String(name||'').trim();if(!name)return false;
            return this.engine.services.mutations.commit(stat=>{
                const backend=worldEditorBackend(stat),events=backend.事件||{};
                if(!plain(events[name]))return null;
                delete events[name];
                worldEventRetargetReferences(stat,name,'',true);
                worldEventValidateGraph(stat);
                return {deleted:name};
            },'已删除错误世界事件：'+name);
        }
    }
