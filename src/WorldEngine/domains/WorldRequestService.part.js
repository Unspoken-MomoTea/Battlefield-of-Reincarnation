    class WorldRequestService {
        constructor(engine){this.engine=engine;}
        build(base){return this.engine.buildRequest(base||this.engine.snapshot());}
        preview(){return this.engine.preview?.();}
        request(system,input,options){return this.engine.requestAI(system,input,options);}
        retryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan=[]){
            let raw=retryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan);
            let payload;try{payload=JSON.parse(raw);}catch(_){return raw;}
            if(plain(payload.纠错重试)){
                payload.纠错重试.要求=this.engine.services?.prompts?.retryRequirement(acceptedResult,retryPlan)||payload.纠错重试.要求;
            }
            return JSON.stringify(payload,null,2);
        }
    }
