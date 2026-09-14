    // 稳定度因果闸门：只有已实现的世界尺度偏移才允许进入稳定台账；局部战术后果直接忽略。
    const CAUSAL_WORLD_SCALE_HINTS=[
        /(?:关键人物|核心人物|重要人物|关键角色|核心角色).{0,28}(?:命运|死亡|阵亡|被杀|永久|不可逆|退场|失去|背叛|被捕|失踪|改写|改变|修复)/,
        /(?:死亡|阵亡|被杀|永久|不可逆|退场|被捕|失踪|改写|改变|修复).{0,28}(?:关键人物|核心人物|重要人物|关键角色|核心角色)/,
        /(?:重大|关键|宏观|主线).{0,8}(?:事件|节点|战役|战争|仪式|计划|灾难).{0,32}(?:改变|改写|失败|成功|取消|终止|提前|延后|崩溃|完成|毁灭|修复|失效)/,
        /(?:势力|阵营|政权|国家|帝国|王国|组织|军团|城市|地区).{0,32}(?:格局|覆灭|崩溃|瓦解|分裂|易主|政变|失守|沦陷|吞并|解体|重组|修复)/,
        /(?:主线|故事线|世界格局|下一节点|原定(?:走向|结局)).{0,32}(?:改变|改写|断裂|失效|无法|偏离|重构|修复|恢复)/,
        /(?:异常污染|跨世界污染|污染|世界裂隙|跨世界异常|异常侵蚀|世界侵蚀).{0,32}(?:扩大|扩散|蔓延|加剧|持续|清除|消除|修复|收束|封闭)/,
        /(?:不可逆|永久).{0,20}(?:命运|主线|重大事件|关键事件|势力格局|世界格局)/
    ];
    const CAUSAL_CLEAR_LOCAL_HINT=/(?:位置(?:暴露|泄露|被发现|被感知)|被(?:敌人|异端|对手).{0,12}(?:发现|察觉|感知|盯上|追踪)|提前感知|引起警觉|提高.{0,10}难度|增加.{0,10}难度|生存难度|行动难度|短期.{0,8}(?:困难|不利)|局部战斗|普通战斗|受伤|轻伤|逃脱|脱险|暂时受阻|临时受阻)/;
    function causalOffsetHasWorldScaleEvidence(item) {
        const text=causalOffsetText(item);
        return !!text&&CAUSAL_WORLD_SCALE_HINTS.some(rule=>rule.test(text));
    }
    function filterNewCausalOffsetsByWorldScale(stat,result) {
        const items=result?.因果?.偏移记录;
        if(!Array.isArray(items)||!items.length)return [];
        const existing=stat?.世界?.因果轨道?.偏移记录||{},dropped=[];
        result.因果.偏移记录=items.filter(item=>{
            if(!plain(item)||item.操作==='撤销本轮')return true;
            if(stableNameIn(existing,item.名称))return true;
            if(causalOffsetHasWorldScaleEvidence(item))return true;
            dropped.push(item.名称);
            return false;
        });
        return dropped;
    }
    function staleLocalCausalOffsetRepairs(stat,result) {
        const bucket=stat?.世界?.因果轨道?.偏移记录||{},protectedNames=new Set();
        for(const item of result?.因果?.偏移记录||[]){
            if(plain(item)&&causalOffsetHasWorldScaleEvidence(item))protectedNames.add(nameKey(item.名称));
        }
        const patches=[],names=[];
        for(const [name,record] of Object.entries(bucket)){
            const impact=Number(record?.影响程度)||0;
            if(!impact||protectedNames.has(nameKey(name)))continue;
            const text=causalOffsetText(Object.assign({名称:name},record));
            if(!CAUSAL_CLEAR_LOCAL_HINT.test(text)||CAUSAL_WORLD_SCALE_HINTS.some(rule=>rule.test(text)))continue;
            patches.push({op:'remove',path:pointer(['世界','因果轨道','偏移记录',name])});
            names.push(name);
        }
        return {patches,names};
    }

    const compileWorldResultBeforeCausalStabilityGate=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=normalizeWorldResult(value);
        const dropped=filterNewCausalOffsetsByWorldScale(stat,result);
        const compiled=compileWorldResultBeforeCausalStabilityGate(stat,result);
        const repairs=staleLocalCausalOffsetRepairs(stat,result);
        const occupied=new Set(compiled.patches.map(patch=>patch.path));
        for(const patch of repairs.patches)if(!occupied.has(patch.path))compiled.patches.push(patch);
        if(dropped.length)compiled.warnings.push('忽略非世界尺度因果偏移：'+dropped.join('、'));
        if(repairs.names.length)compiled.warnings.push('清理局部稳定偏移：'+repairs.names.join('、'));
        return compiled;
    };
