    // 恢复包可靠性：世界推进成功后主动持久化 replay，不再依赖 replaceMvuData 是否触发可用的 VARIABLE_UPDATE_ENDED。
    // 对旧楼若 replay 缺失，优先用本次重处理事件的 before/已处理楼层恢复；实在无旧状态时按自动推进开关决定是否立即重建。
    const SamsaraWorldEngineBeforeReplayPersistence=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeReplayPersistence {
        worldReplayReprocessContext(variables,before) {
            if(!plain(variables?.stat_data))return null;
            const current=this.worldReplayCurrentMessage?.();
            if(!current)return null;
            const mvu=this.env.Mvu||this.host.Mvu;
            let raw;
            try{raw=mvu?.getMvuData?.({type:'message',message_id:current.id});}catch(_){return null;}
            // “重新处理变量”会清掉当前楼 stat_data，但 replay 根字段仍可保留；before 也可证明旧楼已成功处理。
            if(!plain(raw)||plain(raw.stat_data))return null;
            const beforeStat=plain(before?.stat_data)?before.stat_data:null;
            const replay=raw.__samsaraWorldReplay;
            const replayMatches=plain(replay)&&String(replay.fingerprint||'')===current.fingerprint;
            const beforeHandled=String(beforeStat?.世界?.[PATH]?.已处理楼层||'');
            if(!replayMatches&&beforeHandled!==current.fingerprint)return null;
            return {current,raw,mvu,beforeStat};
        }
        worldReplaySetCycleRecovered(fingerprint,stat) {
            this.autoProgressCycleKey=this.autoProgressContextKey({fingerprint,stat});
            this.autoProgressHasRun=true;
            this.autoProgressRoundsSinceRun=0;
            this.autoProgressLastSeenFingerprint=fingerprint;
            this.autoProgressDueFingerprint=fingerprint;
        }
        worldReplayClearHandledForRetry(stat,fingerprint) {
            const state=stat?.世界?.[PATH];
            if(!plain(state))return;
            if(!fingerprint||String(state.已处理楼层||'')===String(fingerprint)){
                state.已处理楼层='';
                state.已处理时间='';
            }
        }
        worldReplayLegacyPackage(context,variables) {
            const beforeStat=context?.beforeStat;
            if(!plain(beforeStat)||!plain(variables?.stat_data))return null;
            if(String(beforeStat?.世界?.[PATH]?.已处理楼层||'')!==context.current.fingerprint)return null;
            return this.buildWorldReplayPackage(variables.stat_data,beforeStat,context.current.fingerprint);
        }
        handleWorldReplayVariableEvent(variables,before) {
            const context=this.worldReplayReprocessContext(variables,before);
            if(context){
                let replay=plain(context.raw.__samsaraWorldReplay)&&String(context.raw.__samsaraWorldReplay.fingerprint||'')===context.current.fingerprint
                    ?context.raw.__samsaraWorldReplay:null;
                let legacyRecovered=false;
                if(!replay){
                    replay=this.worldReplayLegacyPackage(context,variables);
                    legacyRecovered=!!replay;
                }
                if(replay&&this.applyWorldReplayPackage(variables.stat_data,replay)){
                    this.worldReplayMarkEventInternal();
                    variables.__samsaraWorldReplay=copy(replay);
                    this.worldReplaySetCycleRecovered(context.current.fingerprint,variables.stat_data);
                    this.status=legacyRecovered?'已从旧楼状态重建并恢复世界推进结果 · 未重新调用 AI':'已恢复本楼世界推进结果 · 未重新调用 AI';
                    this.render();
                    return true;
                }

                // before/已处理楼层已经证明这一楼过去确实成功推进过；缺 replay 时不需要重新计算推进间隔。
                // 清掉失效处理标记，并把这一楼重新标记为 due。自动推进开启时由本分支主动安排补跑，不依赖基础 VARIABLE_UPDATE_ENDED 监听兜底。
                this.worldReplayClearHandledForRetry(variables.stat_data,context.current.fingerprint);
                delete variables.__samsaraWorldReplay;
                this.worldReplaySetCycleRecovered(context.current.fingerprint,variables.stat_data);
                if(this.config.autoProgress===true&&this.isEnabled()){
                    this.status='变量已重处理 · 正在自动重新推进本楼';
                    this.render();
                    this.schedule('variable-update',0);
                }else if(this.config.autoProgress!==true){
                    this.status='变量已重处理 · 旧楼缺少恢复快照；自动推进已关闭，请手动推进';
                    this.render();
                }else{
                    this.status='变量已重处理 · 世界推进已关闭，未自动重建';
                    this.render();
                }
                return false;
            }
            return super.handleWorldReplayVariableEvent(variables,before);
        }
    };
