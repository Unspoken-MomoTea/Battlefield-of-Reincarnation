    // 世界完整性保护：统一精确时钟；因果偏移采用软归一化，不因语义或幅度问题拖死整轮推进。
    const WORLD_INTEGRITY_GUARD_RULES=`【因果偏移与时间约束】
1. 时间校验按字段粒度处理：事件、地区、历史、传播等宏观事实只按“自然日”硬校验；同一自然日内的上午/下午/HH:mm差异不算未来越界，只有跨日未来事实才拒绝。
2. 人物当前动态仅在“当前世界时间”和“人物更新时间”双方都明确到 HH:mm 时做分钟级先后校验；任一侧只有清晨/上午/下午等粗粒度时，同日视为合法。当前状态仍优先复用世界.时间原文，未来计划放预计结束、下次检查或待发生事件。
3. 偏移记录不是每轮必填，也不是剧情日志、剧情总结或章节小结。只记录已经发生、已经确认，并且现实结果已经改变关键人物命运、重大事件结果、关键势力格局、主线可行性或异常污染规模的长期偏移；本轮没有这种重大世界级变化时，省略“因果.偏移记录”，不得为了让稳定值变化而硬造记录。
4. 判定依据是已经实现的结果，不是危险程度、能力强弱、计划、意图或潜在上限。即使持有足以影响整个世界的高危装置，只要尚未使用且尚未造成现实结果，就不产生偏移。
5. 同一已确认根因及其连锁后果只记一条，优先更新已有偏移；只有形成新的、独立的长期偏移方向才新增。禁止把同一条因果链拆成剧情小总结连续累计。
6. 预测、风险、可能、潜在或未来尚未发生的后果不产生偏移；位置暴露、敌人警觉、受伤、逃脱、生存/行动难度变化等局部战术后果不产生偏移；稳定下降及其后续世界响应也不能反过来成为新的负偏移。
7. 负值锚点：关键人物命运不可逆改写 -3~-12；重大事件结果不可逆改变 -3~-10；关键势力格局或主线可行性实质破坏 -2~-8；异常污染持续扩大 -1~-10。普通变化不记录。
8. 正值只来自真实修复：关键人物/重大事件修复 +3~+10；异常清除 +1~+15；势力格局或主线结构修复 +2~+8。高于100不能来自普通善行、胜利或奖励。
9. 单条建议范围 -12~-1 或 +1~+15，0 不建新记录；同一引发者同轮负向总量最多 -12、正向总量最多 +15。程序对越界、同根拆分、局部后果或尚未产生现实结果的偏移执行软归一化/忽略，不触发重试，也不驳回本轮其它世界推进结果。
10. 世界.稳定是偏移台账的派生值，由程序汇总；模型不得直接修改，也不需要每轮“更新稳定值”。`;

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

    // 完整性校验与排序/调度使用不同精度：世界事件等宏观事实以“日”为硬边界，
    // 避免把“上午/下午”这种粗粒度标签伪装成精确小时后误杀同日推进。
    // 人物只有在两侧都给出 HH:mm 时才保留分钟级保护，防止真实的精确时钟倒流。
    const temporalAnomaliesBeforeIntegrityGuard=temporalAnomalies;
    function integrityWorldDayKey(value) {
        const key=worldDateKey(value);
        return key===null?null:Math.floor(key/24);
    }
    function integrityHasExactClock(value) {
        return /(?:^|[日T\s_-])(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?/.test(String(value||''));
    }
    temporalAnomalies=function(stat) {
        const anomalies=temporalAnomaliesBeforeIntegrityGuard(stat);
        if(!anomalies.length)return anomalies;
        const nowRaw=String(stat?.世界?.时间||''),nowDay=integrityWorldDayKey(nowRaw),nowKey=worldDateKey(nowRaw);
        if(nowDay===null)return anomalies;
        const nowExact=integrityHasExactClock(nowRaw);
        return anomalies.filter(item=>{
            const valueRaw=String(item?.值||''),valueDay=integrityWorldDayKey(valueRaw);
            if(valueDay===null)return true;
            if(valueDay>nowDay)return true;
            if(valueDay<nowDay)return false;
            if(item?.类型!=='人物')return false;
            if(!nowExact||!integrityHasExactClock(valueRaw))return false;
            const valueKey=worldDateKey(valueRaw);
            return nowKey!==null&&valueKey!==null&&valueKey>nowKey;
        });
    };

    // 因果影响幅度是语义层规则，不交给 JSON Schema 拒绝；编译阶段统一软归一化。
    delete OFFSET_RESULT_SCHEMA.properties.影响程度.minimum;
    delete OFFSET_RESULT_SCHEMA.properties.影响程度.maximum;

    const CAUSAL_CHAIN_HINT=/(?:余波|后续|进一步|继续|继而|因此|由此|连锁|衍生|扩散|扩大|反应|吸引力|同一(?:契约|事件|行为|根因))/;
    const CAUSAL_SPECULATION_HINT=/(?:可能|或许|预计|预期|将会|或将|未来(?:会|可能|将)|潜在|恐怕|有望|计划|打算|准备)/;
    const CAUSAL_NO_EFFECT_HINT=/(?:尚未|还未|并未|未曾|没有|仅仅|只是).{0,18}(?:发生|执行|实施|使用|启动|造成|导致|改变|影响|生效)|(?:尚未|还未|并未|未曾|没有).{0,18}(?:结果|变化|后果)/;
    const CAUSAL_REALIZED_HINT=/(?:已经|已然|已被|已使|已让|导致|造成|致使|使得|迫使|结果|改写|改变|破坏|摧毁|死亡|失去|退出|完成|失败|成功|被捕|被杀|被夺|被毁|封锁|崩溃|断裂|清除|修复)/;
    const CAUSAL_RESPONSE_HINT=/(?:稳定值(?:持续)?下降|世界排异(?:反应|升级|增强)?|排异强度)/;
    function clampCausalImpact(value) {
        const impact=Number(value);
        if(!Number.isFinite(impact))return null;
        if(impact===0)return 0;
        return impact<0?Math.max(-12,impact):Math.min(15,impact);
    }
    function causalOffsetText(item) {
        return [item?.名称,item?.描述].filter(Boolean).join(' ');
    }
    function softNormalizeCausalOffsets(stat,result) {
        const items=Array.isArray(result?.因果?.偏移记录)?result.因果.偏移记录:null;
        if(!items||!items.length)return;
        const existing=stat?.世界?.因果轨道?.偏移记录||{},prepared=[];
        for(const raw of items){
            if(!plain(raw))continue;
            const item=copy(raw);
            if(item.操作==='撤销本轮'){prepared.push(item);continue;}
            const existingName=stableNameIn(existing,item.名称),isNew=!existingName;
            if(Object.hasOwn(item,'影响程度')){
                const impact=clampCausalImpact(item.影响程度);
                if(impact===null){
                    if(isNew)continue;
                    delete item.影响程度;
                }else if(isNew&&impact===0)continue;
                else item.影响程度=impact;
            }else if(isNew)continue;
            const text=causalOffsetText(item);
            if(isNew&&CAUSAL_NO_EFFECT_HINT.test(text))continue;
            if(isNew&&CAUSAL_SPECULATION_HINT.test(text)&&!CAUSAL_REALIZED_HINT.test(text))continue;
            if(isNew&&Number(item.影响程度)<0&&CAUSAL_RESPONSE_HINT.test(text))continue;
            prepared.push(item);
        }

        // 明确写成“同一根因/后续/余波”等的同一引发者同向碎片，保留影响绝对值最大的代表项。
        const removed=new Set(),groups=new Map();
        for(let i=0;i<prepared.length;i++){
            const item=prepared[i];
            if(!plain(item)||item.操作==='撤销本轮'||!Object.hasOwn(item,'影响程度'))continue;
            const actor=String(item.引发者||'').trim().toLowerCase();
            const impact=Number(item.影响程度);
            if(!actor||!Number.isFinite(impact)||impact===0)continue;
            const key=actor+'|'+(impact<0?'negative':'positive'),group=groups.get(key)||[];
            group.push({index:i,item,text:causalOffsetText(item),impact});groups.set(key,group);
        }
        for(const group of groups.values()){
            const chained=group.filter(entry=>CAUSAL_CHAIN_HINT.test(entry.text));
            if(chained.length<2)continue;
            let winner=chained[0];
            for(const entry of chained.slice(1))if(Math.abs(entry.impact)>Math.abs(winner.impact))winner=entry;
            for(const entry of chained)if(entry.index!==winner.index)removed.add(entry.index);
        }
        let normalized=prepared.filter((_,index)=>!removed.has(index));

        // 同一引发者同轮总影响做软封顶；不重试、不抛错，只缩减后续条目的剩余额度。
        const budgets=new Map();
        normalized=normalized.filter(item=>{
            if(!plain(item)||item.操作==='撤销本轮'||!Object.hasOwn(item,'影响程度'))return true;
            const actor=String(item.引发者||'').trim().toLowerCase(),impact=Number(item.影响程度);
            if(!actor||!Number.isFinite(impact)||impact===0)return true;
            const sign=impact<0?'negative':'positive',key=actor+'|'+sign;
            let remaining=budgets.has(key)?budgets.get(key):(impact<0?12:15);
            const magnitude=Math.min(Math.abs(impact),remaining);
            remaining=Math.max(0,remaining-magnitude);budgets.set(key,remaining);
            if(magnitude<=0)return false;
            item.影响程度=impact<0?-magnitude:magnitude;
            return true;
        });
        result.因果.偏移记录=normalized;
    }

    const compileWorldResultBeforeIntegrityGuard=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=normalizeWorldResult(value);
        softNormalizeCausalOffsets(stat,result);
        return compileWorldResultBeforeIntegrityGuard(stat,result);
    };

    const retryPlanBeforeIntegrityGuard=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        const plan=retryPlanBeforeIntegrityGuard(error,rejected).slice();
        const message=[String(error?.message||error||''),...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
        if(/时间事实超过当前世界时间|时间越界记录仍未修复/.test(message))plan.unshift('时间一致性：事件/地区/历史/传播只把“跨到未来自然日”视为硬越界，同日不同上午/下午/HH:mm无需回写；人物只有双方均明确 HH:mm 时才做分钟级校验。未来计划放预计结束、下次检查或待发生事件。');
        return Array.from(new Set(plan.filter(Boolean)));
    };

    const SamsaraWorldEngineBeforeIntegrityGuard=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeIntegrityGuard {
        async buildRequest(base) {
            const request=await super.buildRequest(base);
            request.system=String(request.system||'')+'\n\n'+WORLD_INTEGRITY_GUARD_RULES;
            request.manifest=request.manifest||{};
            request.manifest.因果与时间约束={启用:true,因果偏移处理:'仅重大世界级变化时维护；无变化则省略',单条建议范围:'-12~-1 / +1~+15',宏观事实时间:'同一自然日允许；跨日未来拒绝',人物精确时间:'仅双方均为 HH:mm 时精确比较'};
            request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            return request;
        }
    };
