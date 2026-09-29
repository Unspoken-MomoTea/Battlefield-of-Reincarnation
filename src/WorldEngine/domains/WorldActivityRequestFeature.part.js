    class WorldActivityRequestFeature extends WorldRequestFeature {
        constructor(engine,policy=DEFAULT_WORLD_ACTIVITY_POLICY){super(engine);this.policy=policy||DEFAULT_WORLD_ACTIVITY_POLICY;}
        async afterBuildRequest(request,base){
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            const requirement=this.policy.requirement(base?.stat||{});
            payload.本轮世界活动交付={
                当前数量:copy(requirement.当前数量),
                初始化缺口:copy(requirement.初始化缺口),
                硬要求:[
                    '异端不能作为本轮唯一变化；至少推进事件、势力地区或普通人物中的一项非异端实质变化。',
                    '若地区为空：建立至少1个与当前地点/阶段相关的地区。',
                    '若没有进行中的非宏观事件：建立至少1个正在发生的当前事件/近期节点。',
                    '只改更新时间/下次检查、重复原值或只新增待发生宏观节点不算实质变化。'
                ],
                软目标:[
                    '若势力为空，优先补充1个当前真正参与局势的真实势力/组织；建立时同名提交 WorldResult.势力 与 WorldResult.势力地区（类型=势力）。若没有可靠资料或势力片段验收失败，不要为了补档案编造组织，也不要影响其它已通过片段。'
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
