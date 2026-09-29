    const WORLD_RETRY_GUIDANCE_DEFAULTS=Object.freeze({
        retryGuideMacroBackbone:'宏观骨架：当前可推进宏观节点{current}个（进行中{active}、待发生{future}），还需补充至少{missing}个真正的宏观节点；已确认正在发生的阶段转折可记进行中，其余新增节点记待发生。会合、撤离、赶路、局部争夺/突破等近期节点不计入宏观骨架，不要反复把它们改标为宏观节点。',
        retryGuideEventDelivery:'事件交付：在 WorldResult.事件 中实际建立节点，分类=宏观节点；描述说明篇章、地区整体局势、战争、势力格局或关键人物命运的一个阶段转折，不能只在摘要或因果轨道里列名字。已有合格节点沿用原名，只提交缺失或变化字段。',
        retryGuideMacroSchedule:'宏观排期：每个新增节点必须给出明确时间锚点；沿用明确资料的日期或时间精度，精确日期未知时使用可理解的相对/因果时间，不写近期/稍后/未来/待定/未知。条件按需填写。前因只能引用已存在，或本轮同时提交且成功建立的事件名称；无明确前因使用 []，不得用当前阶段或自然语言原因代替事件名。',
        retryGuideCausalProjection:'因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序；只使用最终3~5个仍可推进且 分类=宏观节点 的不同事件名称，不要写当前阶段、当前事件或近期节点。',
        retryGuideCausalProjectionRepair:'因果轨道：不要重写已接受事件，只补写 因果.宏观顺序；长度必须3~5，且每个名称都必须对应已建立且未取消的宏观节点；不要写当前阶段、当前事件或近期节点。',
        retryGuideDueEvent:'到期事件/{name}：本轮必须明确启动该事件，或更新本轮复核日期、阻碍条件与下次检查。',
        retryGuideEventTime:'事件/{name}：补写明确时间锚点；优先具体世界日期/时段，精确日期未知时写相对或因果时间，禁止空值和“近期/稍后/未来/待定/未知”。',
        retryGuideStaleEvent:'事件/{name}：该局部活动已远超正常持续窗口。若实际早已结束则改为已完成并补结果；若失效则已取消；只有确实仍持续时才保留进行中，并把更新时间写为当前世界时间、更新当前描述并填写下次检查。',
        retryGuideTemporalRepair:'时间一致性：修复这些已经发生的记录，任何已完成/进行中事件、人物更新时间、地区已发生变化、历史与传播都不得晚于当前世界时间：{details}',
        retryGuideAlienActivity:'异端活动/{name}：仅对本轮触发复核的该活跃异端补写地点、目标、行动；人物更新时间由程序使用世界时间统一记录；若本轮已确认死亡，则只更新异端状态=死亡，不再提交人物活动。',
        retryGuideNpcAudit:'NPC构筑审计/{name}：只在 WorldResult.关系 中补齐该既有NPC至少一个列出的构筑缺口；优先补职业/血统/装备/技能/状态/形态或缺失档案字段，不得新建NPC、改HP_MAX/EP_MAX或输出真属性/最终属性。',
        retryGuideChronology:'宏观时间轴：只处理已明确到日的原著/数据库日期冲突。若该节点仍成立，沿用明确日期；若已确认因果偏移改变了其日期、成立条件或是否发生，则补齐明确关联该节点的偏移记录并只重构受影响节点。月份、时段、顺序、条件与趋势继续按软约束保守留白，不要为了回归原著强行修正剧情。',
        retryGuidePredecessor:'事件前因：先修复链首缺失或自引用，再重新提交受影响的后继节点。前因数组只放事件名称，且须已存在或同轮成功建立；当前阶段/自然语言原因不算事件，无明确前因写 []。不得为消除报错凭空补造事件。',
        retryGuideSchemaMismatch:'Schema纠错：只修报错路径中的业务字段；真属性/最终属性/强化属于后台派生缓存，模型不得补写，这类派生差异由程序吸收。',
        retryGuideRumorEmpty:'传闻维护：{details}。空分类本轮补2条真实世界信息；三类各自展示最近3条，约60字/条，不要无依据围绕<user>。',
        retryGuidePropagationReview:'传播维护：{details}。逐条更新到当前世界时间，并推进范围/受众/内容/引发行动；若传播已结束则结束或移除，不要原样重交。',
        retryGuideTemporalIntegrity:'时间一致性：事件/地区/历史/传播只把“跨到未来自然日”视为硬越界，同日不同上午/下午/HH:mm无需回写；人物只有双方均明确 HH:mm 时才做分钟级校验。未来计划放预计结束、下次检查或待发生事件。',
        retryGuideWorldActivity:'世界活动：先推进非异端世界，再复核异端。至少提交一项进行中事件、势力/地区或普通人物的实质变化；只改更新时间、复述原值或新增未来宏观节点不算。',
        retryGuideWorldScene:'世界现场：若地区为空，建立与当前地点/阶段直接相关的地区。势力为空时可优先补一个当前真正参与局势的真实势力/组织，并同名提交 WorldResult.势力 与 WorldResult.势力地区(类型=势力)；势力属于软目标，若资料不足或势力片段因声望/Schema等规则被拒，不要为补档案反复重交或编造组织。',
        retryGuideCurrentReality:'当前现实：若没有进行中的当前事件/近期节点，从当前阶段与最新正文提炼一个“已经正在发生”的现实局势；不要把未来宏观节点提前结算。'
    });

    class WorldRetryGuidanceService {
        constructor(engine=null){this.engine=engine;}

        template(key) {
            const configured=this.engine?.services?.prompts?.value?.(key);
            if(typeof configured==='string')return configured;
            return String(WORLD_RETRY_GUIDANCE_DEFAULTS[key]??'');
        }

        format(key,vars={}) {
            let text=this.template(key);
            for(const [name,value] of Object.entries(vars||{}))text=text.split('{'+name+'}').join(String(value??''));
            return text;
        }

        macroBackbonePlan(current,active,future) {
            const missing=Math.max(0,3-current);
            return [
                this.format('retryGuideMacroBackbone',{current,active,future,missing}),
                this.format('retryGuideEventDelivery'),
                this.format('retryGuideMacroSchedule'),
                this.format('retryGuideCausalProjection')
            ].filter(Boolean);
        }

        plan(error,rejected=[]) {
            const plan=[];
            for(const item of rejected||[])plan.push(String(item?.片段||'')+'：'+String(item?.原因||''));
            const primary=String(error?.message||error||'');
            const combined=[primary,...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
            let match=primary.match(/宏观事件不足：需要至少3个可推进宏观节点（进行中\+待发生），当前仅(\d+)个（进行中(\d+)个，待发生(\d+)个）/);
            if(match){
                const current=Math.max(0,Number(match[1])||0),active=Math.max(0,Number(match[2])||0),future=Math.max(0,Number(match[3])||0);
                plan.push(...this.macroBackbonePlan(current,active,future));
            }else if(/因果轨道未形成有效宏观投影/.test(primary)){
                plan.push(this.format('retryGuideCausalProjectionRepair'));
            }else if((match=primary.match(/到期事件未处理：([^。]+)/))){
                plan.push(this.format('retryGuideDueEvent',{name:match[1]}));
            }else if((match=primary.match(/事件时间锚点缺失或过于模糊：([^；]+)/))){
                plan.push(this.format('retryGuideEventTime',{name:match[1]}));
            }else if((match=primary.match(/事件时间锚点仍未补全：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push(this.format('retryGuideEventTime',{name}));
            }else if((match=primary.match(/超期活动事件仍未复核：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push(this.format('retryGuideStaleEvent',{name}));
            }else if((match=primary.match(/时间越界记录仍未修复：([^；]+)/))){
                plan.push(this.format('retryGuideTemporalRepair',{details:match[1]}));
            }else if((match=primary.match(/异端活动未复核：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push(this.format('retryGuideAlienActivity',{name}));
            }else if((match=primary.match(/NPC构筑审计未推进：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push(this.format('retryGuideNpcAudit',{name}));
            }else if(primary&&!rejected.length){
                plan.push('整体校验：'+primary);
            }

            if(/宏观节点日期(?:未服从|与).*原著\/数据库时间锚点/.test(combined))plan.unshift(this.format('retryGuideChronology'));
            if(/事件前因(?:不存在|非法自引用)/.test(combined))plan.push(this.format('retryGuidePredecessor'));
            if(/字段未通过完整 Schema 校验/.test(combined))plan.push(this.format('retryGuideSchemaMismatch'));
            if((match=combined.match(/传闻为空未补足：([^；\n]+)/)))plan.push(this.format('retryGuideRumorEmpty',{details:match[1]}));
            if((match=combined.match(/传播链仍未复核：([^；\n]+)/)))plan.push(this.format('retryGuidePropagationReview',{details:match[1]}));
            if(/时间事实超过当前世界时间|时间越界记录仍未修复/.test(combined))plan.unshift(this.format('retryGuideTemporalIntegrity'));
            if(/世界活动不足：/.test(primary))plan.unshift(
                this.format('retryGuideWorldActivity'),
                this.format('retryGuideWorldScene'),
                this.format('retryGuideCurrentReality')
            );
            return Array.from(new Set(plan.filter(Boolean)));
        }
    }

    const DEFAULT_WORLD_RETRY_GUIDANCE_SERVICE=new WorldRetryGuidanceService();
