    const WORLD_ENGINE_FEATURE_FACTORIES=[];
    function registerWorldEngineFeature(name,factory) {
        const key=String(name||'').trim();
        if(!key||typeof factory!=='function')throw new Error('世界推进 Feature 注册无效');
        if(WORLD_ENGINE_FEATURE_FACTORIES.some(item=>item.name===key))throw new Error('世界推进 Feature 重复注册：'+key);
        WORLD_ENGINE_FEATURE_FACTORIES.push({name:key,factory});
    }

    class WorldEngineFeatureRegistry {
        constructor(engine){
            this.engine=engine;
            this.items=new Map();
            for(const item of WORLD_ENGINE_FEATURE_FACTORIES){
                const service=item.factory(engine);
                if(service)this.items.set(item.name,service);
            }
        }
        get(name){return this.items.get(name)||null;}
        describe(){return Array.from(this.items,([name,service])=>({name,className:service?.constructor?.name||''}));}
        initialize(){
            for(const service of this.items.values())service.initialize?.();
            return this;
        }
        bindPanel(){for(const service of this.items.values())service.bindPanel?.();}
        afterRender(){for(const service of this.items.values())service.afterRender?.();}
        dispose(){for(const service of this.items.values())service.dispose?.();}
        async modifyRequest(request,base){
            let current=request;
            for(const service of this.items.values()){
                if(typeof service.modifyRequest!=='function')continue;
                const next=await service.modifyRequest(current,base);
                if(next)current=next;
            }
            return current;
        }
        async afterCatalogue(result){
            let current=result;
            for(const service of this.items.values()){
                if(typeof service.afterCatalogue!=='function')continue;
                const next=await service.afterCatalogue(current);
                if(next)current=next;
            }
            return current;
        }
        async beforeRun(context){
            for(const service of this.items.values())await service.beforeRun?.(context);
        }
        async afterRun(context){
            const services=Array.from(this.items.values()).reverse();
            for(const service of services)await service.afterRun?.(context);
        }
        afterReplayVariableEvent(handled,variables,before){
            let result=handled;
            for(const service of this.items.values()){
                if(typeof service.afterReplayVariableEvent!=='function')continue;
                const next=service.afterReplayVariableEvent(result,variables,before);
                if(next!==undefined)result=next;
            }
            return result;
        }
    }
