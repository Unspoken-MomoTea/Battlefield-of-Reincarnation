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
