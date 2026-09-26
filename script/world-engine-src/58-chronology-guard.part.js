    // 原著/数据库时间轴保护层：宏观节点先服从权威时间资料，再展开区间细节。
    const CHRONOLOGY_GUARD_RULES=`【原著/数据库时间轴硬约束】
1. 宏观节点的日期与跨度必须先服从当前已确认事实和明确世界书/数据库中的原著时间资料，再使用模型已有原著知识补足；不得为了推动剧情、制造冲突、维持紧张感或让<user>尽快参与而主动提前关键事件。
2. 世界书/数据库已给出某宏观事件的明确日期时，必须沿用该日期/时段；只有已确认剧情造成足以改线的因果偏移，且同轮因果.偏移记录明确关联该节点并说明提前/延后原因时，才允许改期。
3. 原著只给月份、时段、事件顺序或大致间隔时，沿用同级时间精度并按原著节奏保守留白；不确定跨度就使用可理解的相对/因果时间，只推进必要一步，不得擅自补成过近的具体日期。
4. 先确定“当前世界时间 → 下一宏观节点”的合理时间边界，再在该区间内生成当前事件与近期节点；不能先决定下一章要发生什么，再倒推一个过近日期。
5. 3~5个宏观节点只是滚动规划窗口，不代表必须覆盖完整原著篇章。一个宏观节点只表达一个阶段转折；不得为了凑节点数量，把远行、集结、连续战役或多个独立剧情阶段合并成一个节点。
6. 排期相邻宏观节点前，先检查两者之间现实上需要经历的旅行、准备、组织动员、战役推进与因果发展；若中间包含多个独立阶段，就拆分节点或拉开跨度。`;
    const CHRONOLOGY_PRESET_STEP_OLD='Step 2 · 定边界：确认当前阶段与下一宏观节点；只有篇章、地区、战争、势力或关键人物命运发生阶段变化时才调整宏观骨架。';
    const CHRONOLOGY_PRESET_STEP_V1='Step 2 · 定边界与日期：以当前世界时间为起点，先按明确世界书/数据库时间资料与原著节奏确定下一宏观节点及合理跨度；只有已确认因果偏移才能改期，再决定是否调整宏观骨架。';
    const CHRONOLOGY_PRESET_STEP_V2='Step 2 · 定边界与日期：以当前世界时间为起点，按明确资料与原著节奏规划接下来3~5个滚动宏观节点；每个节点只表达一个阶段转折，并为相邻节点间的旅行、准备与因果发展留足时间；只有已确认因果偏移才能改期。';
    const upgradeChronologyPreset=value=>{
        const text=String(value||'');
        for(const previous of [CHRONOLOGY_PRESET_STEP_OLD,CHRONOLOGY_PRESET_STEP_V1])if(text.includes(previous))return text.replace(previous,CHRONOLOGY_PRESET_STEP_V2);
        return text;
    };
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings))BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=upgradeChronologyPreset(BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset);

    let ACTIVE_CHRONOLOGY_GUARD=null;

    function chronologyCompactName(value) {
        return String(value||'').toLowerCase().replace(/[《》【】\[\]()（）“”‘’'"·・:：,，。.!！?？\s_\-\/\\]+/g,'');
    }
    function chronologyEvidenceForEvent(eventName,texts) {
        const name=String(eventName||'').trim();if(!name)return null;
        // 只把“明确到日”的资料作为硬校验锚点。月份、上中下旬、先后顺序属于软规划证据，
        // 交给模型保守排期，避免合理估计差异造成无休止的拒绝/重试。
        const datePattern=/(\d{1,4}\s*年\s*-?\s*\d{1,2}\s*月\s*-?\s*\d{1,2}\s*日|\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/g;
        let best=null;
        for(const rawText of texts||[]){
            const text=String(rawText||'');if(!text)continue;
            let at=text.indexOf(name),fromIndex=0;
            while(at>=0){
                const left=Math.max(0,at-180),right=Math.min(text.length,at+name.length+180),window=text.slice(left,right),center=at-left+name.length/2;
                datePattern.lastIndex=0;let match;
                while((match=datePattern.exec(window))){
                    const key=worldDateKey(match[0]);if(key===null)continue;
                    const distance=Math.abs((match.index+match[0].length/2)-center);
                    if(!best||distance<best.distance)best={raw:match[0],key,distance};
                }
                fromIndex=at+Math.max(1,name.length);at=text.indexOf(name,fromIndex);
            }
        }
        return best;
    }
    function chronologyShiftDeclared(stat,result,eventName) {
        const target=chronologyCompactName(eventName);if(!target)return false;
        const records=[];
        for(const [name,item] of Object.entries(stat?.世界?.因果轨道?.偏移记录||{}))records.push({名称:name,...(plain(item)?item:{})});
        for(const item of result?.因果?.偏移记录||[])if(plain(item))records.push(item);
        return records.some(item=>{
            if(Number(item?.影响程度)===0)return false;
            const marker=chronologyCompactName(item?.名称),desc=String(item?.描述||'');
            const directlyRelated=(marker&&(marker.includes(target)||target.includes(marker)))||desc.includes(String(eventName||''));
            return directlyRelated&&/(提前|提早|延后|推迟|改期|时序|时间线|日期|进程|节点)/.test(String(item?.名称||'')+desc);
        });
    }
    function validateChronologyResult(stat,result) {
        const guard=ACTIVE_CHRONOLOGY_GUARD;if(!guard?.books?.length)return;
        const events=stat?.世界?.[PATH]?.事件||{};
        for(const event of result?.事件||[]){
            if(!plain(event)||event.操作==='撤销本轮')continue;
            const storedName=stableNameIn(events,String(event.名称||'')),stored=storedName?events[storedName]:null;
            const category=String(event.分类||stored?.分类||'');
            const status=String(event.状态||stored?.状态||'待发生');
            if(category!=='宏观节点'||status!=='待发生')continue;
            if(!Object.hasOwn(event,'时间')&&!Object.hasOwn(event,'开始时间'))continue;
            const evidence=chronologyEvidenceForEvent(event.名称,guard.books);if(!evidence)continue;
            if(chronologyShiftDeclared(stat,result,event.名称))continue;
            const proposedRaw=String(event.时间||event.开始时间||'').trim(),proposed=worldDateKey(proposedRaw);
            if(proposed===null)throw new Error('宏观节点日期未服从原著/数据库时间锚点：'+event.名称+'；资料明确为 '+evidence.raw+'，不得改成模糊或不可比较时间。若已确认因果偏移导致改期，必须同轮提交明确关联该节点的因果.偏移记录。');
            if(Math.floor(proposed/24)!==Math.floor(evidence.key/24))throw new Error('宏观节点日期与原著/数据库时间锚点冲突：'+event.名称+' 提交 '+proposedRaw+'，资料明确为 '+evidence.raw+'；不得为了推进剧情提前或压缩原著时间。若已确认因果偏移导致改期，必须同轮提交明确关联该节点的因果.偏移记录。');
        }
    }

    const compileWorldResultBeforeChronologyGuard=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=normalizeWorldResult(value);
        validateChronologyResult(stat,result);
        return compileWorldResultBeforeChronologyGuard(stat,result);
    };

    const retryPlanBeforeChronologyGuard=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        const plan=retryPlanBeforeChronologyGuard(error,rejected).map(String);
        const messages=[String(error?.message||error||''),...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
        if(/宏观节点日期(?:未服从|与).*原著\/数据库时间锚点/.test(messages))plan.unshift('宏观时间轴：只纠正已明确到日的原著/数据库日期冲突；重新沿用该日期。不要顺带把仅有月份、时段或先后顺序的节点强行精确到日，后者按原著节奏保守留白即可。');
        return Array.from(new Set(plan));
    };

    // 时间轴请求装饰与默认预设迁移已迁移至 WorldChronologyFeature。
