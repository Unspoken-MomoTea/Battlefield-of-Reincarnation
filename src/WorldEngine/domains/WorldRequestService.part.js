    class WorldRequestService {
        constructor(engine=null){this.engine=engine;}
        build(base){return this.engine.buildRequest(base||this.engine.snapshot());}
        preview(){return this.engine.preview?.();}
        request(system,input,options){return this.engine.requestAI(system,input,options);}
        retryableModelFailure(error){
            const message=String(error?.message||error||'');
            if(!message)return false;
            if(/^(?:请求已取消|上下文已经切换|推演期间世界时间或副本锚点发生变化|请在主神终端设置|请加载更新后的|禁止写入：)/.test(message))return false;
            if(error?.name==='AbortError')return false;
            return true;
        }
        retryRequirement(acceptedResult,retryPlan=[]){
            const prompts=this.engine?.services?.prompts;
            if(prompts?.retryRequirement)return prompts.retryRequirement(acceptedResult,retryPlan);
            if(acceptedResult)return Array.isArray(retryPlan)&&retryPlan.length?WORLD_PROMPT_RETRY_ACCEPTED_PLAN:WORLD_PROMPT_RETRY_ACCEPTED;
            return WORLD_PROMPT_RETRY_FRESH;
        }
        retryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan=[]){
            let payload;try{payload=JSON.parse(baseInput);}catch(_){payload={原始请求:baseInput};}
            const feedback=retryFeedback(error,error?.rejectedSlices,Array.isArray(retryPlan)?retryPlan:[]);
            const plan=feedback.actions;
            payload.纠错重试={
                当前尝试:attempt+1,
                最大尝试次数:maxAttempts,
                上次拒绝原因:feedback.summary,
                具体问题:feedback.issues.length?feedback.issues:undefined,
                上次模型回复:String(lastReply||'').slice(-12000),
                已接受业务结果:acceptedResult?copy(acceptedResult):undefined,
                补充清单:plan.length?copy(plan):undefined,
                要求:this.retryRequirement(acceptedResult,this.engine?retryPlan:plan)
            };
            if(payload.纠错重试.已接受业务结果===undefined)delete payload.纠错重试.已接受业务结果;
            if(payload.纠错重试.补充清单===undefined)delete payload.纠错重试.补充清单;
            return JSON.stringify(payload,null,2);
        }
    }

    const DEFAULT_WORLD_REQUEST_SERVICE=new WorldRequestService();
    let ACTIVE_WORLD_REQUEST_SERVICE=DEFAULT_WORLD_REQUEST_SERVICE;
    function retryableModelFailure(error){return ACTIVE_WORLD_REQUEST_SERVICE.retryableModelFailure(error);}
    function retryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan=[]){
        return ACTIVE_WORLD_REQUEST_SERVICE.retryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan);
    }

