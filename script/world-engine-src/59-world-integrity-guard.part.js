    // 世界完整性保护：统一精确时钟，并把因果偏移阈值落实到请求与编译器。
    const WORLD_INTEGRITY_GUARD_RULES=`【因果偏移与时间硬约束】
1. 当前状态的更新时间直接复用当前世界时间（世界.时间）原文，不自行改写成更晚的 HH:mm；已发生事实不得晚于世界.时间。
2. 偏移只记录已经发生、已确认、不可逆且足以改变关键人物命运、重大事件结果、关键势力格局或主线可行性的结果；日常、交易、普通战斗、普通NPC伤亡、无关主线支线和单纯偏离原著不记录。
3. 同一已确认根因及其连锁后果只记一条，按最严重的已实现结果结算；禁止把一条因果链拆成多条累计影响。
4. 预测、风险、可能、潜在或未来尚未发生的后果不产生偏移；稳定下降及其后续世界响应不能反过来成为新的负偏移。
5. 负值锚点：关键人物命运不可逆改写 -3~-12；重大事件结果不可逆改变 -3~-10；关键势力格局或主线可行性实质破坏 -2~-8；异常污染持续扩大 -1~-10。普通变化不记录。
6. 正值只来自真实修复：关键人物/重大事件修复 +3~+10；异常清除 +1~+15；势力格局或主线结构修复 +2~+8。高于100不能来自普通善行、胜利或奖励。
7. 单条总范围仅 -12~-1 或 +1~+15，0 不建记录；同一引发者同轮负向累计不得低于 -12，正向累计不得高于 +15。提交前确认“已发生、命中重大条件、不是已有/本轮同根记录”。
8. 稳定值由后台汇总，模型不得直接修改。`;

    const worldDateKeyBeforeIntegrityGuard=worldDateKey;
    worldDateKey=function(value) {
        const source=String(value||''),base=worldDateKeyBeforeIntegrityGuard(source);
        if(base===null)return null;
        const clock=source.match(/(?:^|[日T\s_-])(\d{1,2}):([0-5]\d)(?::([0-5]\d))?/);
        if(!clock)return base;
        const hour=Number(clock[1]),minute=Number(clock[2]),second=Number(clock[3]||0);
        if(!Number.isInteger(hour)||hour<0||hour>23)return null;
        return Math.floor(base/24)*24+hour+minute/60+second/3600;
    };

    OFFSET_RESULT_SCHEMA.properties.影响程度.minimum=-12;
    OFFSET_RESULT_SCHEMA.properties.影响程度.maximum=15;

    const CAUSAL_CHAIN_HINT=/(?:余波|后续|进一步|继续|继而|因此|由此|连锁|衍生|扩散|扩大|反应|吸引力|同一(?:契约|事件|行为|根因))/;
    const CAUSAL_SPECULATION_HINT=/(?:可能|或许|预计|预期|将会|或将|未来(?:会|可能|将)|潜在|恐怕|有望)/;
    const CAUSAL_RESPONSE_HINT=/(?:稳定值(?:持续)?下降|世界排异(?:反应|升级|增强)?|排异强度)/;
    function validateCausalOffsets(stat,result) {
        const items=Array.isArray(result?.因果?.偏移记录)?result.因果.偏移记录:[];
        if(!items.length)return;
        const existing=stat?.世界?.因果轨道?.偏移记录||{},groups=new Map();
        for(const item of items){
            if(!plain(item)||item.操作==='撤销本轮')continue;
            const isNew=!stableNameIn(existing,item.名称),hasImpact=Object.hasOwn(item,'影响程度');
            if(isNew&&!hasImpact)throw new Error('新增因果偏移必须给出非零影响程度，且单条仅允许 -12~-1 或 +1~+15：'+String(item.名称||''));
            if(!hasImpact)continue;
            const impact=Number(item.影响程度);
            if(!Number.isFinite(impact)||impact<-12||impact>15)throw new Error('因果偏移影响程度超出协议：'+String(item.名称||'')+'='+String(item.影响程度)+'；单条只允许 -12~-1 或 +1~+15');
            if(isNew&&impact===0)throw new Error('零影响不建立因果偏移记录：'+String(item.名称||''));
            if(!isNew||impact===0)continue;
            const text=[item.名称,item.描述].filter(Boolean).join(' ');
            if(CAUSAL_SPECULATION_HINT.test(text))throw new Error('因果偏移不能按预测或风险提前结算：'+String(item.名称||''));
            if(impact<0&&CAUSAL_RESPONSE_HINT.test(text))throw new Error('稳定下降或世界响应不能作为新的负偏移继续累计：'+String(item.名称||''));
            const actor=String(item.引发者||'').trim();
            if(!actor)continue;
            const key=actor.toLowerCase(),group=groups.get(key)||[];
            group.push({impact,text});groups.set(key,group);
        }
        for(const [actor,group] of groups){
            const negative=group.filter(entry=>entry.impact<0),positive=group.filter(entry=>entry.impact>0);
            const negativeTotal=negative.reduce((sum,entry)=>sum+entry.impact,0),positiveTotal=positive.reduce((sum,entry)=>sum+entry.impact,0);
            if(negativeTotal<-12)throw new Error('同一引发者同轮负向因果偏移累计超过 -12：'+actor+'='+negativeTotal+'；同一根因及其连锁后果必须合并');
            if(positiveTotal>15)throw new Error('同一引发者同轮正向因果偏移累计超过 +15：'+actor+'=+'+positiveTotal+'；同一根因及其连锁结果必须合并');
            if(group.length>1&&group.some(entry=>CAUSAL_CHAIN_HINT.test(entry.text)))throw new Error('同一根因的连锁后果必须合并为一条因果偏移：'+actor);
        }
    }

    const compileWorldResultBeforeIntegrityGuard=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=normalizeWorldResult(value);
        validateCausalOffsets(stat,result);
        return compileWorldResultBeforeIntegrityGuard(stat,result);
    };

    const retryPlanBeforeIntegrityGuard=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        const plan=retryPlanBeforeIntegrityGuard(error,rejected).slice();
        const message=[String(error?.message||error||''),...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
        if(/因果偏移|同一根因/.test(message))plan.unshift('因果偏移：只提交已经发生的重大不可逆结果；同一根因与连锁后果合并成一条，预测不提前结算，单条仅 -12~-1 或 +1~+15。');
        if(/时间事实超过当前世界时间/.test(message))plan.unshift('当前事实时间：人物/地区/传播的更新时间直接复用请求中的当前世界时间原文；未来计划放预计结束、下次检查或待发生事件。');
        return Array.from(new Set(plan.filter(Boolean)));
    };

    const SamsaraWorldEngineBeforeIntegrityGuard=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeIntegrityGuard {
        async buildRequest(base) {
            const request=await super.buildRequest(base);
            request.system=String(request.system||'')+'\n\n'+WORLD_INTEGRITY_GUARD_RULES;
            request.manifest=request.manifest||{};
            request.manifest.因果与时间硬约束={启用:true,单条影响范围:'-12~-1 / +1~+15',当前事实时间:'复用世界.时间原文'};
            request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            return request;
        }
    };
