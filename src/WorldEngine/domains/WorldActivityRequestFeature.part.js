    class WorldActivityRequestFeature extends WorldRequestFeature {
        async afterBuildRequest(request,base){
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            const requirement=worldActivityRequirement(base?.stat||{});
            payload.本轮世界活动交付={
                当前数量:copy(requirement.当前数量),
                初始化缺口:copy(requirement.初始化缺口),
                硬要求:[
                    '异端不能作为本轮唯一变化；至少推进事件、势力地区或普通人物中的一项非异端实质变化。',
                    '若地区为空：建立至少1个与当前地点/阶段相关的地区。',
                    '若势力为空：建立至少1个当前真实相关的势力/组织；同名提交 WorldResult.势力（实力/领地/描述/声望）与 WorldResult.势力地区（类型=势力的动态现场）。',
                    '若没有进行中的非宏观事件：建立至少1个正在发生的当前事件/近期节点。',
                    '只改更新时间/下次检查、重复原值或只新增待发生宏观节点不算实质变化。'
                ]
            };
            request.input=JSON.stringify(payload,null,2);
            request.timeline=Object.assign({},request.timeline,{世界活动要求:requirement});
            request.manifest=Object.assign({},request.manifest,{
                世界活动交付:{当前数量:copy(requirement.当前数量),初始化缺口:copy(requirement.初始化缺口)}
            });
            return request;
        }
    }
