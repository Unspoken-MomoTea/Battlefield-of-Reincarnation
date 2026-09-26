    class WorldHistoryService {
        constructor(engine){this.engine=engine;}
        project(stat){
            const backend=stat?.世界?.[PATH]||stat||{};
            return typeof projectWorldHistoryMemory==='function'?projectWorldHistoryMemory(backend):{};
        }
        setSendToProse(value){
            if(typeof this.engine.setSendHistoryToProse==='function')return this.engine.setSendHistoryToProse(value);
            this.engine.config.sendHistoryToProse=value===true;
            this.engine.saveConfig?.();
            return this.engine.config.sendHistoryToProse;
        }
        async summarize(world,batch,level){
            const engine=this.engine,registry=engine.services?.prompts||engine.promptRegistry;
            const savedTransport=engine.lastTransportInfo;
            try{
                const raw=await engine.requestAI(
                    registry?.historySystem?.()??HISTORY_MEMORY_SYSTEM,
                    historyMemoryPrompt(world,batch,level),
                    {schema:HISTORY_MEMORY_SCHEMA,schemaName:'samsara_world_history_summary_v1',structured:'auto',temperature:0.2}
                );
                return historyMemoryParseReply(raw);
            }finally{
                engine.lastTransportInfo=savedTransport;
            }
        }
    }
