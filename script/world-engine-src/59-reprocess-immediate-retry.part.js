    // 变量重处理缺少 replay 时，直接使用 VARIABLE_UPDATE_ENDED 传入的 variables 重新推进；不等待 MVU 二次落盘。
    const SamsaraWorldEngineBeforeImmediateReprocessRetry=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeImmediateReprocessRetry {
        worldReplayWaitForIdle() {
            if(!this.busy)return Promise.resolve();
            if(!Array.isArray(this.worldReplayIdleWaiters))this.worldReplayIdleWaiters=[];
            return new Promise(resolve=>this.worldReplayIdleWaiters.push(resolve));
        }
        worldReplayResolveIdleWaiters() {
            const waiters=Array.isArray(this.worldReplayIdleWaiters)?this.worldReplayIdleWaiters.splice(0):[];
            for(const resolve of waiters){try{resolve();}catch(_){}}
        }
        async worldReplayImmediateRetry(context,variables) {
            if(!context?.mvu?.replaceMvuData||!plain(variables?.stat_data))return false;
            if(this.busy){
                this.cancel();
                await this.worldReplayWaitForIdle();
            }
            if(this.disposed||this.config.autoProgress!==true||!this.isEnabled())return false;

            const seed=Object.assign({},copy(context.raw),copy(variables));
            this.worldReplayClearHandledForRetry(seed.stat_data,context.current.fingerprint);
            delete seed.__samsaraWorldReplay;
            this.worldReplayMarkEventInternal();
            const previousRetrying=this.worldReplayImmediateRetrying===true;
            this.worldReplayImmediateRetrying=true;
            try{
                await context.mvu.replaceMvuData(seed,{type:'message',message_id:context.current.id});
            }finally{
                this.worldReplayImmediateRetrying=previousRetrying;
            }

            const result=await this.run({automatic:true});
            if(result!==true)return false;

            let finalRaw;
            try{finalRaw=context.mvu.getMvuData({type:'message',message_id:context.current.id});}catch(_){finalRaw=null;}
            if(plain(finalRaw?.stat_data))variables.stat_data=copy(finalRaw.stat_data);
            if(finalRaw&&Object.prototype.hasOwnProperty.call(finalRaw,'__samsaraWorldReplay'))variables.__samsaraWorldReplay=copy(finalRaw.__samsaraWorldReplay);
            return true;
        }
        async handleWorldReplayVariableEvent(variables,before) {
            if(this.worldReplayImmediateRetrying===true)return false;
            const context=this.worldReplayReprocessContext?.(variables,before);
            if(context){
                const storedReplay=context.raw.__samsaraWorldReplay;
                const validStored=plain(storedReplay)&&String(storedReplay.fingerprint||'')===context.current.fingerprint;
                const legacy=!validStored?this.worldReplayLegacyPackage?.(context,variables):null;
                if(!validStored&&!legacy){
                    this.worldReplayClearHandledForRetry(variables.stat_data,context.current.fingerprint);
                    delete variables.__samsaraWorldReplay;
                    if(this.config.autoProgress===true&&this.isEnabled()){
                        this.status='变量已重处理 · 正在重新推进本楼';
                        this.render();
                        return await this.worldReplayImmediateRetry(context,variables);
                    }
                }
            }
            return await super.handleWorldReplayVariableEvent(variables,before);
        }
        async run(options={}) {
            try{return await super.run(options);}
            finally{this.worldReplayResolveIdleWaiters();}
        }
    };
