    // 自动推进触发重构：正文完成是主入口；变量重处理只恢复已确认结果，不重新调用世界 AI。
    const WORLD_REPLAY_VERSION=1;
    const WORLD_REPLAY_SCOPES=[
        ['世界','货币'],['世界','历法'],['世界',PATH],['世界','因果轨道'],['世界','势力'],['世界','探索'],
        ['世界','异端雷达','名单'],['世界','稳定'],['传闻'],['资产'],['关系列表']
    ];
    const SamsaraWorldEngineBeforeAutoTriggerRebuild=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeAutoTriggerRebuild {
        constructor(host,env) {
            super(host,env);
            this.autoProgressTriggerEventsBound=false;
            this.autoProgressWaitingForVariable=false;
            this.worldReplayEventBound=false;
            this.worldReplayPendingFingerprint='';
            this.worldReplayManualForce=false;
        }
        init() {
            const result=super.init();
            const on=this.fn('eventOn');
            const events=this.env.tavern_events||this.host.tavern_events||{};
            if(!this.autoProgressTriggerEventsBound&&on&&events){
                const bindAuto=(event,source)=>{
                    if(!event)return false;
                    const off=on(event,()=>this.schedule(source));
                    if(typeof off==='function')this.unsub.push(off);
                    else if(off&&off.stop)this.unsub.push(()=>off.stop());
                    return true;
                };
                let bound=false;
                bound=bindAuto(events.GENERATION_ENDED,'generation-ended')||bound;
                bound=bindAuto(events.MESSAGE_RECEIVED,'message-received')||bound;
                if(bound)this.autoProgressTriggerEventsBound=true;
            }
            if(!this.worldReplayEventBound){
                const mvu=this.env.Mvu||this.host.Mvu;
                const first=this.fn('eventMakeFirst')||on;
                const event=mvu?.events?.VARIABLE_UPDATE_ENDED;
                if(first&&event){
                    const off=first(event,(variables,before)=>this.handleWorldReplayVariableEvent(variables,before));
                    if(typeof off==='function')this.unsub.push(off);
                    else if(off&&off.stop)this.unsub.push(()=>off.stop());
                    this.worldReplayEventBound=true;
                }
            }
            return result;
        }
        autoProgressFingerprintParts(fingerprint) {
            try {
                const parsed=JSON.parse(String(fingerprint||''));
                return {chat:String(parsed?.[0]??''),id:Number(parsed?.[1]),swipe:Number(parsed?.[2]||0),digest:String(parsed?.[3]??'')};
            } catch (_) {
                return {chat:'',id:NaN,swipe:0,digest:''};
            }
        }
        autoProgressSameFloor(left,right) {
            const a=this.autoProgressFingerprintParts(left),b=this.autoProgressFingerprintParts(right);
            return !!a.chat&&a.chat===b.chat&&Number.isFinite(a.id)&&a.id===b.id;
        }
        autoProgressDuringExtraAnalysis() {
            const mvu=this.env.Mvu||this.host.Mvu;
            try{return mvu?.isDuringExtraAnalysis?.()===true;}catch(_){return false;}
        }
        worldReplayCurrentMessage() {
            const getMessages=this.fn('getChatMessages');
            if(!getMessages)return null;
            let message;try{message=getMessages(-1)?.[0];}catch(_){return null;}
            if(!message)return null;
            const id=Number(message.message_id!=null?message.message_id:message.id);
            if(!Number.isInteger(id)||id<0)return null;
            const role=String(message.role||'').toLowerCase();
            if(role==='user'||message.is_user===true)return null;
            const text=String(message.message!=null?message.message:message.mes||'');
            if(!text.trim())return null;
            const chatFn=this.fn('getCurrentChatId');
            let chat='';
            try{chat=String(chatFn?chatFn():(this.host.SillyTavern?.getContext?.()?.chatId??''));}catch(_){}
            if(!chat)return null;
            const fingerprint=JSON.stringify([chat,id,message.swipe_id||0,digest(text)]);
            return {id,message,text,fingerprint};
        }
        worldReplayPathAllowed(path) {
            if(!Array.isArray(path)||!path.length||path.some(key=>forbidden.has(String(key))))return false;
            return WORLD_REPLAY_SCOPES.some(scope=>scope.every((key,index)=>path[index]===key));
        }
        worldReplayAtomicPath(path) {
            if(path[0]==='世界'&&path[1]===PATH&&path.length>=4)return true;
            if(path[0]==='世界'&&['势力','探索'].includes(path[1])&&path.length>=3)return true;
            if(path[0]==='世界'&&path[1]==='因果轨道'&&path[2]==='偏移记录'&&path.length>=4)return true;
            if(path[0]==='传闻'&&path.length>=3)return true;
            if(path[0]==='资产'&&path.length>=2)return true;
            if(path[0]==='关系列表'&&path.length>=3)return true;
            return false;
        }
        worldReplayCollect(before,after,path,operations) {
            if(same(before,after))return;
            if(after===undefined){operations.push({op:'remove',path:copy(path)});return;}
            if(before===undefined||this.worldReplayAtomicPath(path)||!plain(before)||!plain(after)){
                operations.push({op:'set',path:copy(path),value:copy(after)});return;
            }
            const keys=new Set([...Object.keys(before),...Object.keys(after)]);
            for(const key of keys){
                if(forbidden.has(key))continue;
                this.worldReplayCollect(before[key],after[key],path.concat(key),operations);
            }
        }
        buildWorldReplayPackage(beforeStat,afterStat,fingerprint) {
            if(!plain(beforeStat)||!plain(afterStat)||!fingerprint)return null;
            const operations=[];
            for(const scope of WORLD_REPLAY_SCOPES)this.worldReplayCollect(get(beforeStat,scope),get(afterStat,scope),scope,operations);
            if(!operations.length)return null;
            return {version:WORLD_REPLAY_VERSION,fingerprint:String(fingerprint),operations};
        }
        applyWorldReplayPackage(stat,packageValue) {
            if(!plain(stat)||!plain(packageValue)||packageValue.version!==WORLD_REPLAY_VERSION||!Array.isArray(packageValue.operations))return false;
            for(const operation of packageValue.operations){
                const path=Array.isArray(operation?.path)?operation.path.map(String):[];
                if(!this.worldReplayPathAllowed(path)||!['set','remove'].includes(operation?.op))return false;
            }
            for(const operation of packageValue.operations){
                const path=operation.path.map(String);
                let parent=stat;
                for(const key of path.slice(0,-1)){
                    if(!plain(parent[key]))parent[key]={};
                    parent=parent[key];
                }
                const key=path.at(-1);
                if(operation.op==='remove')delete parent[key];
                else parent[key]=copy(operation.value);
            }
            return true;
        }
        worldReplayMarkEventInternal() {
            const target=this.host;
            if(!target)return;
            const had=Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target.__samsaraUIMutation;
            target.__samsaraUIMutation=true;
            setTimeout(()=>{
                try{
                    if(had)target.__samsaraUIMutation=previous;
                    else delete target.__samsaraUIMutation;
                }catch(_){}
            },0);
        }
        handleWorldReplayVariableEvent(variables,before) {
            if(!plain(variables))return false;
            const pending=String(this.worldReplayPendingFingerprint||'');
            const handled=String(variables?.stat_data?.世界?.[PATH]?.已处理楼层||'');
            // 世界推进成功提交：在 MVU 真正落库前，把本次“实际变更”压缩成同楼恢复包一并保存。
            if(pending&&handled===pending&&plain(before?.stat_data)&&plain(variables.stat_data)){
                const replay=this.buildWorldReplayPackage(before.stat_data,variables.stat_data,pending);
                if(replay)variables.__samsaraWorldReplay=replay;
                if(this.worldReplayManualForce)this.worldReplayMarkEventInternal();
                return !!replay;
            }

            // MVU“重新处理变量”会先清空当前消息 stat_data/schema，但保留未知 root 字段。
            // 只有当前消息自己的 replay 指纹或 before 中已处理楼层能证明旧结果，才认定为同正文重处理。
            const current=this.worldReplayCurrentMessage();
            if(!current||!plain(variables.stat_data))return false;
            const mvu=this.env.Mvu||this.host.Mvu;
            let raw;try{raw=mvu?.getMvuData?.({type:'message',message_id:current.id});}catch(_){return false;}
            if(!raw||plain(raw.stat_data))return false;
            const storedReplay=raw.__samsaraWorldReplay;
            const beforeHandled=String(before?.stat_data?.世界?.[PATH]?.已处理楼层||'');
            const replayMatches=plain(storedReplay)&&String(storedReplay.fingerprint||'')===current.fingerprint;
            if(!replayMatches&&beforeHandled!==current.fingerprint)return false;

            // 重处理本身不是新的游戏轮次，也绝不能触发世界 AI；让世界引擎把本事件视为内部恢复。
            this.worldReplayMarkEventInternal();
            const replay=storedReplay;
            if(!plain(replay)||String(replay.fingerprint||'')!==current.fingerprint){
                this.status='变量已重处理 · 本楼没有可恢复的世界推进快照';
                this.render();
                return false;
            }
            if(!this.applyWorldReplayPackage(variables.stat_data,replay)){
                this.status='变量已重处理 · 世界推进恢复包无效，未自动重推';
                this.render();
                return false;
            }
            variables.__samsaraWorldReplay=copy(replay);
            this.autoProgressCycleKey=this.autoProgressContextKey({fingerprint:current.fingerprint,stat:variables.stat_data});
            this.autoProgressHasRun=true;
            this.autoProgressRoundsSinceRun=0;
            this.autoProgressLastSeenFingerprint=current.fingerprint;
            this.autoProgressDueFingerprint=current.fingerprint;
            this.status='已恢复本楼世界推进结果 · 未重新调用 AI';
            this.render();
            return true;
        }
        autoProgressShouldSchedule(snapshot) {
            this.initializeAutoProgressCycle(snapshot);
            const fingerprint=String(snapshot?.fingerprint||'');
            if(!fingerprint)return false;
            const handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||'');
            if(this.autoProgressLastSeenFingerprint===fingerprint){
                return this.autoProgressDueFingerprint===fingerprint&&handled!==fingerprint;
            }
            const previous=this.autoProgressLastSeenFingerprint;
            // regenerate / swipe / 同楼正文重生不算新的推进轮次。
            // 该楼若本来应推进，正文改变后必须重跑；若本来处于间隔跳过，则继续跳过。
            if(previous&&this.autoProgressSameFloor(previous,fingerprint)){
                const wasDue=this.autoProgressDueFingerprint===previous;
                this.autoProgressLastSeenFingerprint=fingerprint;
                if(wasDue)this.autoProgressDueFingerprint=fingerprint;
                return wasDue;
            }
            this.autoProgressLastSeenFingerprint=fingerprint;
            if(this.autoProgressHasRun)this.autoProgressRoundsSinceRun++;
            const due=!this.autoProgressHasRun||this.autoProgressRoundsSinceRun>=this.autoProgressIntervalValue();
            if(due)this.autoProgressDueFingerprint=fingerprint;
            return due;
        }
        resetAutoProgressCycle() {
            super.resetAutoProgressCycle();
            this.autoProgressWaitingForVariable=false;
        }
        snapshot() {
            const snapshot=super.snapshot();
            // 只有显式手动“推进世界”才允许同一正文绕过已处理标记重新推演。
            // 这里只改请求使用的副本；旧世界状态和恢复包在新请求成功前始终保留在 MVU 中。
            if(this.worldReplayManualForce&&snapshot?.fingerprint&&snapshot?.stat?.世界?.[PATH]?.已处理楼层===snapshot.fingerprint){
                snapshot.stat.世界[PATH].已处理楼层='';
                snapshot.stat.世界[PATH].已处理时间='';
            }
            return snapshot;
        }
        async run(options={}) {
            let current=null;
            try{current=super.snapshot();}catch(_){}
            const fingerprint=String(current?.fingerprint||'');
            const automatic=plain(options)&&options.automatic===true;
            const previousPending=this.worldReplayPendingFingerprint;
            const previousManual=this.worldReplayManualForce;
            this.worldReplayPendingFingerprint=fingerprint;
            this.worldReplayManualForce=!automatic;
            try{return await super.run(options);}
            finally{
                this.worldReplayPendingFingerprint=previousPending;
                this.worldReplayManualForce=previousManual;
            }
        }
        schedule(source='variable-update',attempt=0) {
            if(this.config.autoProgress!==true){
                if(this.timer){clearTimeout(this.timer);this.timer=null;}
                return;
            }
            if(this.disposed||this.committing||!this.isEnabled())return;
            if(this.busy){this.pending=true;return;}
            const trigger=String(source||'variable-update');
            const proseTrigger=trigger==='generation-ended'||trigger==='message-received';
            const tries=Math.max(0,Number(attempt)||0);
            // 主正文结束后若变量 AI 正在解析，先等变量；变量事件丢失时仍会复查，不让自动推进永久失活。
            if(proseTrigger&&this.autoProgressDuringExtraAnalysis()){
                this.autoProgressWaitingForVariable=true;
                clearTimeout(this.timer);
                if(tries<120)this.timer=setTimeout(()=>{this.timer=null;this.schedule(trigger,tries+1);},1000);
                return;
            }
            this.autoProgressWaitingForVariable=false;
            clearTimeout(this.timer);
            const delay=proseTrigger?(tries>0?250:800):900;
            this.timer=setTimeout(()=>{
                this.timer=null;
                if(this.config.autoProgress!==true||this.disposed||this.committing||!this.isEnabled())return;
                if(this.busy){this.pending=true;return;}
                if(proseTrigger&&this.autoProgressDuringExtraAnalysis()){
                    this.autoProgressWaitingForVariable=true;
                    if(tries<120)this.timer=setTimeout(()=>{this.timer=null;this.schedule(trigger,tries+1);},1000);
                    return;
                }
                let snapshot;
                try{snapshot=this.snapshot();}
                catch(_){
                    // 正文已完成但本楼 MVU 还没落盘：短暂重试；VARIABLE_UPDATE_ENDED 若先到会直接接管。
                    if(proseTrigger&&tries<4)this.timer=setTimeout(()=>{this.timer=null;this.schedule(trigger,tries+1);},250);
                    return;
                }
                this.autoProgressWaitingForVariable=false;
                const reason=this.blocked(snapshot);
                if(reason){this.status=reason;this.render();return;}
                if(!this.autoProgressShouldSchedule(snapshot))return;
                this.run({automatic:true}).catch(()=>{});
            },delay);
        }
    };
