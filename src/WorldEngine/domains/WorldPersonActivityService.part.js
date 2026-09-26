    class WorldPersonActivityService {
        constructor(engine){this.engine=engine;}
        get(name){
            if(typeof this.engine.worldPersonRecord==='function')return this.engine.worldPersonRecord(name);
            const people=this.engine.snapshot().stat?.世界?.[PATH]?.人物||{};
            const stable=stableNameIn(people,String(name||'').trim());
            return stable&&plain(people[stable])?{name:stable,record:people[stable]}:null;
        }
        async save(name,record){
            if(typeof this.engine.setWorldPersonRecord!=='function')throw new Error('世界人物编辑服务尚未初始化');
            return this.engine.setWorldPersonRecord(name,record);
        }
        async remove(name){
            if(typeof this.engine.removeWorldPersonRecord!=='function')throw new Error('世界人物编辑服务尚未初始化');
            return this.engine.removeWorldPersonRecord(name);
        }
    }
