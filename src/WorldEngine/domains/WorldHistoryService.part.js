    class WorldHistoryService {
        constructor(engine){this.engine=engine;}
        project(stat){
            const backend=stat?.世界?.[PATH]||stat||{};
            return typeof projectWorldHistoryMemory==='function'?projectWorldHistoryMemory(backend):{};
        }
        setSendToProse(value){
            if(typeof this.engine.setSendHistoryToProse==='function')return this.engine.setSendHistoryToProse(value);
            this.engine.config.sendHistoryToProse=value===true;this.engine.saveConfig?.();return this.engine.config.sendHistoryToProse;
        }
        async summarize(world,batch,level){
            if(typeof this.engine.requestHistoryMemorySummary!=='function')throw new Error('历史记忆服务尚未初始化');
            return this.engine.requestHistoryMemorySummary(world,batch,level);
        }
    }
