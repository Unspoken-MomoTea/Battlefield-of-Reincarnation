    // 世界活动交付：异端只是世界中的一类人物，不能成为唯一会变化的后台对象。
    const WORLD_ACTIVITY_DELIVERY_RULES=`【世界活动交付 · 非异端世界必须推进】
1. 世界推进不是“异端模拟器”。每轮按：进行中/到期事件 → 势力与地区现场 → 普通热人物 → 传播 → 异端复核 的顺序推演；异端不能替代其它世界活动。
2. 新世界或旧存档缺少世界现场时，本轮必须建立至少1个与当前地点/阶段相关的地区、至少1个真实存在或可由明确设定推出的势力/组织，并建立至少1个正在发生的当前事件/近期节点。势力首次建立时，同名写入 WorldResult.势力（顶层实力/领地/声望档案）与 WorldResult.势力地区（类型=势力的动态现场）；不得只建立未来宏观节点。
3. 每轮世界推进至少提交1项“非异端实质变化”：进行中事件推进/转态、势力或地区状态变化、普通人物自身事务推进三者之一。只改更新时间、下次检查、重复原文或只补未来宏观规划不算实质变化。
4. 变化幅度服从本轮时间容量。时间未推进时只推进即时反应/同步结果；数小时、跨日或数日时再按容量推进更大的行动。不得为了满足本条凭空制造重大事件。
5. 如果某类对象确实没有可变化事项，优先推进另外两类；只有世界本身已经终止/冻结的明确设定才允许没有非异端变化，普通“正文没有提到”不是停摆理由。`;

    function worldActivitySemanticRecord(record,kind) {
        const out=plain(record)?copy(record):{};
        delete out.更新时间;
        delete out.下次检查;
        if(kind==='事件'&&out.分类==='宏观节点'&&out.状态==='待发生')return null;
        return out;
    }
    function worldActivityMap(records,kind,excludeNames=new Set()) {
        const out={};
        for(const [name,record] of Object.entries(records||{})){
            if(excludeNames.has(nameKey(name)))continue;
            const semantic=worldActivitySemanticRecord(record,kind);
            if(semantic!==null)out[nameKey(name)]=semantic;
        }
        return out;
    }
    function worldActivityCounts(stat) {
        const backend=stat?.世界?.[PATH]||{},areas=backend.势力地区||{},events=backend.事件||{},people=backend.人物||{};
        const alienKeys=new Set(Object.keys(stat?.世界?.异端雷达?.名单||{}).map(nameKey));
        return {
            地区数:Object.values(areas).filter(record=>plain(record)&&String(record.类型||'地区')!=='势力').length,
            动态势力数:Object.values(areas).filter(record=>plain(record)&&String(record.类型||'地区')==='势力').length,
            顶层势力数:Object.keys(stat?.世界?.势力||{}).length,
            进行中世界事件数:Object.values(events).filter(record=>plain(record)&&record.状态==='进行中'&&record.分类!=='宏观节点').length,
            普通人物数:Object.entries(people).filter(([name,record])=>plain(record)&&!alienKeys.has(nameKey(name))).length
        };
    }
    function worldActivityRequirement(stat) {
        const backend=stat?.世界?.[PATH]||{},counts=worldActivityCounts(stat);
        const alienKeys=new Set(Object.keys(stat?.世界?.异端雷达?.名单||{}).map(nameKey));
        return {
            世界:String(stat?.世界?.名称||''),
            当前时间:String(stat?.世界?.时间||''),
            当前地点:String(stat?.世界?.地点||''),
            当前数量:counts,
            初始化缺口:{
                地区:counts.地区数<1,
                势力:counts.动态势力数<1||counts.顶层势力数<1,
                当前事件:counts.进行中世界事件数<1
            },
            必须非异端实质变化:true,
            基线:{
                事件:worldActivityMap(backend.事件,'事件'),
                势力地区:worldActivityMap(backend.势力地区,'势力地区'),
                普通人物:worldActivityMap(backend.人物,'人物',alienKeys),
                势力:worldActivityMap(stat?.世界?.势力||{},'势力')
            }
        };
    }
    function worldActivityChanged(next,requirement) {
        const backend=next?.世界?.[PATH]||{},alienKeys=new Set(Object.keys(next?.世界?.异端雷达?.名单||{}).map(nameKey));
        const after={
            事件:worldActivityMap(backend.事件,'事件'),
            势力地区:worldActivityMap(backend.势力地区,'势力地区'),
            普通人物:worldActivityMap(backend.人物,'人物',alienKeys),
            势力:worldActivityMap(next?.世界?.势力||{},'势力')
        },changed=[];
        for(const category of Object.keys(after)){
            const before=requirement?.基线?.[category]||{},current=after[category]||{};
            const names=new Set([...Object.keys(before),...Object.keys(current)]);
            for(const name of names)if(!same(before[name],current[name])){changed.push(category+'/'+name);break;}
        }
        return changed;
    }
    function ensureWorldActivityDelivery(next,requirement) {
        if(!requirement||next?.系统状态?.是否在主神空间)return [];
        const counts=worldActivityCounts(next),issues=[];
        if(requirement.初始化缺口?.地区&&counts.地区数<1)issues.push('缺少地区现场：至少建立1个与当前地点/阶段相关的地区');
        if(requirement.初始化缺口?.势力&&(counts.动态势力数<1||counts.顶层势力数<1))issues.push('缺少势力档案：至少建立1个真实相关势力，并同名写入 WorldResult.势力 与 WorldResult.势力地区（类型=势力）');
        if(requirement.初始化缺口?.当前事件&&counts.进行中世界事件数<1)issues.push('缺少正在发生的世界事件：至少建立1个进行中的当前事件/近期节点，未来宏观节点不能替代');
        const changed=worldActivityChanged(next,requirement);
        if(requirement.必须非异端实质变化&&!changed.length)issues.push('本轮只有异端/维护/未来规划，没有任何非异端世界侧实质变化；必须推进事件、势力地区、顶层势力或普通人物至少一项');
        if(issues.length)throw new Error('世界活动不足：'+issues.join('；'));
        return changed;
    }
    function worldActivityRepairRequired(stat) {
        const requirement=worldActivityRequirement(stat),counts=requirement.当前数量;
        return counts.地区数<1||counts.动态势力数<1||counts.顶层势力数<1||counts.进行中世界事件数<1;
    }

    const ensureMacroBackboneBeforeWorldActivityDelivery=ensureMacroBackbone;
    ensureMacroBackbone=function(next,timeline,required=true) {
        ensureMacroBackboneBeforeWorldActivityDelivery(next,timeline,required);
        ensureWorldActivityDelivery(next,timeline?.世界活动要求);
    };

    const retryPlanForFailureBeforeWorldActivityDelivery=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        const plan=retryPlanForFailureBeforeWorldActivityDelivery(error,rejected),message=String(error?.message||error||'');
        if(/世界活动不足：/.test(message)){
            plan.unshift(
                '世界活动：先推进非异端世界，再复核异端。至少提交一项进行中事件、势力/地区或普通人物的实质变化；只改更新时间、复述原值或新增未来宏观节点不算。',
                '世界现场：若势力地区为空，建立与当前地点/阶段直接相关的地区；若势力为空，选一个当前真正参与局势的真实势力/组织，同名提交 WorldResult.势力 与 WorldResult.势力地区(类型=势力)，不要编造与资料无关的组织。',
                '当前现实：若没有进行中的当前事件/近期节点，从当前阶段与最新正文提炼一个“已经正在发生”的现实局势；不要把未来宏观节点提前结算。'
            );
        }
        return Array.from(new Set(plan.filter(Boolean)));
    };

    class WorldActivityDeliveryFeature {
        constructor(engine){this.engine=engine;}
        async modifyRequest(request,base) {
            const payload=JSON.parse(request.input),requirement=worldActivityRequirement(base.stat);
            payload.本轮世界活动交付={
                当前数量:copy(requirement.当前数量),
                初始化缺口:copy(requirement.初始化缺口),
                硬要求:String(this.engine.services?.prompts?.get?.('worldActivityPayloadInstruction')||PROMPT_DEFAULT_WORLD_ACTIVITY_PAYLOAD).split(/\n+/).map(x=>x.trim()).filter(Boolean)
            };
            request.input=JSON.stringify(payload,null,2);
            request.system=String(request.system||'')+'\n\n'+WORLD_ACTIVITY_DELIVERY_RULES;
            request.timeline=Object.assign({},request.timeline,{世界活动要求:requirement});
            request.manifest=Object.assign({},request.manifest,{世界活动交付:{当前数量:copy(requirement.当前数量),初始化缺口:copy(requirement.初始化缺口)}});
            request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema);
            return request;
        }
    }
    registerWorldEngineFeature('world-activity-delivery',engine=>new WorldActivityDeliveryFeature(engine));
