    class WorldDueEventFeature extends WorldRequestFeature {
        async afterBuildRequest(request,base){
            const due=relaxedDueEvents(base?.stat||{});
            request.due=due;
            try{
                const payload=JSON.parse(request.input);
                payload.本轮必须复核的到期事件=due;
                request.input=JSON.stringify(payload,null,2);
            }catch(_){}
            return request;
        }
    }
