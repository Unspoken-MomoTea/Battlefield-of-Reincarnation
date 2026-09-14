    // 自动推进触发重构：正文完成是主入口，MVU 更新只负责变量就绪后的放行/补跑。
    const SamsaraWorldEngineBeforeAutoTriggerRebuild=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeAutoTriggerRebuild {
        constructor(host,env) {
            super(host,env);
            this.autoProgressTriggerEventsBound=false;
            this.autoProgressWaitingForVariable=false;
            this.autoProgressReprocessCommit='';
        }
        init() {
            const result=super.init();
            if(this.autoProgressTriggerEventsBound)return result;
            const on=this.fn('eventOn');
            const events=this.env.tavern_events||this.host.tavern_events||{};
            if(!on||!events)return result;
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
        captureAutoProgressReprocessCommit() {
            const mvu=this.env.Mvu||this.host.Mvu;
            const getMessages=this.fn('getChatMessages');
            if(!mvu||!getMessages)return false;
            let message;
            try{message=getMessages(-1)?.[0];}catch(_){return false;}
            if(!message)return false;
            const id=Number(message.message_id!=null?message.message_id:message.id);
            if(!Number.isInteger(id))return false;
            let raw;
            try{raw=mvu.getMvuData({type:'message',message_id:id});}catch(_){return false;}
            // MVU“重新处理变量”会先删除当前楼层 stat_data/schema，但未知 root 字段会保留。
            // 世界引擎提交标记正好因此成为可靠的一次性恢复凭证；普通新楼层不会携带当前楼层自己的提交标记。
            if(plain(raw?.stat_data))return false;
            const commit=String(raw?.__samsaraWorldCommit||'');
            if(!commit)return false;
            const parts=this.autoProgressFingerprintParts(commit);
            const chatFn=this.fn('getCurrentChatId');
            let chat='';try{chat=String(chatFn?chatFn():(this.host.SillyTavern?.getContext?.()?.chatId??''));}catch(_){}
            if(!Number.isFinite(parts.id)||parts.id!==id)return false;
            if(chat&&parts.chat&&parts.chat!==chat)return false;
            this.autoProgressReprocessCommit=commit;
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
        markAutoProgressRun(snapshot) {
            super.markAutoProgressRun(snapshot);
            const fingerprint=String(snapshot?.fingerprint||'');
            if(fingerprint&&this.autoProgressReprocessCommit&&this.autoProgressSameFloor(this.autoProgressReprocessCommit,fingerprint)){
                this.autoProgressReprocessCommit='';
            }
        }
        resetAutoProgressCycle() {
            super.resetAutoProgressCycle();
            this.autoProgressWaitingForVariable=false;
            this.autoProgressReprocessCommit='';
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
            // VARIABLE_UPDATE_ENDED 发生在 MVU 把重建变量写回当前楼层之前。
            // 因此要在这里、而不是 900ms 后，捕获“当前楼层已被清空但世界提交标记仍在”的真实重处理信号。
            if(trigger==='variable-update')this.captureAutoProgressReprocessCommit();
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
                const fingerprint=String(snapshot.fingerprint||'');
                const handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||'');
                const forceReprocess=this.autoProgressReprocessCommit&&this.autoProgressSameFloor(this.autoProgressReprocessCommit,fingerprint);
                if(this.autoProgressReprocessCommit&&!forceReprocess)this.autoProgressReprocessCommit='';
                if(forceReprocess){
                    if(handled===fingerprint){
                        this.autoProgressReprocessCommit='';
                        return;
                    }
                    // 显式重处理的是“曾经真正完成过世界推进”的当前楼层。
                    // 不再让 interval=2、页面重载后的内存计数或上一楼层已有后台内容阻止重建。
                    this.autoProgressLastSeenFingerprint=fingerprint;
                    this.autoProgressDueFingerprint=fingerprint;
                    this.run().catch(()=>{});
                    return;
                }
                if(!this.autoProgressShouldSchedule(snapshot))return;
                this.run().catch(()=>{});
            },delay);
        }
    };
