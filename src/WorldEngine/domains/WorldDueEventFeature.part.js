    class WorldDueEventFeature extends WorldRequestFeature {
        constructor(engine,policy=DEFAULT_WORLD_DUE_EVENT_POLICY){super(engine);this.policy=policy||DEFAULT_WORLD_DUE_EVENT_POLICY;}
        async afterBuildRequest(request,base){
            const due=this.policy.review(base?.stat||{});
            request.due=due;
            try{
                const payload=JSON.parse(request.input);
                payload.本轮必须复核的到期事件=due;
                request.input=JSON.stringify(payload,null,2);
            }catch(_){}
            return request;
        }
    }
