    class WorldMutationService {
        constructor(engine){this.engine=engine;}
        async commit(mutator,status){
            if(typeof this.engine.persistWorldEditorMutation==='function')return this.engine.persistWorldEditorMutation(mutator,status);
            throw new Error('世界推进写回服务尚未初始化');
        }
        snapshot(){return this.engine.snapshot();}
    }
