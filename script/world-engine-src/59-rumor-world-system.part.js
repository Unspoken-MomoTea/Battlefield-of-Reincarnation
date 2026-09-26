    class WorldRumorSystemFeature {
        constructor(engine){this.engine=engine;}
        async modifyRequest(request){
            let value=String(request.system||'');
            if(typeof RUMOR_LIVELINESS_RULES==='string')value=value.replace(RUMOR_LIVELINESS_RULES,'');
            if(typeof RUMOR_THROTTLE_RULES==='string')value=value.replace(RUMOR_THROTTLE_RULES,'');
            request.system=value.trim()+'\n\n'+RUMOR_WORLD_SOURCE_RULES;
            return request;
        }
    }
    registerWorldEngineFeature('rumor-system',engine=>new WorldRumorSystemFeature(engine));
