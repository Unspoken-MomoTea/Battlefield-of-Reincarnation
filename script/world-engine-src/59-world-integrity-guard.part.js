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

    // 因果偏移软归一化与世界尺度过滤已迁移至 WorldCausalService。\n\n    const retryPlanBeforeIntegrityGuard=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        const plan=retryPlanBeforeIntegrityGuard(error,rejected).slice();
        const message=[String(error?.message||error||''),...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
        if(/时间事实超过当前世界时间|时间越界记录仍未修复/.test(message))plan.unshift('时间一致性：事件/地区/历史/传播只把“跨到未来自然日”视为硬越界，同日不同上午/下午/HH:mm无需回写；人物只有双方均明确 HH:mm 时才做分钟级校验。未来计划放预计结束、下次检查或待发生事件。');
        return Array.from(new Set(plan.filter(Boolean)));
    };

    // 请求 manifest / system 装饰已迁移至 WorldIntegrityRequestFeature + WorldPromptRegistry。
