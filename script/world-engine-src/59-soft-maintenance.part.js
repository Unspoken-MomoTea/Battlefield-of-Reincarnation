    // 容错验收策略：完整性维护采用渐进补齐，不再让辅助模块拖死整轮世界推进。
    const SOFT_MAINTENANCE_RULES=`【分级验收 · 软维护不拒绝整轮】
1. Schema、非法状态、因果引用损坏、明确原著/数据库日期冲突仍属于硬错误；事件排期补全、传闻补齐与传播复核属于软维护，不得仅因软维护未完成而拒绝整轮已合格结果。
2. 事件已有具体时间、有效条件或明确前因任一项，即视为已有可用时间锚点；条件/前因属于合法相对或因果时间，不要求重复补写日期。
3. 公开传闻为空时优先补1条真实世界信息；未补到的分类保留为下轮维护项，不要求为了凑齐传闻重写已经合格的事件、人物、因果等模块。此条取代“空分类本轮必须补2条”的硬验收含义。
4. 纠错只修真正的硬错误或被拒绝片段；已经通过的片段沿用，不要整包重写。`;

    function eventHasUsableSchedule(event) {
        if(!plain(event))return false;
        const raw=eventTimeAnchor(event);
        if(raw&&!VAGUE_EVENT_TIME.test(raw))return true;
        const condition=String(event.条件||'').trim();
        if(condition&&!/^(?:无|暂无|无条件|未知|待定|未定|不详|待确认)$/.test(condition))return true;
        return Array.isArray(event.前因)&&event.前因.some(Boolean);
    }

    // 统一“显示层”和“验收层”的时间锚点定义：条件/前因本来就能生成合法的因果排期标签。
    unscheduledEvents=function(stat) {
        return Object.entries(stat?.世界?.[PATH]?.事件||{}).filter(([,event])=>{
            if(!['待发生','进行中'].includes(event?.状态))return false;
            return !eventHasUsableSchedule(event);
        }).map(([名称,event])=>({
            名称,分类:event.分类,状态:event.状态,条件:event.条件,
            前因:copy(event.前因||[]),当前时间:eventScheduleLabel(event)
        }));
    };

    // 真正没有任何时间/条件/前因的旧事件仍会进入维护清单，但不再否决本轮其它合格结果。
    ensureEventTimeAnchors=function(next,required=[]) {
        const missing=[];
        for(const item of required||[]){
            const event=next?.世界?.[PATH]?.事件?.[item.名称];
            if(!event||!['待发生','进行中'].includes(event.状态))continue;
            if(!eventHasUsableSchedule(event))missing.push(item.名称);
        }
        return missing;
    };

    const rumorMaintenanceRequirementsBeforeSoftMaintenance=rumorMaintenanceRequirements;
    rumorMaintenanceRequirements=function(stat) {
        const required=rumorMaintenanceRequirementsBeforeSoftMaintenance(stat);
        for(const category of RUMOR_PUBLIC_CATEGORIES){
            const item=required?.公开传闻?.[category];
            if(item&&Number(item.当前数量)===0)item.为空补足=1;
        }
        return required;
    };

    function softRumorMaintenanceIssues(next,required) {
        const result={公开传闻:[],传播链:[]};
        if(!plain(required)||String(next?.世界?.名称||'')!==String(required.世界||'')||String(next?.世界?.时间||'')!==String(required.世界时间||''))return result;
        for(const category of RUMOR_PUBLIC_CATEGORIES){
            const count=Object.keys(plain(next?.传闻?.[category])?next.传闻[category]:{}).length;
            const initial=Number(required?.公开传闻?.[category]?.当前数量)||0;
            if(initial===0&&count===0)result.公开传闻.push(category);
        }
        for(const item of required.本轮必须复核的传播链||[]){
            const record=next?.世界?.[PATH]?.传播?.[item.名称];
            if(!record||propagationEnded(record,worldDateKey(required.世界时间)))continue;
            const updated=String(record.更新时间||'').trim()===String(required.世界时间||'').trim();
            const before=item.当前||{};
            const semantic=['范围','内容','受众','引发行动','状态','到期时间'].some(key=>!same(record?.[key],before?.[key]));
            if(!updated||(item.需语义变化&&!semantic))result.传播链.push(item.名称);
        }
        return result;
    }

    ensureRumorLiveliness=function(next,required) {
        return softRumorMaintenanceIssues(next,required);
    };

    // 请求装饰已迁移至 WorldSoftMaintenanceFeature。\n\n    // 玩家探索是长期/结算台账：实际进入整体地区时自动建立最低10%，离开后不回收。
    const EXPLORATION_PROJECTION_RULES='【玩家探索投影硬约束】实际到达整体区域时至少记录10%探索；远方后台地区不自动投影；离开区域后仍保留探索台账。';
    // 探索粒度、当前地点自动投影与旧档合并已迁入 WorldExplorationService。
    // 长期探索台账仍不进行离场回收。
    pruneColdExploration=function(){return [];};
    // 探索提示词注入由 WorldPromptRegistry 最终装配；不再扩展主类。
