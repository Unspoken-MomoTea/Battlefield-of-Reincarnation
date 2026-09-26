    class WorldCausalService {
        constructor(engine){this.engine=engine;}
        get(name){return this.engine.snapshot().stat?.世界?.因果轨道?.偏移记录?.[String(name||'').trim()]||null;}
        async commit(mutator,status){
            const engine=this.engine,snapshot=engine.snapshot(),next=copy(snapshot.raw),stat=next.stat_data;
            if(!plain(stat?.世界?.因果轨道))stat.世界.因果轨道={};
            if(!plain(stat.世界.因果轨道.偏移记录))stat.世界.因果轨道.偏移记录={};
            const outcome=mutator(stat.世界.因果轨道.偏移记录);
            if(!outcome)return false;
            const stable=causalOffsetRecalculateStability(stat);
            causalOffsetSyncReplay(next,snapshot.fingerprint,outcome.oldName,outcome.newName,outcome.record,outcome.deleted,stable);
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
            engine.status=status||'因果偏移已更新';
            engine.render(true);
            return true;
        }
        async save(oldName,newName,record){
            oldName=String(oldName||'').trim();newName=String(newName||'').trim();
            if(!oldName||!newName||!plain(record))throw new Error('偏移名称和记录不能为空');
            const impact=Number(record.影响程度);
            if(!Number.isFinite(impact)||impact===0||impact<-12||impact>15)throw new Error('影响程度必须为 -12~-1 或 +1~+15');
            return this.commit(bucket=>{
                if(!Object.hasOwn(bucket,oldName))throw new Error('偏移记录不存在：'+oldName);
                if(newName!==oldName&&Object.hasOwn(bucket,newName))throw new Error('偏移名称已存在：'+newName);
                const next={描述:String(record.描述||'').trim(),引发者:String(record.引发者||'').trim(),影响程度:impact};
                if(newName!==oldName)delete bucket[oldName];
                bucket[newName]=next;
                return {oldName,newName,record:next,deleted:false};
            },'已编辑因果偏移 · 稳定值已重算');
        }
        async remove(name){
            name=String(name||'').trim();if(!name)return false;
            return this.commit(bucket=>{
                if(!Object.hasOwn(bucket,name))return null;
                delete bucket[name];
                return {oldName:name,newName:name,record:null,deleted:true};
            },'已删除因果偏移 · 稳定值已重算');
        }
    }
