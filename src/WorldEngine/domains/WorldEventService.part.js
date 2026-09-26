    class WorldEventService {
        constructor(engine){this.engine=engine;}
        get(name){
            if(typeof this.engine.worldEventRecord==='function')return this.engine.worldEventRecord(name);
            const events=this.engine.snapshot().stat?.世界?.[PATH]?.事件||{};
            return plain(events?.[name])?events[name]:null;
        }
        async save(oldName,newName,record){
            if(typeof this.engine.setWorldEventRecord!=='function')throw new Error('事件编辑服务尚未初始化');
            return this.engine.setWorldEventRecord(oldName,newName,record);
        }
        async remove(name){
            if(typeof this.engine.removeWorldEventRecord!=='function')throw new Error('事件编辑服务尚未初始化');
            return this.engine.removeWorldEventRecord(name);
        }
    }
