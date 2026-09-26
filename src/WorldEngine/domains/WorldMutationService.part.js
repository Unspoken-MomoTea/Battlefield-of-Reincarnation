    class WorldMutationService {
        constructor(engine){this.engine=engine;}
        snapshot(){return this.engine.snapshot();}
        async commit(mutator,status){
            if(typeof mutator!=='function')return false;
            const engine=this.engine,snapshot=engine.snapshot(),next=copy(snapshot.raw),stat=next.stat_data;
            worldEditorBackend(stat);
            const outcome=mutator(stat);
            if(!outcome)return false;
            worldEditorMergeReplay(next,snapshot.fingerprint,snapshot.stat,stat,engine);
            const target=engine.host,had=!!target&&Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target?.__samsaraUIMutation;
            if(target)target.__samsaraUIMutation=true;
            try{
                await snapshot.mvu.replaceMvuData(next,{type:'message',message_id:snapshot.id});
            }finally{
                if(target){
                    if(had)target.__samsaraUIMutation=previous;
                    else delete target.__samsaraUIMutation;
                }
            }
            engine.status=status||'世界推进资料已手动修正';
            engine.render(true);
            return true;
        }
    }
