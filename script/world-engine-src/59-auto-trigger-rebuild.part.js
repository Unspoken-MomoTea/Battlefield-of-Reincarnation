    // 自动推进触发重构：正文完成是主入口；变量重处理只恢复已确认结果，不重新调用世界 AI。
    const WORLD_REPLAY_VERSION=1;
    const WORLD_REPLAY_SCOPES=[
        ['世界','货币'],['世界','历法'],['世界',PATH],['世界','因果轨道'],['世界','势力'],['世界','探索'],
        ['世界','异端雷达','名单'],['世界','稳定'],['传闻'],['资产'],['关系列表']
    ];
    class WorldAutoTriggerReplayFeature {
        constructor(engine){
            this.engine=engine;
            this.baseInit=engine.init.bind(engine);
            this.baseSnapshot=engine.snapshot.bind(engine);
            this.baseRun=engine.run.bind(engine);
            this.baseSchedule=engine.schedule.bind(engine);
            this.baseResetAutoProgressCycle=typeof engine.resetAutoProgressCycle==='function'?engine.resetAutoProgressCycle.bind(engine):()=>{};
        }
        initialize(){
            const e=this.engine;
            e.autoProgressTriggerEventsBound=false;
            e.autoProgressWaitingForVariable=false;
            e.worldReplayEventBound=false;
            e.worldReplayPendingFingerprint='';
            e.worldReplayManualForce=false;
            for(const name of [
                'autoProgressFingerprintParts','autoProgressSameFloor','autoProgressDuringExtraAnalysis','worldReplayCurrentMessage',
                'worldReplayPathAllowed','worldReplayAtomicPath','worldReplayCollect','buildWorldReplayPackage','applyWorldReplayPackage',
                'worldReplayMarkEventInternal','handleWorldReplayVariableEvent','autoProgressShouldSchedule','resetAutoProgressCycle'
            ])e[name]=this[name].bind(this);
            e.snapshot=()=>this.snapshot();
            e.run=options=>this.run(options);
            e.schedule=(source,attempt)=>this.schedule(source,attempt);
        }
        afterInit(){this.bindExtraEvents();}
        bindExtraEvents(){
            const e=this.engine,on=e.fn('eventOn'),events=e.env.tavern_events||e.host.tavern_events||{};
            if(!e.autoProgressTriggerEventsBound&&on&&events){
                const bindAuto=(event,source)=>{
                    if(!event)return false;
                    const off=on(event,()=>e.schedule(source));
                    if(typeof off==='function')e.unsub.push(off);else if(off&&off.stop)e.unsub.push(()=>off.stop());
                    return true;
                };
                let bound=false;
                bound=bindAuto(events.GENERATION_ENDED,'generation-ended')||bound;
                bound=bindAuto(events.MESSAGE_RECEIVED,'message-received')||bound;
                if(bound)e.autoProgressTriggerEventsBound=true;
            }
            if(!e.worldReplayEventBound){
                const mvu=e.env.Mvu||e.host.Mvu,first=e.fn('eventMakeFirst')||on,event=mvu?.events?.VARIABLE_UPDATE_ENDED;
                if(first&&event){
                    const off=first(event,(variables,before)=>e.handleWorldReplayVariableEvent(variables,before));
                    if(typeof off==='function')e.unsub.push(off);else if(off&&off.stop)e.unsub.push(()=>off.stop());
                    e.worldReplayEventBound=true;
                }
            }
        }
        autoProgressFingerprintParts(fingerprint){
            try{const parsed=JSON.parse(String(fingerprint||''));return {chat:String(parsed?.[0]??''),id:Number(parsed?.[1]),swipe:Number(parsed?.[2]||0),digest:String(parsed?.[3]??'')};}
            catch(_){return {chat:'',id:NaN,swipe:0,digest:''};}
        }
        autoProgressSameFloor(left,right){
            const a=this.autoProgressFingerprintParts(left),b=this.autoProgressFingerprintParts(right);
            return !!a.chat&&a.chat===b.chat&&Number.isFinite(a.id)&&a.id===b.id;
        }
        autoProgressDuringExtraAnalysis(){
            const mvu=this.engine.env.Mvu||this.engine.host.Mvu;
            try{return mvu?.isDuringExtraAnalysis?.()===true;}catch(_){return false;}
        }
        worldReplayCurrentMessage(){
            const e=this.engine,getMessages=e.fn('getChatMessages');if(!getMessages)return null;
            let message;try{message=getMessages(-1)?.[0];}catch(_){return null;}
            if(!message)return null;
            const id=Number(message.message_id!=null?message.message_id:message.id),role=String(message.role||'').toLowerCase();
            if(!Number.isInteger(id)||id<0||role==='user'||message.is_user===true)return null;
            const text=String(message.message!=null?message.message:message.mes||'');if(!text.trim())return null;
            const chatFn=e.fn('getCurrentChatId');let chat='';
            try{chat=String(chatFn?chatFn():(e.host.SillyTavern?.getContext?.()?.chatId??''));}catch(_){}
            if(!chat)return null;
            const fingerprint=JSON.stringify([chat,id,message.swipe_id||0,digest(text)]);
            return {id,message,text,fingerprint};
        }
        worldReplayPathAllowed(path){
            return Array.isArray(path)&&path.length>0&&!path.some(key=>forbidden.has(String(key)))&&WORLD_REPLAY_SCOPES.some(scope=>scope.every((key,index)=>path[index]===key));
        }
        worldReplayAtomicPath(path){
            if(path[0]==='世界'&&path[1]===PATH&&path.length>=4)return true;
            if(path[0]==='世界'&&['势力','探索'].includes(path[1])&&path.length>=3)return true;
            if(path[0]==='世界'&&path[1]==='因果轨道'&&path[2]==='偏移记录'&&path.length>=4)return true;
            if(path[0]==='传闻'&&path.length>=3)return true;
            if(path[0]==='资产'&&path.length>=2)return true;
            if(path[0]==='关系列表'&&path.length>=3)return true;
            return false;
        }
        worldReplayCollect(before,after,path,operations){
            if(same(before,after))return;
            if(after===undefined){operations.push({op:'remove',path:copy(path)});return;}
            if(before===undefined||this.worldReplayAtomicPath(path)||!plain(before)||!plain(after)){operations.push({op:'set',path:copy(path),value:copy(after)});return;}
            const keys=new Set([...Object.keys(before),...Object.keys(after)]);
            for(const key of keys){if(!forbidden.has(key))this.worldReplayCollect(before[key],after[key],path.concat(key),operations);}
        }
        buildWorldReplayPackage(beforeStat,afterStat,fingerprint){
            if(!plain(beforeStat)||!plain(afterStat)||!fingerprint)return null;
            const operations=[];for(const scope of WORLD_REPLAY_SCOPES)this.worldReplayCollect(get(beforeStat,scope),get(afterStat,scope),scope,operations);
            return operations.length?{version:WORLD_REPLAY_VERSION,fingerprint:String(fingerprint),operations}:null;
        }
        applyWorldReplayPackage(stat,packageValue){
            if(!plain(stat)||!plain(packageValue)||packageValue.version!==WORLD_REPLAY_VERSION||!Array.isArray(packageValue.operations))return false;
            for(const operation of packageValue.operations){
                const path=Array.isArray(operation?.path)?operation.path.map(String):[];
                if(!this.worldReplayPathAllowed(path)||!['set','remove'].includes(operation?.op))return false;
            }
            for(const operation of packageValue.operations){
                const path=operation.path.map(String);let parent=stat;
                for(const key of path.slice(0,-1)){if(!plain(parent[key]))parent[key]={};parent=parent[key];}
                const key=path.at(-1);if(operation.op==='remove')delete parent[key];else parent[key]=copy(operation.value);
            }
            return true;
        }
        worldReplayMarkEventInternal(){
            const target=this.engine.host;if(!target)return;
            const had=Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target.__samsaraUIMutation;
            target.__samsaraUIMutation=true;
            setTimeout(()=>{try{if(had)target.__samsaraUIMutation=previous;else delete target.__samsaraUIMutation;}catch(_){}},0);
        }
        handleWorldReplayVariableEvent(variables,before){
            const e=this.engine;
            if(!plain(variables))return false;
            const pending=String(e.worldReplayPendingFingerprint||''),handled=String(variables?.stat_data?.世界?.[PATH]?.已处理楼层||'');
            if(pending&&handled===pending&&plain(before?.stat_data)&&plain(variables.stat_data)){
                const replay=this.buildWorldReplayPackage(before.stat_data,variables.stat_data,pending);
                if(replay)variables.__samsaraWorldReplay=replay;
                if(e.worldReplayManualForce)this.worldReplayMarkEventInternal();
                return !!replay;
            }
            const current=this.worldReplayCurrentMessage();if(!current||!plain(variables.stat_data))return false;
            const mvu=e.env.Mvu||e.host.Mvu;let raw;try{raw=mvu?.getMvuData?.({type:'message',message_id:current.id});}catch(_){return false;}
            if(!raw||plain(raw.stat_data))return false;
            const storedReplay=raw.__samsaraWorldReplay,beforeHandled=String(before?.stat_data?.世界?.[PATH]?.已处理楼层||'');
            const replayMatches=plain(storedReplay)&&String(storedReplay.fingerprint||'')===current.fingerprint;
            if(!replayMatches&&beforeHandled!==current.fingerprint)return false;
            this.worldReplayMarkEventInternal();
            const replay=storedReplay;
            if(!plain(replay)||String(replay.fingerprint||'')!==current.fingerprint){e.status='变量已重处理 · 本楼没有可恢复的世界推进快照';e.render();return false;}
            if(!this.applyWorldReplayPackage(variables.stat_data,replay)){e.status='变量已重处理 · 世界推进恢复包无效，未自动重推';e.render();return false;}
            variables.__samsaraWorldReplay=copy(replay);
            e.autoProgressCycleKey=e.autoProgressContextKey({fingerprint:current.fingerprint,stat:variables.stat_data});
            e.autoProgressHasRun=true;e.autoProgressRoundsSinceRun=0;e.autoProgressLastSeenFingerprint=current.fingerprint;e.autoProgressDueFingerprint=current.fingerprint;
            e.status='已恢复本楼世界推进结果 · 未重新调用 AI';e.render();return true;
        }
        autoProgressShouldSchedule(snapshot){
            const e=this.engine;e.initializeAutoProgressCycle(snapshot);
            const fingerprint=String(snapshot?.fingerprint||'');if(!fingerprint)return false;
            const handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||'');
            if(e.autoProgressLastSeenFingerprint===fingerprint)return e.autoProgressDueFingerprint===fingerprint&&handled!==fingerprint;
            const previous=e.autoProgressLastSeenFingerprint;
            if(previous&&this.autoProgressSameFloor(previous,fingerprint)){
                const wasDue=e.autoProgressDueFingerprint===previous;e.autoProgressLastSeenFingerprint=fingerprint;if(wasDue)e.autoProgressDueFingerprint=fingerprint;return wasDue;
            }
            e.autoProgressLastSeenFingerprint=fingerprint;if(e.autoProgressHasRun)e.autoProgressRoundsSinceRun++;
            const due=!e.autoProgressHasRun||e.autoProgressRoundsSinceRun>=e.autoProgressIntervalValue();if(due)e.autoProgressDueFingerprint=fingerprint;return due;
        }
        resetAutoProgressCycle(){this.baseResetAutoProgressCycle();this.engine.autoProgressWaitingForVariable=false;}
        snapshot(){
            const e=this.engine,snapshot=this.baseSnapshot();
            if(e.worldReplayManualForce&&snapshot?.fingerprint&&snapshot?.stat?.世界?.[PATH]?.已处理楼层===snapshot.fingerprint){
                snapshot.stat.世界[PATH].已处理楼层='';snapshot.stat.世界[PATH].已处理时间='';
            }
            return snapshot;
        }
        async run(options={}){
            const e=this.engine;let current=null;try{current=this.baseSnapshot();}catch(_){}
            const fingerprint=String(current?.fingerprint||''),automatic=plain(options)&&options.automatic===true;
            const previousPending=e.worldReplayPendingFingerprint,previousManual=e.worldReplayManualForce;
            e.worldReplayPendingFingerprint=fingerprint;e.worldReplayManualForce=!automatic;
            try{return await this.baseRun(options);}
            finally{e.worldReplayPendingFingerprint=previousPending;e.worldReplayManualForce=previousManual;}
        }
        schedule(source='variable-update',attempt=0){
            const e=this.engine;
            if(e.config.autoProgress!==true){if(e.timer){clearTimeout(e.timer);e.timer=null;}return;}
            if(e.disposed||e.committing||!e.isEnabled())return;
            if(e.busy){e.pending=true;return;}
            const trigger=String(source||'variable-update'),proseTrigger=trigger==='generation-ended'||trigger==='message-received',tries=Math.max(0,Number(attempt)||0);
            if(proseTrigger&&this.autoProgressDuringExtraAnalysis()){
                e.autoProgressWaitingForVariable=true;clearTimeout(e.timer);
                if(tries<120)e.timer=setTimeout(()=>{e.timer=null;e.schedule(trigger,tries+1);},1000);return;
            }
            e.autoProgressWaitingForVariable=false;clearTimeout(e.timer);
            const delay=proseTrigger?(tries>0?250:800):900;
            e.timer=setTimeout(()=>{
                e.timer=null;if(e.config.autoProgress!==true||e.disposed||e.committing||!e.isEnabled())return;
                if(e.busy){e.pending=true;return;}
                if(proseTrigger&&this.autoProgressDuringExtraAnalysis()){
                    e.autoProgressWaitingForVariable=true;if(tries<120)e.timer=setTimeout(()=>{e.timer=null;e.schedule(trigger,tries+1);},1000);return;
                }
                let snapshot;try{snapshot=e.snapshot();}catch(_){if(proseTrigger&&tries<4)e.timer=setTimeout(()=>{e.timer=null;e.schedule(trigger,tries+1);},250);return;}
                e.autoProgressWaitingForVariable=false;
                const reason=e.blocked(snapshot);if(reason){e.status=reason;e.render();return;}
                if(!e.autoProgressShouldSchedule(snapshot))return;
                e.run({automatic:true}).catch(()=>{});
            },delay);
        }
    }
    registerWorldEngineFeature('auto-trigger-replay',engine=>new WorldAutoTriggerReplayFeature(engine));
