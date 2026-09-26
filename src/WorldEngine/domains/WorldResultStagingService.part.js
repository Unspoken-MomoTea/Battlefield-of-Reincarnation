    class WorldResultStagingService {
        constructor(normalizer,materializer){
            this.normalizer=normalizer||DEFAULT_WORLD_RESULT_NORMALIZER;
            this.materializer=materializer||DEFAULT_WORLD_RESULT_MATERIALIZER;
        }

        // Transitional rule: normalization/merge/fragment and retry-plan calls intentionally use the
        // global compatibility seams because legacy features still decorate them after this service loads.

        worldResultFragments(value) {
            const result=normalizeWorldResult(value),fragments=[];
            const push=(label,body)=>fragments.push({label,result:Object.assign({摘要:''},body)});
            for(const [key,value] of Object.entries(result.货币||{}))push('货币/'+key,{货币:{[key]:copy(value)}});
            for(const [key,value] of Object.entries(result.历法||{}))push('历法/'+key,{历法:{[key]:copy(value)}});
            for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','资产','异端']){
                for(const item of result[key]||[])push(key+'/'+item.名称,{[key]:[copy(item)]});
            }
            if(Object.hasOwn(result.因果||{},'当前阶段'))push('因果/当前阶段',{因果:{当前阶段:result.因果.当前阶段}});
            if(Array.isArray(result.因果?.宏观顺序)&&result.因果.宏观顺序.length)push('因果/宏观顺序',{因果:{宏观顺序:copy(result.因果.宏观顺序)}});
            for(const item of result.因果?.偏移记录||[])push('因果/偏移记录/'+item.名称,{因果:{偏移记录:[copy(item)]}});
            // 容量约束针对最终分类；新增与移除必须一起验收，不能拆散换新操作。
            for(const key of WORLD_RESULT_RUMORS)if(result.传闻?.[key]?.length)push('传闻/'+key,{传闻:{[key]:copy(result.传闻[key])}});
            for(const item of result.关系||[])push('关系/'+item.名称,{关系:[copy(item)]});
            return {摘要:result.摘要,fragments};
        }

        shortSchemaValue(value) {
            if(value===undefined)return 'undefined';
            let raw;try{raw=JSON.stringify(value);}catch(_){raw=String(value);}
            if(raw===undefined)raw=String(value);
            return raw.length>140?raw.slice(0,137)+'…':raw;
        }

        firstSchemaDifference(before,after,parts) {
            if(same(before,after))return null;
            if(plain(before)&&plain(after)){
                const keys=Array.from(new Set([...Object.keys(before),...Object.keys(after)]));
                for(const key of keys){
                    const diff=this.firstSchemaDifference(before[key],after[key],parts.concat(key));
                    if(diff)return diff;
                }
            }
            if(Array.isArray(before)&&Array.isArray(after)&&before.length===after.length){
                for(let i=0;i<before.length;i++){
                    const diff=this.firstSchemaDifference(before[i],after[i],parts.concat(String(i)));
                    if(diff)return diff;
                }
            }
            return {parts,before,after};
        }

        schemaMismatchError(beforeState,afterState,patchPath) {
            const parts=tokens(patchPath),before=get(beforeState,parts),after=get(afterState,parts);
            const diff=this.firstSchemaDifference(before,after,parts)||{parts,before,after};
            return new Error('字段未通过完整 Schema 校验：'+pointer(diff.parts)+'（'+shortSchemaValue(diff.before)+' → '+shortSchemaValue(diff.after)+'）');
        }

        stage(stat,accepted,incoming,validate) {
            const split=worldResultFragments(incoming);
            let staged=accepted?mergeWorldResults(accepted,{摘要:split.摘要}):normalizeWorldResult({摘要:split.摘要});
            let pending=split.fragments.map(unit=>Object.assign({},unit,{error:null})),progress=true;
            while(pending.length&&progress){
                progress=false;
                const nextPending=[];
                for(const unit of pending){
                    const candidate=mergeWorldResults(staged,unit.result);
                    try{
                        const compiled=compileWorldResult(stat,candidate);
                        const built=this.materializer.materializeWorldUpdate(stat,[],compiled.patches);
                        if(typeof validate==='function'){
                            const checked=validate(built.next);
                            for(const patch of compiled.patches){
                                if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(built.next,tokens(patch.path))))throw this.schemaMismatchError(built.next,checked,patch.path);
                            }
                        }
                        staged=candidate;
                        progress=true;
                    }catch(error){
                        unit.error=error;
                        nextPending.push(unit);
                    }
                }
                pending=nextPending;
            }
            return {
                accepted:staged,
                rejected:pending.map(unit=>({片段:unit.label,原因:String(unit.error?.message||unit.error||'业务片段未通过校验')}))
            };
        }
        // 首次请求与纠错共用同一份交付标准，避免模型失败后才知道宏观骨架的硬要求。

        macroBackbonePlan(current,active,future) {
            const missing=Math.max(0,3-current);
            return [
                '宏观骨架：当前可推进宏观节点'+current+'个（进行中'+active+'、待发生'+future+'），还需补充至少'+missing+'个真正的宏观节点；已确认正在发生的阶段转折可记进行中，其余新增节点记待发生。会合、撤离、赶路、局部争夺/突破等近期节点不计入宏观骨架，不要反复把它们改标为宏观节点。',
                '事件交付：在 WorldResult.事件 中实际建立节点，分类=宏观节点；描述说明篇章、地区整体局势、战争、势力格局或关键人物命运的一个阶段转折，不能只在摘要或因果轨道里列名字。已有合格节点沿用原名，只提交缺失或变化字段。',
                '宏观排期：每个新增节点必须给出明确时间锚点；沿用明确资料的日期或时间精度，精确日期未知时使用可理解的相对/因果时间，不写近期/稍后/未来/待定/未知。条件按需填写。前因只能引用已存在，或本轮同时提交且成功建立的事件名称；无明确前因使用 []，不得用当前阶段或自然语言原因代替事件名。',
                '因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序；只使用最终3~5个仍可推进且 分类=宏观节点 的不同事件名称，不要写当前阶段、当前事件或近期节点。'
            ];
        }

        retryPlanForFailure(error,rejected=[]) {
            const plan=[];
            for(const item of rejected||[])plan.push(item.片段+'：'+item.原因);
            const message=String(error?.message||error||'');
            let match=message.match(/宏观事件不足：需要至少3个可推进宏观节点（进行中\+待发生），当前仅(\d+)个（进行中(\d+)个，待发生(\d+)个）/);
            if(match){
                const current=Math.max(0,Number(match[1])||0),active=Math.max(0,Number(match[2])||0),future=Math.max(0,Number(match[3])||0);
                plan.push(...this.macroBackbonePlan(current,active,future));
            }else if(/因果轨道未形成有效宏观投影/.test(message)){
                plan.push('因果轨道：不要重写已接受事件，只补写 因果.宏观顺序；长度必须3~5，且每个名称都必须对应已建立且未取消的宏观节点。');
            }else if((match=message.match(/到期事件未处理：([^。]+)/))){
                plan.push('到期事件/'+match[1]+'：本轮必须明确启动该事件，或更新本轮复核日期、阻碍条件与下次检查。');
            }else if((match=message.match(/事件时间锚点缺失或过于模糊：([^；]+)/))){
                plan.push('事件/'+match[1]+'：补写明确时间锚点；优先具体世界日期/时段，精确日期未知时写相对或因果时间，禁止空值和“近期/稍后/未来/待定/未知”。');
            }else if((match=message.match(/事件时间锚点仍未补全：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push('事件/'+name+'：补写明确时间锚点；优先具体世界日期/时段，精确日期未知时写相对或因果时间，禁止空值和“近期/稍后/未来/待定/未知”。');
            }else if((match=message.match(/超期活动事件仍未复核：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push('事件/'+name+'：该局部活动已远超正常持续窗口。若实际早已结束则改为已完成并补结果；若失效则已取消；只有确实仍持续时才保留进行中，并把更新时间写为当前世界时间、更新当前描述并填写下次检查。');
            }else if((match=message.match(/时间越界记录仍未修复：([^；]+)/))){
                plan.push('时间一致性：修复这些已经发生的记录，任何已完成/进行中事件、人物更新时间、地区已发生变化、历史与传播都不得晚于当前世界时间：'+match[1]);
            }else if((match=message.match(/异端活动未复核：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push('异端活动/'+name+'：仅对本轮触发复核的该活跃异端补写地点、目标、行动；人物更新时间由程序使用世界时间统一记录；若本轮已确认死亡，则只更新异端状态=死亡，不再提交人物活动。');
            }else if((match=message.match(/NPC构筑审计未推进：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push('NPC构筑审计/'+name+'：只在 WorldResult.关系 中补齐该既有NPC至少一个列出的构筑缺口；优先补职业/血统/装备/技能/状态/形态或缺失档案字段，不得新建NPC、改HP_MAX/EP_MAX或输出真属性/最终属性。');
            }else if(message&&!rejected.length){
                plan.push('整体校验：'+message);
            }
            return Array.from(new Set(plan.filter(Boolean)));
        }
        // UI 和模型请求共用去重视图；原始分片仍保留在日志，未知错误不截断。

        retryFeedback(error,rejected=[],plans=[]) {
            const message=String(error?.message||error||'');
            const summary=rejected?.length?message.split('\n\n具体原因\n')[0]:message;
            const compactReason=value=>{
                const reason=String(value||'');
                return /^事件前因(?:不存在|非法自引用)：/.test(reason)?reason.split('；')[0]:reason;
            };
            const rawIssues=(rejected||[]).map(item=>String(item.片段||'')+'：'+String(item.原因||''));
            const issues=Array.from(new Set((rejected||[]).map(item=>{
                const reason=compactReason(item.原因);
                return /^事件前因(?:不存在|非法自引用)：/.test(reason)?reason:String(item.片段||'')+'：'+reason;
            })));
            const redundant=new Set([...rawIssues,...issues,summary,'整体校验：'+summary,'整体校验：'+message]);
            const actions=Array.from(new Set((plans||[]).filter(Boolean).map(String))).filter(line=>!redundant.has(line));
            return {summary,issues,actions};
        }

        makeRetryFailure(rejected,globalError) {
            const reasons=[];
            if(rejected?.length)reasons.push('部分业务片段未通过（'+rejected.length+'项）');
            if(globalError)reasons.push(String(globalError.message||globalError));
            const error=new Error(reasons.join('；')||'WorldResult 未通过业务校验');
            error.retryPlan=retryPlanForFailure(globalError,rejected);
            error.rejectedSlices=copy(rejected||[]);
            return error;
        }
    }
    const DEFAULT_WORLD_RESULT_STAGING=new WorldResultStagingService(DEFAULT_WORLD_RESULT_NORMALIZER,DEFAULT_WORLD_RESULT_MATERIALIZER);
    let ACTIVE_WORLD_RESULT_STAGING=DEFAULT_WORLD_RESULT_STAGING;
    function worldResultFragments(value){return ACTIVE_WORLD_RESULT_STAGING.worldResultFragments(value);}
    function stageWorldResult(stat,accepted,incoming,validate){return ACTIVE_WORLD_RESULT_STAGING.stage(stat,accepted,incoming,validate);}
    function macroBackbonePlan(current,active,future){return ACTIVE_WORLD_RESULT_STAGING.macroBackbonePlan(current,active,future);}
    function retryPlanForFailure(error,rejected=[]){return ACTIVE_WORLD_RESULT_STAGING.retryPlanForFailure(error,rejected);}
    function retryFeedback(error,rejected=[],plans=[]){return ACTIVE_WORLD_RESULT_STAGING.retryFeedback(error,rejected,plans);}
    function makeRetryFailure(rejected,globalError){return ACTIVE_WORLD_RESULT_STAGING.makeRetryFailure(rejected,globalError);}
