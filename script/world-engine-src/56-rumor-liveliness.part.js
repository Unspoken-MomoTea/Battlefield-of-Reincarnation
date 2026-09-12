    // 传闻是常驻活跃层：公开传闻保证世界始终有可见动向，后台传播负责其因果来源与人物知情链。
    const RUMOR_LIVELINESS_TOPICS=['悬赏线索','商路动向','势力情报','遗迹坐标','人物行踪','黑市消息','宝物传闻','怪物异动','深渊异变','种族摩擦','物价波动'];
    const RUMOR_PUBLIC_CATEGORIES=['街头巷议','情报交易','布告与檄文'];
    const RUMOR_STALE_HOURS=72;
    const RUMOR_LIVELINESS_RULES=`【传闻与传播 · 常驻活跃层】
1. 街头巷议、情报交易、布告与檄文各自最多3条；某类为空时本轮补2条。单条约60字，除非影响重大，不围绕<user>。
   上限计算为旧条目与本轮更新合并、移除后的最终数量，不是本轮操作数。新名称会新增，不会自动替换旧名称；分类已满时，必须同轮按旧名称提交「操作:移除」再补新条，允许同类提交超过3项增删操作，最终保留不超过3条。沿用原名称则更新原条目，未提及的旧条目继续保留。
2. 街头巷议随当前地区、说书人/目击者和局势替换1~2条，远离后移除失去本地价值的旧条；情报交易有卖家时更新1~2条，购买、付款与消费性删除由MVU按正文结果处理；布告与檄文随当前地区与发布势力替换。
3. 后台传播是人物知情与公开传闻的因果链。新可传播事实建立或推进传播；关联事件变化、传播陈旧或到期时复核范围、受众、内容与引发行动，结束/过期传播不复活。
4. 优先话题：${RUMOR_LIVELINESS_TOPICS.join(' / ')}。`;
    const RUMOR_PRESET_STEP_OLD='Step 6 · 更新传播：只维护本轮真实变化的传播、货币与历法；结束/过期传播不复活。';
    const RUMOR_PRESET_STEP_NEW='Step 6 · 信息传播：传闻是常驻活跃层；三类公开传闻为空时补2条，并随地区、卖家、发布势力与局势替换。新可传播事实建立或推进传播链，关联事件变化、陈旧或到期时复核。';
    const upgradeRumorPreset=value=>String(value||'').includes(RUMOR_PRESET_STEP_OLD)?String(value).replace(RUMOR_PRESET_STEP_OLD,RUMOR_PRESET_STEP_NEW):String(value||'');
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings))BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=upgradeRumorPreset(BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset);
    let ACTIVE_RUMOR_MAINTENANCE=null;

    function rumorEventTouchedKey(event) {
        return worldDateKey(event?.更新时间||event?.预计结束||event?.开始时间||event?.时间);
    }
    function rumorMaintenanceRequirements(stat) {
        const backend=stat?.世界?.[PATH]||{},rumors=stat?.传闻||{},events=backend.事件||{},propagation=backend.传播||{};
        const worldTime=String(stat?.世界?.时间||''),now=worldDateKey(worldTime);
        const publicState={};
        for(const category of RUMOR_PUBLIC_CATEGORIES){
            const bucket=plain(rumors?.[category])?rumors[category]:{};
            const count=Object.keys(bucket).length;
            publicState[category]={当前数量:count,为空补足:count===0?2:0};
        }
        const review=[];
        for(const [名称,record] of Object.entries(propagation)){
            if(!plain(record)||!/^传播中$/.test(String(record.状态||'').trim()))continue;
            const reasons=[],updatedText=String(record.更新时间||'').trim(),touched=worldDateKey(updatedText||record.时间),expiry=worldDateKey(record.到期时间);
            let semantic=false;
            if(!updatedText)reasons.push('缺少更新时间');
            if(expiry!==null&&now!==null&&expiry<=now){reasons.push('已到期');semantic=true;}
            if(touched!==null&&now!==null&&now-touched>=RUMOR_STALE_HOURS){reasons.push('超过72小时未复核');semantic=true;}
            const changedEvents=[];
            for(const eventName of Array.isArray(record.关联事件)?record.关联事件:[]){
                const event=events[eventName];if(!plain(event))continue;
                const eventTouched=rumorEventTouchedKey(event);
                if((eventTouched!==null&&(touched===null||eventTouched>touched))||['已完成','已取消'].includes(event.状态))changedEvents.push(eventName);
            }
            if(changedEvents.length){reasons.push('关联事件已有新进展：'+changedEvents.join('、'));semantic=true;}
            if(!reasons.length)continue;
            review.push({
                名称,原因:reasons,需语义变化:semantic,
                当前:{来源:String(record.来源||''),范围:String(record.范围||''),时间:String(record.时间||''),更新时间:updatedText,到期时间:String(record.到期时间||''),内容:String(record.内容||''),状态:String(record.状态||''),受众:copy(record.受众||[]),引发行动:copy(record.引发行动||[]),关联事件:copy(record.关联事件||[])}
            });
        }
        const linked=new Set(Object.values(propagation).flatMap(record=>Array.isArray(record?.关联事件)?record.关联事件:[]));
        const candidates=Object.entries(events).filter(([name,event])=>{
            if(!plain(event)||!['进行中','已完成'].includes(event.状态)||linked.has(name))return false;
            const visible=String(event.公开征兆||'').trim()||(Array.isArray(event.可见影响)&&event.可见影响.length);
            return !!visible;
        }).slice(-6).map(([名称,event])=>({名称,状态:event.状态,地点:String(event.地点||''),公开征兆:String(event.公开征兆||''),更新时间:String(event.更新时间||event.时间||'')}));
        return {
            世界:String(stat?.世界?.名称||''),世界时间:worldTime,当前地点:String(stat?.世界?.地点||''),
            话题:copy(RUMOR_LIVELINESS_TOPICS),公开传闻:publicState,
            本轮必须复核的传播链:review,可传播候选事件:candidates
        };
    }
    function rumorMaintenanceNeeded(stat) {
        const required=rumorMaintenanceRequirements(stat);
        return Object.values(required.公开传闻).some(item=>item.当前数量===0)||required.本轮必须复核的传播链.length>0;
    }
    function ensureRumorLiveliness(next,required) {
        if(!plain(required)||String(next?.世界?.名称||'')!==String(required.世界||'')||String(next?.世界?.时间||'')!==String(required.世界时间||''))return;
        const shortages=[];
        for(const category of RUMOR_PUBLIC_CATEGORIES){
            const count=Object.keys(plain(next?.传闻?.[category])?next.传闻[category]:{}).length;
            const initial=Number(required?.公开传闻?.[category]?.当前数量)||0;
            if(count===0)shortages.push(category+'仍为空');
            else if(initial===0&&count<2)shortages.push(category+'仅'+count+'条');
        }
        if(shortages.length)throw new Error('传闻为空未补足：'+shortages.join('、')+'；空分类本轮必须补2条，三类各自最多3条');
        const unresolved=[];
        for(const item of required.本轮必须复核的传播链||[]){
            const record=next?.世界?.[PATH]?.传播?.[item.名称];
            if(!record)continue;
            if(propagationEnded(record,worldDateKey(required.世界时间)))continue;
            const updated=String(record.更新时间||'').trim()===String(required.世界时间||'').trim();
            const before=item.当前||{};
            const semantic=['范围','内容','受众','引发行动','状态','到期时间'].some(key=>!same(record?.[key],before?.[key]));
            if(!updated||(item.需语义变化&&!semantic))unresolved.push(item.名称);
        }
        if(unresolved.length)throw new Error('传播链仍未复核：'+unresolved.join('、')+'；更新到当前世界时间，并按真实变化推进范围/受众/内容/引发行动，或明确结束/移除');
    }

    const ensureTemporalAnomaliesResolvedBeforeRumors=ensureTemporalAnomaliesResolved;
    ensureTemporalAnomaliesResolved=function(next,required=[]) {
        ensureTemporalAnomaliesResolvedBeforeRumors(next,required);
        ensureRumorLiveliness(next,ACTIVE_RUMOR_MAINTENANCE);
    };

    const retryPlanBeforeRumorLiveliness=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        const message=[String(error?.message||error||''),...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
        const plan=retryPlanBeforeRumorLiveliness(error,rejected).slice();
        let match;
        if((match=message.match(/传闻为空未补足：([^；\n]+)/)))plan.push('传闻维护：'+match[1]+'。空分类本轮补2条真实世界信息；三类各自最多3条，约60字/条，不要无依据围绕<user>。');
        if((match=message.match(/传播链仍未复核：([^；\n]+)/)))plan.push('传播维护：'+match[1]+'。逐条更新到当前世界时间，并推进范围/受众/内容/引发行动；若传播已结束则结束或移除，不要原样重交。');
        return Array.from(new Set(plan.filter(Boolean)));
    };

    const SamsaraWorldEngineBeforeRumorLiveliness=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeRumorLiveliness {
        constructor(host,env) {
            super(host,env);
            if(this.config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id){
                const upgraded=upgradeRumorPreset(this.config.preset);
                if(upgraded!==this.config.preset){this.config.preset=upgraded;this.saveConfig();}
            }
        }
        async buildRequest(base) {
            const rumorMaintenance=rumorMaintenanceRequirements(base?.stat||{});
            ACTIVE_RUMOR_MAINTENANCE=rumorMaintenance;
            const request=await super.buildRequest(base);
            const payload=JSON.parse(request.input);
            if(Array.isArray(request.timeAnomalies))request.timeAnomalies=request.timeAnomalies.filter(item=>item?.类型!=='传闻维护');
            if(Array.isArray(payload.本轮必须修复的时间越界记录))payload.本轮必须修复的时间越界记录=payload.本轮必须修复的时间越界记录.filter(item=>item?.类型!=='传闻维护');
            payload.传闻维护={
                当前地点:rumorMaintenance.当前地点,
                话题:rumorMaintenance.话题,
                公开传闻:rumorMaintenance.公开传闻,
                本轮必须复核的传播链:rumorMaintenance.本轮必须复核的传播链,
                可传播候选事件:rumorMaintenance.可传播候选事件
            };
            request.input=JSON.stringify(payload,null,2);
            request.system=String(request.system||'')+'\n\n'+RUMOR_LIVELINESS_RULES;
            request.rumorMaintenance=copy(rumorMaintenance);
            request.manifest=Object.assign({},request.manifest,{传闻维护:{空分类:RUMOR_PUBLIC_CATEGORIES.filter(category=>rumorMaintenance.公开传闻[category].当前数量===0),待复核传播:rumorMaintenance.本轮必须复核的传播链.map(item=>item.名称),可传播候选:rumorMaintenance.可传播候选事件.map(item=>item.名称)}});
            request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema);
            if(request.system.length+request.input.length>240000)throw new Error('请求超过内部安全上限（'+formatTokenCount(estimateTokens(request.system)+estimateTokens(request.input),true)+'），请减少所选条目或正文层数');
            return request;
        }
        async run() {
            const temporalAnomaliesBeforeRumorRecovery=temporalAnomalies;
            temporalAnomalies=function(stat) {
                const result=temporalAnomaliesBeforeRumorRecovery(stat);
                if(rumorMaintenanceNeeded(stat))result.push({类型:'传闻维护',名称:'常驻传闻与传播链',字段:'活跃性',值:'需复核',说明:'公开传闻为空或传播链需要推进'});
                return result;
            };
            try{return await super.run();}
            finally{if(temporalAnomalies!==temporalAnomaliesBeforeRumorRecovery)temporalAnomalies=temporalAnomaliesBeforeRumorRecovery;}
        }
    };
