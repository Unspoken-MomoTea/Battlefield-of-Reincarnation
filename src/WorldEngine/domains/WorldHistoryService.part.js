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
        backend(){return this.engine.snapshot().stat?.世界?.[PATH]||{};}
        async commitEdit(kind,name,build,status){
            name=String(name||'').trim();
            if(!name)throw new Error('历史记录名称不能为空');
            const engine=this.engine,snapshot=engine.snapshot(),next=copy(snapshot.raw),stat=next.stat_data,backend=stat?.世界?.[PATH];
            if(!plain(backend))throw new Error('世界后台不存在');
            const bucketName=kind==='summary'?'历史总结':'历史',bucket=backend[bucketName];
            if(!plain(bucket)||!plain(bucket[name]))throw new Error((kind==='summary'?'长期历史总结':'近期历史锚点')+'不存在：'+name);
            const updated=build(copy(bucket[name]));
            if(!plain(updated))throw new Error('历史编辑结果无效');
            bucket[name]=updated;
            historyMemoryEditorSyncReplay(next,snapshot.fingerprint,['世界',PATH,bucketName,name],updated);
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
            engine.lastHistoryMaintenance=status||'历史记忆已手动修正';
            engine.status=status||'历史记忆已手动修正';
            engine.render(true);
            return true;
        }
        async saveAnchor(name,record){
            const time=String(record?.时间||'').trim(),fact=String(record?.事实||'').trim();
            if(!fact)throw new Error('历史事实不能为空');
            const related=historyMemoryEditorRelated(record?.关联事件);
            return this.commitEdit('anchor',name,current=>({...current,时间:time,事实:fact,关联事件:related}),'已修正近期历史锚点');
        }
        async saveSummary(name,record){
            const summary=String(record?.摘要||'').trim();
            if(!summary)throw new Error('长期历史摘要不能为空');
            const start=String(record?.起始时间||'').trim(),end=String(record?.结束时间||'').trim();
            return this.commitEdit('summary',name,current=>({...current,摘要:summary,起始时间:start,结束时间:end}),'已修正长期历史总结');
        }
    }
