    class WorldPersonActivityService {
        constructor(engine){this.engine=engine;}
        get(name){
            const people=this.engine.snapshot().stat?.世界?.[PATH]?.人物||{};
            const stable=stableNameIn(people,String(name||'').trim());
            return stable&&plain(people[stable])?{name:stable,record:people[stable]}:null;
        }
        async save(name,record){
            name=String(name||'').trim();if(!name)throw new Error('人物名称不能为空');
            return this.engine.services.mutations.commit(stat=>{
                const backend=worldEditorBackend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))throw new Error('世界活动记录不存在：'+name);
                const current=people[stable];
                const next=normalizeBackendRecord('人物',record,current);
                next.认知=worldEditorTextList(next.认知);
                next.关联事件=worldEditorTextList(next.关联事件);
                next.行程=worldEditorJsonList(next.行程,'行程');
                next.认知来源=worldEditorJsonList(next.认知来源,'认知来源');
                next.背景关联=worldEditorJsonList(next.背景关联,'背景关联');
                worldPersonValidateRecord(stat,stable,next);
                people[stable]=next;
                return {name:stable};
            },'已修正世界活动记录：'+name);
        }
        async remove(name){
            name=String(name||'').trim();if(!name)return false;
            return this.engine.services.mutations.commit(stat=>{
                const backend=worldEditorBackend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))return null;
                delete people[stable];
                return {deleted:stable};
            },'已删除世界活动记录：'+name);
        }
    }
