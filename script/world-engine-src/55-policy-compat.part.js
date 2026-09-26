    // 可选策略层：NPC 构筑审计默认关闭；同时吸收主变量 Schema 的派生缓存，并提供可执行的事件纠错信息。
    let NPC_BUILD_AUDIT_FEATURE_ENABLED=false;
    const npcBuildAuditBeforeFeatureSwitch=npcBuildAudit;
    npcBuildAudit=function(stat,limit=NPC_BUILD_AUDIT_LIMIT) {
        if(!NPC_BUILD_AUDIT_FEATURE_ENABLED)return [];
        return npcBuildAuditBeforeFeatureSwitch(stat,limit);
    };

    const validateStateBeforeActionableEventRefs=validateState;
    validateState=function(stat) {
        const events=stat?.世界?.[PATH]?.事件||{};
        if(plain(events)){
            for(const [name,event] of Object.entries(events)){
                const parents=Array.isArray(event?.前因)?event.前因.filter(Boolean):[];
                if(parents.includes(name))throw new Error('事件前因非法自引用：'+name+'；前因不能引用事件自身，无明确前因请使用 []');
                const missing=parents.filter(id=>!Object.hasOwn(events,id));
                if(missing.length)throw new Error('事件前因不存在：'+name+' <- '+missing.join('、')+'；前因只能引用已经存在，或本轮同时提交且成功建立的事件名称；当前阶段/自然语言原因不能作为前因，无明确前因请使用 []');
            }
        }
        return validateStateBeforeActionableEventRefs(stat);
    };

    const retryPlanBeforeActionableEventRefs=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        const messages=[String(error?.message||error||''),...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
        const plan=retryPlanBeforeActionableEventRefs(error,rejected).map(line=>String(line)
            .replace('且每个名称都必须对应已建立且未取消的宏观节点。','且每个名称都必须对应已建立且未取消的宏观节点；不要写当前阶段、当前事件或近期节点。'));
        if(/事件前因(?:不存在|非法自引用)/.test(messages))plan.push('事件前因：先修复链首缺失或自引用，再重新提交受影响的后继节点。前因数组只放事件名称，且须已存在或同轮成功建立；当前阶段/自然语言原因不算事件，无明确前因写 []。不得为消除报错凭空补造事件。');
        if(/字段未通过完整 Schema 校验/.test(messages))plan.push('Schema纠错：只修报错路径中的业务字段；真属性/最终属性/强化属于后台派生缓存，模型不得补写，这类派生差异由程序吸收。');
        return Array.from(new Set(plan.filter(Boolean)));
    };

    const makeRetryFailureBeforeConcreteReasons=makeRetryFailure;
    makeRetryFailure=function(rejected,globalError) {
        const error=makeRetryFailureBeforeConcreteReasons(rejected,globalError);
        const feedback=retryFeedback(error,rejected,error.retryPlan);
        error.retryPlan=feedback.actions;
        if(feedback.issues.length)error.message=feedback.summary+'\n\n具体原因\n'+feedback.issues.join('\n');
        return error;
    };

    // NPC 构筑审计本身已经计算了精确缺口；这里仅增强失败反馈，不改变原有通过/驳回判定。
    const ensureNpcBuildAuditProgressBeforeConcreteFeedback=ensureNpcBuildAuditProgress;
    ensureNpcBuildAuditProgress=function(next,required=[],acceptedResult) {
        try{return ensureNpcBuildAuditProgressBeforeConcreteFeedback(next,required,acceptedResult);}
        catch(error){
            if(!/NPC构筑审计未推进/.test(String(error?.message||error||'')))throw error;
            const proposals=Array.isArray(acceptedResult?.关系)?acceptedResult.关系:[];
            const details=[];
            for(const before of required||[]){
                const target=stableNameIn(next?.关系列表||{},before.名称);
                if(!target)continue;
                const after=npcBuildAssessment(next,target,next.关系列表[target]);
                if(!after)continue;
                const proposal=proposals.find(item=>nameKey(item?.名称)===nameKey(before.名称));
                const touched=proposal&&(before.建议字段||[]).some(field=>Object.hasOwn(proposal,field));
                if(touched&&after.缺口.length<before.缺口.length)continue;
                const submitted=proposal?Object.keys(proposal).filter(field=>!['名称','操作'].includes(field)):[];
                const unresolved=(after.缺口||[]).length?after.缺口:before.缺口||[];
                const suggested=(after.建议字段||before.建议字段||[]).filter(Boolean);
                details.push(
                    before.名称+'：未解决缺口：'+(unresolved.length?unresolved.join('、'):'未识别')
                    +'；建议修复字段：'+(suggested.length?suggested.join('、'):'无')
                    +'；本轮实际提交：'+(submitted.length?submitted.join('、'):'无')
                );
            }
            if(!details.length)throw error;
            throw new Error('NPC构筑审计未推进：\n'+details.map(item=>' - '+item).join('\n')+'\n修复要求：每个列出的审计对象本轮至少补齐一个真实缺口；禁止只改好感、HP或无关字段。');
        }
    };

    const WORLD_STATE_DERIVED_SCHEMA_KEYS=new Set(['真属性','最终属性','强化']);
    function syncWorldStateDerivedSchemaFields(target,checked) {
        if(Array.isArray(target)&&Array.isArray(checked)){
            const count=Math.min(target.length,checked.length);
            for(let i=0;i<count;i++)syncWorldStateDerivedSchemaFields(target[i],checked[i]);
            return;
        }
        if(!plain(target)||!plain(checked))return;
        for(const key of WORLD_STATE_DERIVED_SCHEMA_KEYS){
            if(Object.hasOwn(checked,key))target[key]=checked[key]===undefined?undefined:copy(checked[key]);
            else if(Object.hasOwn(target,key))delete target[key];
        }
        for(const key of Object.keys(checked)){
            if(WORLD_STATE_DERIVED_SCHEMA_KEYS.has(key)||!Object.hasOwn(target,key))continue;
            syncWorldStateDerivedSchemaFields(target[key],checked[key]);
        }
    }
    function alignWorldStateSchemaOrder(checked,target) {
        if(Array.isArray(checked))return checked.map((value,index)=>alignWorldStateSchemaOrder(value,Array.isArray(target)?target[index]:undefined));
        if(plain(checked)&&plain(target)){
            const out={};
            for(const key of Object.keys(target))if(Object.hasOwn(checked,key))out[key]=alignWorldStateSchemaOrder(checked[key],target[key]);
            for(const key of Object.keys(checked))if(!Object.hasOwn(out,key))out[key]=alignWorldStateSchemaOrder(checked[key],target[key]);
            return out;
        }
        return checked;
    }

    // NPC 审计开关、资料同步与 UI 由 WorldNpcAuditPolicy 处理。\n