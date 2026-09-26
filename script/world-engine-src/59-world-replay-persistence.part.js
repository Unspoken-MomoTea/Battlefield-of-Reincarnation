    // 恢复包可靠性：世界推进成功后主动持久化 replay，不再依赖 replaceMvuData 是否触发可用的 VARIABLE_UPDATE_ENDED。
    class WorldReplayPersistenceFeature {
        constructor(engine){
            this.engine=engine;
            this.baseHandle=engine.handleWorldReplayVariableEvent?.bind(engine);
        }
        initialize(){
            const e=this.engine;
            for(const name of ['worldReplayReprocessContext','worldReplaySetCycleRecovered','worldReplayClearHandledForRetry','worldReplayLegacyPackage'])e[name]=this[name].bind(this);
            e.handleWorldReplayVariableEvent=(variables,before)=>this.handleWorldReplayVariableEvent(variables,before);
        }
        worldReplayReprocessContext(variables,before){
            const e=this.engine;
            if(!plain(variables?.stat_data))return null;
            const current=e.worldReplayCurrentMessage?.();if(!current)return null;
            const mvu=e.env.Mvu||e.host.Mvu;let raw;
            try{raw=mvu?.getMvuData?.({type:'message',message_id:current.id});}catch(_){return null;}
            if(!plain(raw)||plain(raw.stat_data))return null;
            const beforeStat=plain(before?.stat_data)?before.stat_data:null,replay=raw.__samsaraWorldReplay;
            const replayMatches=plain(replay)&&String(replay.fingerprint||'')===current.fingerprint;
            const beforeHandled=String(beforeStat?.世界?.[PATH]?.已处理楼层||'');
            if(!replayMatches&&beforeHandled!==current.fingerprint)return null;
            return {current,raw,mvu,beforeStat};
        }
        worldReplaySetCycleRecovered(fingerprint,stat){
            const e=this.engine;
            e.autoProgressCycleKey=e.autoProgressContextKey({fingerprint,stat});
            e.autoProgressHasRun=true;e.autoProgressRoundsSinceRun=0;e.autoProgressLastSeenFingerprint=fingerprint;e.autoProgressDueFingerprint=fingerprint;
        }
        worldReplayClearHandledForRetry(stat,fingerprint){
            const state=stat?.世界?.[PATH];if(!plain(state))return;
            if(!fingerprint||String(state.已处理楼层||'')===String(fingerprint)){state.已处理楼层='';state.已处理时间='';}
        }
        worldReplayLegacyPackage(context,variables){
            const beforeStat=context?.beforeStat;
            if(!plain(beforeStat)||!plain(variables?.stat_data))return null;
            if(String(beforeStat?.世界?.[PATH]?.已处理楼层||'')!==context.current.fingerprint)return null;
            return this.engine.buildWorldReplayPackage(variables.stat_data,beforeStat,context.current.fingerprint);
        }
        handleWorldReplayVariableEvent(variables,before){
            const e=this.engine,context=this.worldReplayReprocessContext(variables,before);
            if(context){
                let replay=plain(context.raw.__samsaraWorldReplay)&&String(context.raw.__samsaraWorldReplay.fingerprint||'')===context.current.fingerprint?context.raw.__samsaraWorldReplay:null;
                let legacyRecovered=false;
                if(!replay){replay=this.worldReplayLegacyPackage(context,variables);legacyRecovered=!!replay;}
                if(replay&&e.applyWorldReplayPackage(variables.stat_data,replay)){
                    e.worldReplayMarkEventInternal();variables.__samsaraWorldReplay=copy(replay);
                    this.worldReplaySetCycleRecovered(context.current.fingerprint,variables.stat_data);
                    e.status=legacyRecovered?'已从旧楼状态重建并恢复世界推进结果 · 未重新调用 AI':'已恢复本楼世界推进结果 · 未重新调用 AI';
                    e.render();return true;
                }
                this.worldReplayClearHandledForRetry(variables.stat_data,context.current.fingerprint);
                delete variables.__samsaraWorldReplay;
                this.worldReplaySetCycleRecovered(context.current.fingerprint,variables.stat_data);
                if(e.config.autoProgress===true&&e.isEnabled()){e.status='变量已重处理 · 正在自动重新推进本楼';e.render();e.schedule('variable-update',0);}
                else if(e.config.autoProgress!==true){e.status='变量已重处理 · 旧楼缺少恢复快照；自动推进已关闭，请手动推进';e.render();}
                else{e.status='变量已重处理 · 世界推进已关闭，未自动重建';e.render();}
                return false;
            }
            return this.baseHandle?this.baseHandle(variables,before):false;
        }
    }
    registerWorldEngineFeature('replay-persistence',engine=>new WorldReplayPersistenceFeature(engine));
