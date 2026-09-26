    // 变量重处理缺少 replay 时，直接使用 VARIABLE_UPDATE_ENDED 传入的 variables 重新推进；不等待 MVU 二次落盘。
    class WorldImmediateReprocessRetryFeature {
        constructor(engine){
            this.engine=engine;
            this.baseHandle=engine.handleWorldReplayVariableEvent?.bind(engine);
            this.baseRun=engine.run.bind(engine);
        }
        initialize(){
            const e=this.engine;
            for(const name of ['worldReplayWaitForIdle','worldReplayResolveIdleWaiters','worldReplayImmediateRetry'])e[name]=this[name].bind(this);
            e.handleWorldReplayVariableEvent=(variables,before)=>this.handleWorldReplayVariableEvent(variables,before);
            e.run=options=>this.run(options);
        }
        worldReplayWaitForIdle(){
            const e=this.engine;
            if(!e.busy)return Promise.resolve();
            if(!Array.isArray(e.worldReplayIdleWaiters))e.worldReplayIdleWaiters=[];
            return new Promise(resolve=>e.worldReplayIdleWaiters.push(resolve));
        }
        worldReplayResolveIdleWaiters(){
            const e=this.engine,waiters=Array.isArray(e.worldReplayIdleWaiters)?e.worldReplayIdleWaiters.splice(0):[];
            for(const resolve of waiters){try{resolve();}catch(_){}}
        }
        async worldReplayImmediateRetry(context,variables){
            const e=this.engine;
            if(!context?.mvu?.replaceMvuData||!plain(variables?.stat_data))return false;
            if(e.busy){e.cancel();await this.worldReplayWaitForIdle();}
            if(e.disposed||e.config.autoProgress!==true||!e.isEnabled())return false;
            const seed=Object.assign({},copy(context.raw),copy(variables));
            e.worldReplayClearHandledForRetry(seed.stat_data,context.current.fingerprint);
            delete seed.__samsaraWorldReplay;e.worldReplayMarkEventInternal();
            const previousRetrying=e.worldReplayImmediateRetrying===true;e.worldReplayImmediateRetrying=true;
            try{await context.mvu.replaceMvuData(seed,{type:'message',message_id:context.current.id});}
            finally{e.worldReplayImmediateRetrying=previousRetrying;}
            const result=await e.run({automatic:true});if(result!==true)return false;
            let finalRaw;try{finalRaw=context.mvu.getMvuData({type:'message',message_id:context.current.id});}catch(_){finalRaw=null;}
            if(plain(finalRaw?.stat_data))variables.stat_data=copy(finalRaw.stat_data);
            if(finalRaw&&Object.prototype.hasOwnProperty.call(finalRaw,'__samsaraWorldReplay'))variables.__samsaraWorldReplay=copy(finalRaw.__samsaraWorldReplay);
            return true;
        }
        async handleWorldReplayVariableEvent(variables,before){
            const e=this.engine;
            if(e.worldReplayImmediateRetrying===true)return false;
            const context=e.worldReplayReprocessContext?.(variables,before);
            if(context){
                const storedReplay=context.raw.__samsaraWorldReplay;
                const validStored=plain(storedReplay)&&String(storedReplay.fingerprint||'')===context.current.fingerprint;
                const legacy=!validStored?e.worldReplayLegacyPackage?.(context,variables):null;
                if(!validStored&&!legacy){
                    e.worldReplayClearHandledForRetry(variables.stat_data,context.current.fingerprint);delete variables.__samsaraWorldReplay;
                    if(e.config.autoProgress===true&&e.isEnabled()){
                        e.status='变量已重处理 · 正在重新推进本楼';e.render();
                        return await this.worldReplayImmediateRetry(context,variables);
                    }
                }
            }
            return this.baseHandle?await this.baseHandle(variables,before):false;
        }
        async run(options={}){
            try{return await this.baseRun(options);}
            finally{this.worldReplayResolveIdleWaiters();}
        }
    }
    registerWorldEngineFeature('reprocess-immediate-retry',engine=>new WorldImmediateReprocessRetryFeature(engine));
