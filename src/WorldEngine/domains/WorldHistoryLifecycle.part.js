    class WorldHistoryLifecycle {
        constructor(engine){this.engine=engine;this.boundPanel=null;}
        initialize(){
            const e=this.engine;let dirty=false;
            if(!Object.hasOwn(e.config,'sendHistoryToProse')){e.config.sendHistoryToProse=false;dirty=true;}
            else e.config.sendHistoryToProse=e.config.sendHistoryToProse===true;
            e.historyMaintenanceBusy=false;e.lastHistoryMaintenance='';
            if(dirty)e.saveConfig();
        }
        setSendToProse(value){
            const e=this.engine;e.config.sendHistoryToProse=value===true;e.saveConfig();e.render();return e.config.sendHistoryToProse;
        }
        proseMemory(stat){return projectWorldHistoryMemory(stat?.世界?.[PATH]||{});}
        async requestSummary(world,batch,outputLevel){
            const e=this.engine,saved=e.lastTransportInfo;
            try{
                const system=e.promptRegistry?.historySystem?.()||HISTORY_MEMORY_SYSTEM;
                const input=e.promptRegistry?.historyInput?.(historyMemoryPrompt(world,batch,outputLevel))||historyMemoryPrompt(world,batch,outputLevel);
                const raw=await e.requestAI(system,input,{schema:HISTORY_MEMORY_SCHEMA,schemaName:'samsara_world_history_summary_v1',structured:'auto',temperature:0.2});
                return historyMemoryParseReply(raw);
            }finally{e.lastTransportInfo=saved;}
        }
        beforeWorldCommit(next,context={}){
            const e=this.engine,summary=String(context.worldResult?.摘要||context.reply?.summary||e.lastWorldResult?.摘要||'').trim();
            const messageId=Number(context.messageId),backend=next?.世界?.[PATH];
            if(!summary||!Number.isInteger(messageId)||!plain(backend))return false;
            if(!plain(backend.历史))backend.历史={};if(!plain(backend.历史总结))backend.历史总结={};
            const key=historyMemoryLeafKey(messageId),record={时间:String(next.世界?.时间||backend.已处理时间||context.baseStat?.世界?.时间||''),事实:summary,关联事件:[]};
            const previous=backend.历史[key];
            if(plain(previous)&&String(previous.时间||'')===record.时间&&String(previous.事实||'')===record.事实)return false;
            backend.历史[key]=record;
            const invalidated=historyMemoryInvalidateAncestors(backend,'历史:'+key);
            e.lastHistoryMaintenance='近期历史已更新'+(invalidated.length?' · 旧总结失效 '+invalidated.length+' 个':'');
            return true;
        }
        async maintain(){
            const e=this.engine;if(e.historyMaintenanceBusy)return 0;
            e.historyMaintenanceBusy=true;
            const previousStatus=e.status;let made=0,failed='';
            try{
                const snapshot=e.snapshot(),stat=copy(snapshot.stat),backend=stat?.世界?.[PATH];
                if(!plain(backend))return 0;
                if(!plain(backend.历史总结))backend.历史总结={};
                const startDigest=historyMemoryDigest(backend);
                for(let level=0;level<32;level++){
                    const batch=historyMemoryBatchForLevel(backend,level);if(!batch.length)continue;
                    const outputLevel=level+1;e.status='整理长期历史记忆 · L'+outputLevel;e.render();
                    let summary='';
                    try{summary=await this.requestSummary(stat.世界,batch,outputLevel);}
                    catch(error){failed=String(error?.message||error);break;}
                    const key=historyMemoryNextKey(backend,outputLevel);
                    backend.历史总结[key]={
                        层级:outputLevel,摘要:summary,子项:batch.map(node=>node.id),
                        起始时间:String(batch.find(node=>node.timeStart)?.timeStart||''),
                        结束时间:String([...batch].reverse().find(node=>node.timeEnd)?.timeEnd||''),
                        起始序位:Math.min(...batch.map(node=>Number(node.lo)||0).filter(n=>n>0)),
                        结束序位:Math.max(...batch.map(node=>Number(node.hi)||0).filter(n=>n>0)),
                        创建时间:String(stat.世界?.时间||'')
                    };made++;
                }
                if(!made)return 0;
                const current=e.snapshot(),currentBackend=current.stat?.世界?.[PATH];
                if(historyMemoryDigest(currentBackend)!==startDigest){e.lastHistoryMaintenance='历史在总结期间已变化，本次总结结果丢弃，下轮重试';return 0;}
                const validate=e.host.Samsara&&e.host.Samsara.validateWorldState,next=validate?validate(stat):stat,result=current.raw;
                result.stat_data=next;e.committing=true;
                await current.mvu.replaceMvuData(result,{type:'message',message_id:current.id});
                e.lastHistoryMaintenance='新增 '+made+' 个历史总结节点';return made;
            }finally{
                e.committing=false;if(failed)e.lastHistoryMaintenance='历史总结稍后重试：'+failed;
                e.status=previousStatus+(made?' · 历史总结+'+made:(failed?' · 历史总结待重试':''));
                e.render();e.historyMaintenanceBusy=false;
            }
        }
        async aroundRun(next){
            const e=this.engine,result=await next();
            if(result===true){
                try{await this.maintain();}
                catch(error){e.lastHistoryMaintenance='历史总结稍后重试：'+String(error?.message||error);try{console.warn('[世界推进] '+e.lastHistoryMaintenance);}catch(_){}}
            }
            return result;
        }
        bindPanel(){
            const e=this.engine,panel=e.panel;if(!panel||this.boundPanel===panel)return;
            this.boundPanel=panel;
            panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="history-prose-toggle"]');
                if(!button||!panel.contains(button))return;
                event.preventDefault();this.setSendToProse(e.config.sendHistoryToProse!==true);
            });
        }
        dispose(){this.boundPanel=null;}
    }
