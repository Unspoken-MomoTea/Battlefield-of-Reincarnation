    const CURRENCY_FIELDS={体系:'',购买力基准:'',经济波动:''};
    const CALENDAR_FIELDS={名称:'',月份天数:[],闰年规则:''};
    const QUALITY_RANKS=['F','E','D','C','B','A','S','SS','SSS'];
    const RUMOR_CREDIBILITY=['酒话','可疑','或许可信'];
    const INTEL_RATINGS=[...QUALITY_RANKS,'日常','战略'];
    const EXISTING = {
        势力: {实力:'F',领地:'',描述:'',声望:0}, 探索:{风险:'F',探索度:0,描述:'',隐藏真相:''},
        偏移记录:{描述:'',引发者:'',影响程度:0},
        街头巷议:{来源:'',内容:'',可信度:''}, 情报交易:{卖家:'',情报评级:'',摘要:'',要价:'',真实内幕:''},
        布告与檄文:{发布者:'',内容:'',张贴位置:''},
        名单:{来源:'',经历:'',阵营:'',职业:'',层级:'',状态:''}
    };
    const RELATION_RANKS=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
    const RELATION_QUALITIES=['F','E','D','C','B','A','S','SS','SSS'];
    const RELATION_SYNC_FIELDS={
        在场:false,种族:'',身份:[],职业:{},层级:'Ⅰ',HP:0,THP:0,EP:0,
        状态:{},血统:{},装备:{},技能:{},形态库:{},当前形态:{},
        性格:'',喜爱:'',外貌:'',着装:'',是否队友:false,好感度:0,态度:'',背景故事:''
    };
    const RELATION_SYNC_KEYS=new Set(Object.keys(RELATION_SYNC_FIELDS));
    const RELATION_COMPONENT_FIELDS=new Set(['职业','状态','血统','装备','技能','形态库']);
    // 只有会永久改变角色战斗构筑的字段要求进入审计名单；状态/当前形态及档案文字仍可因真实剧情变化正常同步。
    const RELATION_AUDIT_ONLY_FIELDS=new Set(['职业','血统','装备','技能','形态库']);
    const RELATION_ATTR_KEYS=['力量','敏捷','体质','精神','魅力','ATK','DEF','MATK','MDEF','AP'];
    const RELATION_ATTR5=['力量','敏捷','体质','精神','魅力'];
    const NPC_BUILD_AUDIT_LIMIT=4;
    const WORLD_RESULT_LISTS=['事件','人物','势力地区','历史','传播','势力','探索','资产','异端','关系'];
    const WORLD_RESULT_RUMORS=['街头巷议','情报交易','布告与檄文'];
    const RESULT_OPERATIONS=new Set(['更新','移除','撤销本轮']);
    const WORLD_ASSET_TYPES=['固定地产','大型载具','要塞'];
    const WORLD_ASSET_TYPE_SET=new Set(WORLD_ASSET_TYPES);
    const ITEMLIKE_ASSET_NAME=/(?:纹章|免疫|抗性|初解|技能|能力|药剂?|药水|圣水|解药|血清|试剂|瓶|钥匙|摇把|手柄|材料|矿石|零件|部件|残骸|卷轴|食物|口粮|弹药|消耗品|道具|护符|符文|芯片|样本)$/i;
    function worldResultFragments(value) {
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
    function shortSchemaValue(value) {
        if(value===undefined)return 'undefined';
        let raw;try{raw=JSON.stringify(value);}catch(_){raw=String(value);}
        if(raw===undefined)raw=String(value);
        return raw.length>140?raw.slice(0,137)+'…':raw;
    }
    function firstSchemaDifference(before,after,parts) {
        if(same(before,after))return null;
        if(plain(before)&&plain(after)){
            const keys=Array.from(new Set([...Object.keys(before),...Object.keys(after)]));
            for(const key of keys){
                const diff=firstSchemaDifference(before[key],after[key],parts.concat(key));
                if(diff)return diff;
            }
        }
        if(Array.isArray(before)&&Array.isArray(after)&&before.length===after.length){
            for(let i=0;i<before.length;i++){
                const diff=firstSchemaDifference(before[i],after[i],parts.concat(String(i)));
                if(diff)return diff;
            }
        }
        return {parts,before,after};
    }
    function schemaMismatchError(beforeState,afterState,patchPath) {
        const parts=tokens(patchPath),before=get(beforeState,parts),after=get(afterState,parts);
        const diff=firstSchemaDifference(before,after,parts)||{parts,before,after};
        return new Error('字段未通过完整 Schema 校验：'+pointer(diff.parts)+'（'+shortSchemaValue(diff.before)+' → '+shortSchemaValue(diff.after)+'）');
    }
    function stageWorldResult(stat,accepted,incoming,validate) {
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
                    const built=materializeWorldUpdate(stat,[],compiled.patches);
                    if(typeof validate==='function'){
                        const checked=validate(built.next);
                        for(const patch of compiled.patches){
                            if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(built.next,tokens(patch.path))))throw schemaMismatchError(built.next,checked,patch.path);
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
    function macroBackbonePlan(current,active,future) {
        const missing=Math.max(0,3-current);
        return [
            '宏观骨架：当前可推进宏观节点'+current+'个（进行中'+active+'、待发生'+future+'），还需补充至少'+missing+'个真正的宏观节点；已确认正在发生的阶段转折可记进行中，其余新增节点记待发生。会合、撤离、赶路、局部争夺/突破等近期节点不计入宏观骨架，不要反复把它们改标为宏观节点。',
            '事件交付：在 WorldResult.事件 中实际建立节点，分类=宏观节点；描述说明篇章、地区整体局势、战争、势力格局或关键人物命运的一个阶段转折，不能只在摘要或因果轨道里列名字。已有合格节点沿用原名，只提交缺失或变化字段。',
            '宏观排期：每个新增节点必须给出明确时间锚点；沿用明确资料的日期或时间精度，精确日期未知时使用可理解的相对/因果时间，不写近期/稍后/未来/待定/未知。条件按需填写。前因只能引用已存在，或本轮同时提交且成功建立的事件名称；无明确前因使用 []，不得用当前阶段或自然语言原因代替事件名。',
            '因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序；只使用最终3~5个仍可推进且 分类=宏观节点 的不同事件名称，不要写当前阶段、当前事件或近期节点。'
        ];
    }
    function retryPlanForFailure(error,rejected=[]) {
        const plan=[];
        for(const item of rejected||[])plan.push(item.片段+'：'+item.原因);
        const message=String(error?.message||error||'');
        let match=message.match(/宏观事件不足：需要至少3个可推进宏观节点（进行中\+待发生），当前仅(\d+)个（进行中(\d+)个，待发生(\d+)个）/);
        if(match){
            const current=Math.max(0,Number(match[1])||0),active=Math.max(0,Number(match[2])||0),future=Math.max(0,Number(match[3])||0);
            plan.push(...macroBackbonePlan(current,active,future));
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
            for(const name of match[1].split('、').filter(Boolean))plan.push('异端活动/'+name+'：在 WorldResult.人物 中补写该活跃异端本轮的地点、目标、行动，并把更新时间精确写为当前世界时间；若本轮已确认死亡，则只更新异端状态=死亡，不再提交人物活动。');
        }else if((match=message.match(/NPC构筑审计未推进：([^；]+)/))){
            for(const name of match[1].split('、').filter(Boolean))plan.push('NPC构筑审计/'+name+'：只在 WorldResult.关系 中补齐该既有NPC至少一个列出的构筑缺口；优先补职业/血统/装备/技能/状态/形态或缺失档案字段，不得新建NPC、改HP_MAX/EP_MAX或输出真属性/最终属性。');
        }else if(message&&!rejected.length){
            plan.push('整体校验：'+message);
        }
        return Array.from(new Set(plan.filter(Boolean)));
    }
    // UI 和模型请求共用去重视图；原始分片仍保留在日志，未知错误不截断。
    function retryFeedback(error,rejected=[],plans=[]) {
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
    function makeRetryFailure(rejected,globalError) {
        const reasons=[];
        if(rejected?.length)reasons.push('部分业务片段未通过（'+rejected.length+'项）');
        if(globalError)reasons.push(String(globalError.message||globalError));
        const error=new Error(reasons.join('；')||'WorldResult 未通过业务校验');
        error.retryPlan=retryPlanForFailure(globalError,rejected);
        error.rejectedSlices=copy(rejected||[]);
        return error;
    }
    const MICRO_EXPLORATION_SEGMENT=/^(?:天台|教室|走廊|楼梯|楼层|办公室|医务室|校医室|房间|寝室|宿舍房间|洗手间|浴室|食堂|门厅|入口|出口|校门|桥头|街口|小巷)$/;
    function explorationGranularity(name) {
        const raw=String(name||'').trim();
        if(!raw)return {invalid:true,parent:''};
        if(MICRO_EXPLORATION_SEGMENT.test(raw))return {invalid:true,parent:''};
        const parts=raw.split(/\s*(?:-|—|–|→|>|\/|／|·|・)\s*/).filter(Boolean);
        if(parts.length>1&&MICRO_EXPLORATION_SEGMENT.test(parts.at(-1)))return {invalid:true,parent:parts.slice(0,-1).join('-')};
        return {invalid:false,parent:''};
    }
    function repairExplorationGranularity(stat) {
        const bucket=stat?.世界?.探索;if(!plain(bucket))return [];
        const patches=[];
        for(const name of Object.keys(bucket)){
            const info=explorationGranularity(name);if(!info.invalid||!info.parent)continue;
            const child=bucket[name],parent=bucket[info.parent];
            const merged=plain(parent)
                ? Object.assign(copy(EXISTING.探索),copy(parent),{探索度:Math.max(Number(parent.探索度)||0,Number(child?.探索度)||0)})
                : Object.assign(copy(EXISTING.探索),{
                    风险:String(child?.风险||'F'),
                    探索度:Number(child?.探索度)||0,
                    描述:'由旧版子区域探索记录合并，待补充整体地标描述',
                    隐藏真相:''
                });
            bucket[info.parent]=merged;delete bucket[name];
            patches.push({op:parent?'replace':'add',path:pointer(['世界','探索',info.parent]),value:copy(merged)});
            patches.push({op:'remove',path:pointer(['世界','探索',name])});
        }
        return patches;
    }
    function ensureDueHandled(next,dueList,worldTime) {
        for(const due of dueList||[]){
            const event=next.世界[PATH].事件[due.名称];
            if(!event)continue;
            if(event.状态==='待发生'&&(event.更新时间!==worldTime||!event.下次检查||!event.条件)){
                throw new Error('到期事件未处理：'+due.名称+'。需启动事件，或记录本轮复核日期、阻碍条件与下次检查。');
            }
        }
    }
    function unscheduledEvents(stat) {
        return Object.entries(stat?.世界?.[PATH]?.事件||{}).filter(([,event])=>{
            if(!['待发生','进行中'].includes(event?.状态))return false;
            const anchor=eventTimeAnchor(event);
            return !anchor||VAGUE_EVENT_TIME.test(anchor);
        }).map(([名称,event])=>({名称,分类:event.分类,状态:event.状态,条件:event.条件,前因:copy(event.前因||[]),当前时间:eventTimeAnchor(event)}));
    }
    function ensureEventTimeAnchors(next,required=[]) {
        const missing=[];
        for(const item of required||[]){
            const event=next?.世界?.[PATH]?.事件?.[item.名称];
            if(!event||!['待发生','进行中'].includes(event.状态))continue;
            const anchor=eventTimeAnchor(event);
            if(!anchor||VAGUE_EVENT_TIME.test(anchor))missing.push(item.名称);
        }
        if(missing.length)throw new Error('事件时间锚点仍未补全：'+missing.join('、')+'；请逐项补写具体世界日期/时段，或明确相对/因果时间，禁止空值和“近期/稍后/未来/待定/未知”');
    }
    function ensureStaleActiveHandled(next,required=[],worldTime='') {
        const now=worldDateKey(worldTime),state=next?.世界?.[PATH];
        const unresolved=[],resolved=[];
        for(const item of required||[]){
            const event=state?.事件?.[item.名称];
            if(!event)continue;
            if(['已完成','已取消'].includes(event.状态)){resolved.push(item.名称);continue;}
            const updated=worldDateKey(event.更新时间);
            if(event.状态==='进行中'&&updated!==null&&now!==null&&updated===now&&String(event.下次检查||'').trim())continue;
            unresolved.push(item.名称);
        }
        if(unresolved.length)throw new Error('超期活动事件仍未复核：'+unresolved.join('、')+'；局部事件跨越过长时间仍标记进行中，必须结束/取消，或更新到当前时间并填写下次检查');
        // 对“本轮刚刚确认早已结束”的陈旧局部事件绕过24小时展示宽限：
        // 清理人物/地区/传播的软引用；若没有活跃事件继续依赖它，则立即压成历史。
        for(const name of resolved){
            const event=state?.事件?.[name];if(!event)continue;
            detachEventSoftRefs(state,name);
            const hardRef=Object.entries(state.事件||{}).some(([other,record])=>other!==name&&!['已完成','已取消'].includes(record?.状态)&&Array.isArray(record?.前因)&&record.前因.includes(name));
            if(!hardRef)archiveFinishedEvent(next,state,name,event,[]);
        }
    }
    function ensureTemporalAnomaliesResolved(next,required=[]) {
        if(!(required||[]).length)return;
        const remaining=temporalAnomalies(next);
        const keys=new Set((required||[]).map(item=>item.类型+'\u0000'+item.名称));
        const bad=remaining.filter(item=>keys.has(item.类型+'\u0000'+item.名称));
        if(bad.length)throw new Error('时间越界记录仍未修复：'+bad.map(item=>item.类型+'/'+item.名称+'('+item.字段+'='+item.值+')').join('、'));
    }
    function ensureMacroBackbone(next,timeline,required=true) {
        if(!required||!timeline?.需要补充远期)return;
        const allMacro=Object.entries(next?.世界?.[PATH]?.事件||{}).filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消');
        const activeMacro=allMacro.filter(([,e])=>e.状态==='进行中');
        const futureMacro=allMacro.filter(([,e])=>e.状态==='待发生');
        const openMacro=allMacro.filter(([,e])=>['进行中','待发生'].includes(e.状态));
        if(openMacro.length<3)throw new Error('宏观事件不足：需要至少3个可推进宏观节点（进行中+待发生），当前仅'+openMacro.length+'个（进行中'+activeMacro.length+'个，待发生'+futureMacro.length+'个）');
        const stages=storyStages(next?.世界?.因果轨道?.故事线);
        const names=new Set(allMacro.map(([name])=>name));
        if(stages.length<3||stages.length>5||stages.some(name=>!names.has(name)))throw new Error('因果轨道未形成有效宏观投影：请用已建立的宏观节点生成3~5节点故事线');
    }

    function progressionAnchorChanged(before,after) {
        return before?.世界?.名称!==after?.世界?.名称||before?.世界?.时间!==after?.世界?.时间||!!before?.系统状态?.是否在主神空间!==!!after?.系统状态?.是否在主神空间;
    }
    function firstCompleteJsonObject(source) {
        const text=String(source||''),start=text.indexOf('{');
        if(start<0)return '';
        let depth=0,inString=false,escaped=false;
        for(let i=start;i<text.length;i++){
            const ch=text[i];
            if(inString){
                if(escaped)escaped=false;
                else if(ch==='\\')escaped=true;
                else if(ch==='"')inString=false;
                continue;
            }
            if(ch==='"'){inString=true;continue;}
            if(ch==='{')depth++;
            else if(ch==='}'){
                depth--;
                if(depth===0)return text.slice(start,i+1);
                if(depth<0)return '';
            }
        }
        return '';
    }
    function parseReply(text) {
        let source=String(text).trim();
        const block=source.match(/<world_update\s*>([\s\S]*?)<\/world_update>/i);
        if(block)source=block[1].trim();
        const fence=source.match(/\x60\x60\x60(?:json)?\s*([\s\S]*?)\x60\x60\x60/i);
        if(fence)source=fence[1].trim();
        let result;
        try {result=JSON.parse(source);}
        catch(error){
            const candidate=firstCompleteJsonObject(source);
            try {if(!candidate)throw error;result=JSON.parse(candidate);}
            catch(_){throw new Error('返回 JSON 无法解析：'+error.message+'；原始回复保留在请求检查。');}
        }
        if(!plain(result))throw new Error('回复必须是一个 JSON 对象');
        for(const key of ['WorldResult','world_result','world_update','result']){
            if(plain(result[key])&&Object.keys(result).length===1){result=result[key];break;}
        }
        if(Array.isArray(result.patches)&&typeof result.summary==='string'){
            return {kind:'legacy_patches',summary:result.summary,patches:result.patches};
        }
        const worldResult=normalizeWorldResult(result);
        return {kind:'world_result',summary:worldResult.摘要,worldResult};
    }
