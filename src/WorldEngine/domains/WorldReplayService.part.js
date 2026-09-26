    class WorldReplayService {
        constructor(engine){this.engine=engine;}
        initialize(){
            const e=this.engine;
            e.autoProgressTriggerEventsBound=false;e.autoProgressWaitingForVariable=false;e.worldReplayEventBound=false;
            e.worldReplayPendingFingerprint='';e.worldReplayManualForce=false;e.worldReplayImmediateRetrying=false;e.worldReplayIdleWaiters=[];
        }
        fingerprintParts(fingerprint){
            try{const parsed=JSON.parse(String(fingerprint||''));return {chat:String(parsed?.[0]??''),id:Number(parsed?.[1]),swipe:Number(parsed?.[2]||0),digest:String(parsed?.[3]??'')};}
            catch(_){return {chat:'',id:NaN,swipe:0,digest:''};}
        }
        sameFloor(left,right){
            const a=this.fingerprintParts(left),b=this.fingerprintParts(right);
            return !!a.chat&&a.chat===b.chat&&Number.isFinite(a.id)&&a.id===b.id;
        }
        currentMessage(){
            const e=this.engine,getMessages=e.fn('getChatMessages');if(!getMessages)return null;
            let message;try{message=getMessages(-1)?.[0];}catch(_){return null;}
            if(!message)return null;
            const id=Number(message.message_id!=null?message.message_id:message.id);
            if(!Number.isInteger(id)||id<0)return null;
            const role=String(message.role||'').toLowerCase();if(role==='user'||message.is_user===true)return null;
            const text=String(message.message!=null?message.message:message.mes||'');if(!text.trim())return null;
            const chatFn=e.fn('getCurrentChatId');let chat='';
            try{chat=String(chatFn?chatFn():(e.host.SillyTavern?.getContext?.()?.chatId??''));}catch(_){}
            if(!chat)return null;
            return {id,message,text,fingerprint:JSON.stringify([chat,id,message.swipe_id||0,digest(text)])};
        }
        pathAllowed(path){
            if(!Array.isArray(path)||!path.length||path.some(key=>forbidden.has(String(key))))return false;
            return WORLD_REPLAY_SCOPES.some(scope=>scope.every((key,index)=>path[index]===key));
        }
        atomicPath(path){
            if(path[0]==='世界'&&path[1]===PATH&&path.length>=4)return true;
            if(path[0]==='世界'&&['势力','探索'].includes(path[1])&&path.length>=3)return true;
            if(path[0]==='世界'&&path[1]==='因果轨道'&&path[2]==='偏移记录'&&path.length>=4)return true;
            if(path[0]==='传闻'&&path.length>=3)return true;
            if(path[0]==='资产'&&path.length>=2)return true;
            if(path[0]==='关系列表'&&path.length>=3)return true;
            return false;
        }
        collect(before,after,path,operations){
            if(same(before,after))return;
            if(after===undefined){operations.push({op:'remove',path:copy(path)});return;}
            if(before===undefined||this.atomicPath(path)||!plain(before)||!plain(after)){operations.push({op:'set',path:copy(path),value:copy(after)});return;}
            const keys=new Set([...Object.keys(before),...Object.keys(after)]);
            for(const key of keys){if(!forbidden.has(key))this.collect(before[key],after[key],path.concat(key),operations);}
        }
        buildPackage(beforeStat,afterStat,fingerprint){
            if(!plain(beforeStat)||!plain(afterStat)||!fingerprint)return null;
            const operations=[];for(const scope of WORLD_REPLAY_SCOPES)this.collect(get(beforeStat,scope),get(afterStat,scope),scope,operations);
            return operations.length?{version:WORLD_REPLAY_VERSION,fingerprint:String(fingerprint),operations}:null;
        }
        applyPackage(stat,packageValue){
            if(!plain(stat)||!plain(packageValue)||packageValue.version!==WORLD_REPLAY_VERSION||!Array.isArray(packageValue.operations))return false;
            for(const operation of packageValue.operations){
                const path=Array.isArray(operation?.path)?operation.path.map(String):[];
                if(!this.pathAllowed(path)||!['set','remove'].includes(operation?.op))return false;
            }
            for(const operation of packageValue.operations){
                const path=operation.path.map(String);let parent=stat;
                for(const key of path.slice(0,-1)){if(!plain(parent[key]))parent[key]={};parent=parent[key];}
                const key=path.at(-1);if(operation.op==='remove')delete parent[key];else parent[key]=copy(operation.value);
            }
            return true;
        }
        markEventInternal(){
            const target=this.engine.host;if(!target)return;
            const had=Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target.__samsaraUIMutation;
            target.__samsaraUIMutation=true;
            setTimeout(()=>{try{if(had)target.__samsaraUIMutation=previous;else delete target.__samsaraUIMutation;}catch(_){}},0);
        }
        reprocessContext(variables,before){
            const e=this.engine;if(!plain(variables?.stat_data))return null;
            const current=this.currentMessage();if(!current)return null;
            const mvu=e.env.Mvu||e.host.Mvu;let raw;
            try{raw=mvu?.getMvuData?.({type:'message',message_id:current.id});}catch(_){return null;}
            if(!plain(raw)||plain(raw.stat_data))return null;
            const beforeStat=plain(before?.stat_data)?before.stat_data:null,replay=raw.__samsaraWorldReplay;
            const replayMatches=plain(replay)&&String(replay.fingerprint||'')===current.fingerprint;
            const beforeHandled=String(beforeStat?.世界?.[PATH]?.已处理楼层||'');
            if(!replayMatches&&beforeHandled!==current.fingerprint)return null;
            return {current,raw,mvu,beforeStat};
        }
        setCycleRecovered(fingerprint,stat){
            const e=this.engine,auto=e.services?.autoProgress;
            e.autoProgressCycleKey=auto?.contextKey({fingerprint,stat})||'';
            e.autoProgressHasRun=true;e.autoProgressRoundsSinceRun=0;e.autoProgressLastSeenFingerprint=fingerprint;e.autoProgressDueFingerprint=fingerprint;
        }
        clearHandledForRetry(stat,fingerprint){
            const state=stat?.世界?.[PATH];if(!plain(state))return;
            if(!fingerprint||String(state.已处理楼层||'')===String(fingerprint)){state.已处理楼层='';state.已处理时间='';}
        }
        legacyPackage(context,variables){
            const beforeStat=context?.beforeStat;
            if(!plain(beforeStat)||!plain(variables?.stat_data))return null;
            if(String(beforeStat?.世界?.[PATH]?.已处理楼层||'')!==context.current.fingerprint)return null;
            return this.buildPackage(variables.stat_data,beforeStat,context.current.fingerprint);
        }
        waitForIdle(){
            const e=this.engine;if(!e.busy)return Promise.resolve();
            if(!Array.isArray(e.worldReplayIdleWaiters))e.worldReplayIdleWaiters=[];
            return new Promise(resolve=>e.worldReplayIdleWaiters.push(resolve));
        }
        resolveIdleWaiters(){
            const e=this.engine,waiters=Array.isArray(e.worldReplayIdleWaiters)?e.worldReplayIdleWaiters.splice(0):[];
            for(const resolve of waiters){try{resolve();}catch(_){}}
        }
        async immediateRetry(context,variables){
            const e=this.engine;
            if(!context?.mvu?.replaceMvuData||!plain(variables?.stat_data))return false;
            if(e.busy){e.cancel();await this.waitForIdle();}
            if(e.disposed||e.config.autoProgress!==true||!e.isEnabled())return false;
            const seed=Object.assign({},copy(context.raw),copy(variables));
            this.clearHandledForRetry(seed.stat_data,context.current.fingerprint);delete seed.__samsaraWorldReplay;this.markEventInternal();
            const previous=e.worldReplayImmediateRetrying===true;e.worldReplayImmediateRetrying=true;
            try{await context.mvu.replaceMvuData(seed,{type:'message',message_id:context.current.id});}
            finally{e.worldReplayImmediateRetrying=previous;}
            const result=await e.run({automatic:true});if(result!==true)return false;
            let finalRaw;try{finalRaw=context.mvu.getMvuData({type:'message',message_id:context.current.id});}catch(_){finalRaw=null;}
            if(plain(finalRaw?.stat_data))variables.stat_data=copy(finalRaw.stat_data);
            if(finalRaw&&Object.prototype.hasOwnProperty.call(finalRaw,'__samsaraWorldReplay'))variables.__samsaraWorldReplay=copy(finalRaw.__samsaraWorldReplay);
            return true;
        }
        async handleVariableEvent(variables,before){
            const e=this.engine;
            if(e.worldReplayImmediateRetrying===true)return false;
            const context=this.reprocessContext(variables,before);
            if(context){
                const stored=context.raw.__samsaraWorldReplay,valid=plain(stored)&&String(stored.fingerprint||'')===context.current.fingerprint;
                const legacy=!valid?this.legacyPackage(context,variables):null,replay=valid?stored:legacy;
                if(replay&&this.applyPackage(variables.stat_data,replay)){
                    this.markEventInternal();variables.__samsaraWorldReplay=copy(replay);this.setCycleRecovered(context.current.fingerprint,variables.stat_data);
                    e.status=legacy?'已从旧楼状态重建并恢复世界推进结果 · 未重新调用 AI':'已恢复本楼世界推进结果 · 未重新调用 AI';e.render();return true;
                }
                this.clearHandledForRetry(variables.stat_data,context.current.fingerprint);delete variables.__samsaraWorldReplay;this.setCycleRecovered(context.current.fingerprint,variables.stat_data);
                if(e.config.autoProgress===true&&e.isEnabled()){
                    e.status='变量已重处理 · 正在重新推进本楼';e.render();
                    return await this.immediateRetry(context,variables);
                }
                e.status=e.config.autoProgress!==true?'变量已重处理 · 旧楼缺少恢复快照；自动推进已关闭，请手动推进':'变量已重处理 · 世界推进已关闭，未自动重建';
                e.render();return false;
            }
            if(!plain(variables))return false;
            const pending=String(e.worldReplayPendingFingerprint||''),handled=String(variables?.stat_data?.世界?.[PATH]?.已处理楼层||'');
            if(pending&&handled===pending&&plain(before?.stat_data)&&plain(variables.stat_data)){
                const replay=this.buildPackage(before.stat_data,variables.stat_data,pending);
                if(replay)variables.__samsaraWorldReplay=replay;
                if(e.worldReplayManualForce)this.markEventInternal();
                return !!replay;
            }
            const timeHandled=await e.services?.timeOwnership?.afterReplayVariableEvent?.(variables,before,false);
            return timeHandled===true;
        }
        adjustSnapshot(snapshot){
            const e=this.engine;
            if(e.worldReplayManualForce&&snapshot?.fingerprint&&snapshot?.stat?.世界?.[PATH]?.已处理楼层===snapshot.fingerprint){
                snapshot.stat.世界[PATH].已处理楼层='';snapshot.stat.世界[PATH].已处理时间='';
            }
            return snapshot;
        }
        async aroundRun(next,options={}){
            const e=this.engine;let current=null;
            try{current=e.snapshot();}catch(_){}
            const fingerprint=String(current?.fingerprint||''),automatic=plain(options)&&options.automatic===true;
            const previousPending=e.worldReplayPendingFingerprint,previousManual=e.worldReplayManualForce;
            e.worldReplayPendingFingerprint=fingerprint;e.worldReplayManualForce=!automatic;
            try{return await next();}
            finally{e.worldReplayPendingFingerprint=previousPending;e.worldReplayManualForce=previousManual;this.resolveIdleWaiters();}
        }
        afterInit(){this.bindEvents();}
        bindEvents(){
            const e=this.engine,on=e.fn('eventOn'),events=e.env.tavern_events||e.host.tavern_events||{};
            if(!e.autoProgressTriggerEventsBound&&on&&events){
                const bindAuto=(event,source)=>{
                    if(!event)return false;
                    const off=on(event,()=>e.schedule(source));
                    if(typeof off==='function')e.unsub.push(off);else if(off&&off.stop)e.unsub.push(()=>off.stop());
                    return true;
                };
                let bound=false;bound=bindAuto(events.GENERATION_ENDED,'generation-ended')||bound;bound=bindAuto(events.MESSAGE_RECEIVED,'message-received')||bound;
                if(bound)e.autoProgressTriggerEventsBound=true;
            }
            if(!e.worldReplayEventBound){
                const mvu=e.env.Mvu||e.host.Mvu,first=e.fn('eventMakeFirst')||on,event=mvu?.events?.VARIABLE_UPDATE_ENDED;
                if(first&&event){
                    const off=first(event,(variables,before)=>Promise.resolve(this.handleVariableEvent(variables,before)).catch(error=>{try{console.error('[世界推进 replay]',error);}catch(_){}throw error;}));
                    if(typeof off==='function')e.unsub.push(off);else if(off&&off.stop)e.unsub.push(()=>off.stop());
                    e.worldReplayEventBound=true;
                }
            }
        }
    }
