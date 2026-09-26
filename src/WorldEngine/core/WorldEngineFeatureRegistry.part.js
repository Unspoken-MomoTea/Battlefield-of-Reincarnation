    class WorldEngineFeatureRegistry {
        constructor(engine){
            this.engine=engine;
            this.items=new Map();
        }
        register(key,feature){
            if(!key||!feature)throw new Error('世界推进 Feature 注册无效');
            this.items.set(String(key),feature);
            return feature;
        }
        get(key){return this.items.get(String(key))||null;}
        initialize(){
            for(const feature of this.items.values())feature.initialize?.();
            return this;
        }
        bindPanel(){
            for(const feature of this.items.values())feature.bindPanel?.();
        }
        beforeRender(force){
            for(const feature of this.items.values())feature.beforeRender?.(force);
        }
        afterRender(force,result){
            for(const feature of this.items.values())feature.afterRender?.(force,result);
        }
        async afterBuildRequest(request,base){
            let current=request;
            for(const feature of this.items.values()){
                if(typeof feature.afterBuildRequest!=='function')continue;
                current=await feature.afterBuildRequest(current,base)||current;
            }
            return current;
        }
        dispose(){
            for(const feature of this.items.values())feature.dispose?.();
            this.items.clear();
        }
        describe(){
            return Array.from(this.items,([key,feature])=>({key,className:feature.constructor?.name||'UnknownFeature'}));
        }
    }
