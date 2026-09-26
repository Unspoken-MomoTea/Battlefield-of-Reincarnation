    class WorldDueEventService {
        constructor(engine){this.engine=engine;}
        review(stat){return relaxedDueEvents(stat||this.engine.snapshot().stat);}
        decorate(request,base){
            const due=this.review(base?.stat||{});
            request.due=due;
            try{
                const payload=JSON.parse(request.input);
                payload.本轮必须复核的到期事件=due;
                request.input=JSON.stringify(payload,null,2);
            }catch(_){}
            if(request.manifest)request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema);
            return request;
        }
    }
