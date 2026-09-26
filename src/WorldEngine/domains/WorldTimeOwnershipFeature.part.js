    class WorldTimeOwnershipFeature extends WorldRequestFeature {
        async afterBuildRequest(request,base){
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){payload=null;}
            if(payload){
                const needsInitialization=worldTimeUnset(base?.stat?.世界?.时间);
                payload.世界时间维护={
                    当前时间:String(base?.stat?.世界?.时间||''),
                    是否需要初始化:needsInitialization,
                    初始化锚定:needsInitialization?{
                        任务世界:String(base?.stat?.世界?.名称||''),
                        当前阶段:String(base?.stat?.世界?.因果轨道?.当前阶段||''),
                        当前地点:String(base?.stat?.世界?.地点||'')
                    }:undefined
                };
                request.input=JSON.stringify(payload,null,2);
            }
            request.schema=copy(WORLD_RESULT_SCHEMA);
            return request;
        }
        afterVariableEvent(handled,variables,before){
            const engine=this.engine;
            if(handled||engine.committing||!engine.isEnabled()||!plain(variables?.stat_data)||!plain(before?.stat_data))return handled;
            const previous=String(before?.stat_data?.世界?.时间??''),incoming=String(variables?.stat_data?.世界?.时间??'');
            if(previous===incoming)return handled;

            const wasSpace=before?.stat_data?.系统状态?.是否在主神空间===true;
            const isSpace=variables?.stat_data?.系统状态?.是否在主神空间===true;
            if(wasSpace!==isSpace){
                const enteringWorld=wasSpace&&!isSpace,returningToSpace=!wasSpace&&isSpace;
                const mainSpaceTime=/^轮回历\d+年-\d{2}月-\d{2}日-(?:凌晨|黎明|清晨|早晨|上午|中午|午后|下午|傍晚|入夜|晚上|深夜)$/.test(incoming);
                if((enteringWorld&&worldTimeUnset(incoming))||(returningToSpace&&mainSpaceTime))return handled;
            }
            if(!plain(variables.stat_data.世界))variables.stat_data.世界={};
            variables.stat_data.世界.时间=previous;
            return true;
        }
    }
