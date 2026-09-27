    const SOFT_MAINTENANCE_RULES=`【分级验收 · 软维护不拒绝整轮】
1. Schema、非法状态、因果引用损坏、明确原著/数据库日期冲突仍属于硬错误；事件排期补全、传闻补齐与传播复核属于软维护，不得仅因软维护未完成而拒绝整轮已合格结果。
2. 事件已有具体时间、有效条件或明确前因任一项，即视为已有可用时间锚点；条件/前因属于合法相对或因果时间，不要求重复补写日期。
3. 公开传闻为空时优先补1条真实世界信息；未补到的分类保留为下轮维护项，不要求为了凑齐传闻重写已经合格的事件、人物、因果等模块。此条取代“空分类本轮必须补2条”的硬验收含义。
4. 纠错只修真正的硬错误或被拒绝片段；已经通过的片段沿用，不要整包重写。`;

    class WorldSoftMaintenancePolicy {
        constructor(timeline=DEFAULT_WORLD_TIMELINE_POLICY){this.timeline=timeline||DEFAULT_WORLD_TIMELINE_POLICY;}

        eventHasUsableSchedule(event) {
            if(!plain(event))return false;
            const raw=this.timeline.eventTimeAnchor(event);
            if(raw&&!VAGUE_EVENT_TIME.test(raw))return true;
            const condition=String(event.条件||'').trim();
            if(condition&&!/^(?:无|暂无|无条件|未知|待定|未定|不详|待确认)$/.test(condition))return true;
            return Array.isArray(event.前因)&&event.前因.some(Boolean);
        }

        unscheduledEvents(stat) {
            return Object.entries(stat?.世界?.[PATH]?.事件||{}).filter(([,event])=>{
                if(!['待发生','进行中'].includes(event?.状态))return false;
                return !this.eventHasUsableSchedule(event);
            }).map(([名称,event])=>({
                名称,分类:event.分类,状态:event.状态,条件:event.条件,
                前因:copy(event.前因||[]),当前时间:this.timeline.eventScheduleLabel(event)
            }));
        }

        ensureEventTimeAnchors(next,required=[]) {
            const missing=[];
            for(const item of required||[]){
                const event=next?.世界?.[PATH]?.事件?.[item.名称];
                if(!event||!['待发生','进行中'].includes(event.状态))continue;
                if(!this.eventHasUsableSchedule(event))missing.push(item.名称);
            }
            return missing;
        }
    }

    const DEFAULT_WORLD_SOFT_MAINTENANCE_POLICY=new WorldSoftMaintenancePolicy();
    let ACTIVE_WORLD_SOFT_MAINTENANCE_POLICY=DEFAULT_WORLD_SOFT_MAINTENANCE_POLICY;
    function eventHasUsableSchedule(event){return ACTIVE_WORLD_SOFT_MAINTENANCE_POLICY.eventHasUsableSchedule(event);}
