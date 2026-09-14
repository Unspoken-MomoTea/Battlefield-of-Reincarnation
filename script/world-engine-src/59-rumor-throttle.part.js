    // 传闻节流：默认保持现有公开传闻，只在真实的信息事件发生时刷新；传闻/传播失败不再拖整轮重试。
    const RUMOR_THROTTLE_RULES=`【传闻刷新节流 · 取代前述“每轮替换”要求】
1. 公开传闻默认保持不变。只有“传闻维护.本轮公开传闻动作”要求更新时才写传闻；禁止为了制造活跃感、凑数量或普通小事每轮改写。
2. 触发只包括：某分类为空需补1条；已有传播链因关联事件新进展、到期或超过72小时而需复核；本轮刚建立/更新且尚未建立传播链、具有公开征兆/可见影响的新事件。旧事件不会因为仍然存在而反复触发。普通行动、普通战斗、轻微状态或数值变化不触发刷新。
3. 单次触发每个分类最多更新1条。优先刷新与本次事实直接相关的同名传闻；否则追加1条，由程序自动滚动淘汰最旧条目。没有触发时三类传闻都保持原样，不提交无变化更新。
4. 传闻与传播属于软维护。单个传闻/传播片段格式错误或本轮未维护完成时，丢弃该片段并保留其它已验收结果；不得仅为传闻/传播重新调用整轮世界推进。
5. 情报交易的购买、付款、消费性删除仍由MVU/变量AI处理；世界引擎只维护其世界侧信息来源。`;
    const RUMOR_THROTTLE_PRESET_STEP='Step 6 · 信息传播：公开传闻默认保持不变；仅在空分类、传播链需复核或出现新的公开可传播事实时按需更新，每个触发每类最多1条。传闻/传播属于软维护，失败不重跑整轮。';
    function upgradeRumorThrottlePreset(value) {
        const source=String(value||'');
        if(source.includes(RUMOR_THROTTLE_PRESET_STEP))return source;
        if(typeof RUMOR_PRESET_STEP_NEW==='string'&&source.includes(RUMOR_PRESET_STEP_NEW))return source.replace(RUMOR_PRESET_STEP_NEW,RUMOR_THROTTLE_PRESET_STEP);
        return source;
    }
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings))BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=upgradeRumorThrottlePreset(BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset);

    const rumorMaintenanceRequirementsBeforeThrottle=rumorMaintenanceRequirements;
    rumorMaintenanceRequirements=function(stat) {
        const required=rumorMaintenanceRequirementsBeforeThrottle(stat);
        const emptyCategories=RUMOR_PUBLIC_CATEGORIES.filter(category=>Number(required?.公开传闻?.[category]?.当前数量||0)===0);
        const review=Array.isArray(required?.本轮必须复核的传播链)?required.本轮必须复核的传播链:[];
        const currentTime=String(required?.世界时间||'').trim();
        const candidates=(Array.isArray(required?.可传播候选事件)?required.可传播候选事件:[])
            .filter(item=>String(item?.更新时间||'').trim()===currentTime)
            .slice(-2);
        const reasons=[];
        if(emptyCategories.length)reasons.push('空分类：'+emptyCategories.join('、'));
        if(review.length)reasons.push('传播复核：'+review.map(item=>item.名称).join('、'));
        if(candidates.length)reasons.push('新公开事实：'+candidates.map(item=>item.名称).join('、'));
        required.可传播候选事件=candidates;
        required.刷新原因=reasons;
        required.本轮公开传闻动作=reasons.length?'按需更新；每个触发每类最多1条':'保持不变';
        return required;
    };

    function isSoftRumorFragment(label) {
        return /^(?:传闻\/|传播\/)/.test(String(label||''));
    }
    const stageWorldResultBeforeRumorThrottle=stageWorldResult;
    stageWorldResult=function(stat,accepted,incoming,validate) {
        const staged=stageWorldResultBeforeRumorThrottle(stat,accepted,incoming,validate);
        const softRejected=(staged.rejected||[]).filter(item=>isSoftRumorFragment(item?.片段));
        if(!softRejected.length)return staged;
        return Object.assign({},staged,{
            rejected:(staged.rejected||[]).filter(item=>!isSoftRumorFragment(item?.片段)),
            softRejected
        });
    };

    const SamsaraWorldEngineBeforeRumorThrottle=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeRumorThrottle {
        constructor(host,env) {
            super(host,env);
            if(this.config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id){
                const upgraded=upgradeRumorThrottlePreset(this.config.preset);
                if(upgraded!==this.config.preset){this.config.preset=upgraded;this.saveConfig();}
            }
        }
        async buildRequest(base) {
            const request=await super.buildRequest(base);
            const maintenance=rumorMaintenanceRequirements(base?.stat||{});
            const payload=JSON.parse(request.input);
            payload.传闻维护=Object.assign({},payload.传闻维护||{}, {
                本轮公开传闻动作:maintenance.本轮公开传闻动作,
                刷新原因:copy(maintenance.刷新原因||[]),
                可传播候选事件:copy(maintenance.可传播候选事件||[])
            });
            request.input=JSON.stringify(payload,null,2);
            request.system=String(request.system||'')+'\n\n'+RUMOR_THROTTLE_RULES;
            request.manifest=request.manifest||{};
            request.manifest.传闻节流={
                模式:'按需刷新',
                本轮动作:maintenance.本轮公开传闻动作,
                刷新原因:copy(maintenance.刷新原因||[]),
                软失败不重试:true
            };
            request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            return request;
        }
    };
