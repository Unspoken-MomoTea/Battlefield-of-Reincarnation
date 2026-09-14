    const SamsaraWorldEngineBeforeRumorWorldSystem=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeRumorWorldSystem{
        async buildRequest(base){
            const request=await super.buildRequest(base);
            let text=String(request.system||'');
            if(typeof RUMOR_LIVELINESS_RULES==='string')text=text.replace(RUMOR_LIVELINESS_RULES,'');
            if(typeof RUMOR_THROTTLE_RULES==='string')text=text.replace(RUMOR_THROTTLE_RULES,'');
            request.system=text.trim()+'\n\n'+RUMOR_WORLD_SOURCE_RULES;
            return request;
        }
    };
