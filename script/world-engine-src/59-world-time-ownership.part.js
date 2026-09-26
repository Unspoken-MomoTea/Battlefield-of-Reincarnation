    // 世界时间单一所有权：世界推进 AI 负责初始化/推进世界.时间；变量 AI 的写入在事件层被回滚。
    const WORLD_TIME_RULES=`【世界时间所有权】
1. 世界.时间由世界推进独占维护。顶层“时间”只用于初始化或实际推进当前世界时钟；人物更新时间、事件计划时间不能代替世界时钟。
2. 当前时间为空/待初始化时，先用“最新已确认正文 + 当前阶段 + 当前地点”定位玩家此刻处于任务世界时间线的哪个位置，再对照已读取的时间线/年表/章节资料建立当前时间锚点。下一宏观节点、任务期限和未来事件日期只能作为未来边界，禁止直接拿来当当前时间。
3. 资料只能确定年份、月份、季节、阶段或时段时保持同级精度，不为格式完整编造月日；明确资料与当前剧情无法唯一对应时，宁可保留较粗时间，也不要伪造精确日期。
4. 每轮先对比最新正文与现有世界.时间。正文明确发生过夜、数小时后、次日、跨日旅行，或明确出现新的日期/时段时，必须提交顶层“时间”同步推进；禁止保持旧世界时钟，却把已经发生的事件/人物动态写到旧时钟之后。
5. 精确到月日时统一写 {yyy}年-{mm}月-{dd}日-{时间段}；月份必须为数字。时间段只能选：凌晨 / 黎明 / 清晨 / 早晨 / 上午 / 中午 / 午后 / 下午 / 傍晚 / 入夜 / 晚上 / 深夜。不要输出“夜晚/黄昏/早上”等其它同义词。
6. 时间段是粗粒度时间锚点，不是每轮计数器。没有足够时间流逝跨过当前时段时，省略“时间”并保持原值；只有正文或明确时间资料表明确实经过了合理时长，才推进到后续时段或日期。禁止仅因本轮执行了世界推进就机械跳时段。
7. 世界时间不得回退，也不得把待发生事件的计划时间提前写成当前时间。人物/地区等“更新时间”由程序按本轮最终世界时间统一盖章。从主神空间进入新副本时，程序会先清空世界.时间与旧历法；必须把这视为全新世界的时间初始化，严禁继承上一副本或主神空间“轮回历”的日期。`;

    const MACHINE_TIME_DESCRIPTION='精确到月日时使用 {yyy}年-{mm}月-{dd}日-{时间段}；时间段仅限：凌晨/黎明/清晨/早晨/上午/中午/午后/下午/傍晚/入夜/晚上/深夜；只能确定季节/阶段时可保留粗粒度。';
    WORLD_RESULT_SCHEMA.properties.时间={type:'string',minLength:1,description:'当前世界时间。'+MACHINE_TIME_DESCRIPTION};
    if(EVENT_RESULT_SCHEMA?.properties){
        for(const key of ['时间','开始时间','预计结束','更新时间','下次检查'])if(EVENT_RESULT_SCHEMA.properties[key])EVENT_RESULT_SCHEMA.properties[key].description=MACHINE_TIME_DESCRIPTION;
    }

    function worldTimeUnset(value) {
        const raw=String(value??'').trim();
        return !raw||raw==='待初始化';
    }
    function worldTimeIdentity(value) {
        return String(value??'').trim().replace(/[\s·・_—–-]+/g,'');
    }
    function worldTimeClaimsMonthDay(value) {
        const source=String(value??'').trim();
        return !!source&&/月/.test(source)&&/(?:第\s*)?\d{1,2}\s*日/.test(source);
    }
    function worldTimeCalendarFor(stat,result) {
        return plain(result?.历法)?result.历法:(plain(stat?.世界?.历法)?stat.世界.历法:{});
    }
    function assertCalendarCompatibleTimeValue(stat,result,value,label='时间') {
        const raw=String(value??'').trim();
        if(!worldTimeClaimsMonthDay(raw))return;
        if(calendarDate(raw,worldTimeCalendarFor(stat,result)))return;
        throw new Error(label+'格式无法用于日历：'+raw+'。精确到月日时请使用 {yyy}年-{mm}月-{dd}日-{时间段}；不要用月份名称替代数字月。');
    }
    function assertCalendarCompatibleWorldResultTimes(stat,result) {
        const temporalKeys=new Set(['时间','开始时间','预计结束','更新时间','到期时间','下次检查','开始','结束','期限','获知时间']);
        const walk=(value,path=[])=>{
            if(Array.isArray(value)){for(let i=0;i<value.length;i++)walk(value[i],path.concat(i));return;}
            if(!plain(value))return;
            for(const [key,child] of Object.entries(value)){
                const nextPath=path.concat(key);
                if(typeof child==='string'&&temporalKeys.has(key))assertCalendarCompatibleTimeValue(stat,result,child,nextPath.join('.'));
                else if(child&&typeof child==='object')walk(child,nextPath);
            }
        };
        walk(result);
    }
    function inferWorldTimeFromCurrentActivities(result) {
        const candidates=new Map();
        for(const item of result?.人物||[]){
            if(!plain(item)||item.操作==='撤销本轮')continue;
            const activeFacts=String(item.地点||'').trim()&&String(item.目标||'').trim()&&String(item.行动||'').trim();
            const raw=String(item.更新时间||'').trim();
            if(!activeFacts||!raw)continue;
            const key=worldTimeIdentity(raw);if(key&&!candidates.has(key))candidates.set(key,raw);
        }
        return candidates.size===1?Array.from(candidates.values())[0]:'';
    }
    function resolveWorldTimeProposal(stat,result) {
        const explicit=String(result?.时间||'').trim();
        if(explicit)return explicit;
        if(!worldTimeUnset(stat?.世界?.时间))return '';
        return inferWorldTimeFromCurrentActivities(result);
    }
    function assertWorldTimeNotBackwards(stat,nextTime) {
        const current=String(stat?.世界?.时间||'').trim();
        if(worldTimeUnset(current)||!nextTime)return;
        const before=worldDateKey(current),after=worldDateKey(nextTime);
        if(before!==null&&after!==null&&after<before)throw new Error('世界时间不可回退：'+current+' -> '+nextTime);
    }

    const normalizeWorldResultBeforeWorldTimeOwnership=normalizeWorldResult;
    normalizeWorldResult=function(value) {
        const result=normalizeWorldResultBeforeWorldTimeOwnership(value);
        if(plain(value)&&Object.hasOwn(value,'时间')){
            const time=String(value.时间??'').trim();
            if(time)result.时间=time;
        }
        return result;
    };

    const mergeWorldResultsBeforeWorldTimeOwnership=mergeWorldResults;
    mergeWorldResults=function(base,incoming) {
        const result=mergeWorldResultsBeforeWorldTimeOwnership(base,incoming);
        const a=base?normalizeWorldResult(base):null,b=normalizeWorldResult(incoming);
        if(Object.hasOwn(b,'时间'))result.时间=b.时间;
        else if(a&&Object.hasOwn(a,'时间'))result.时间=a.时间;
        return result;
    };

    const worldResultFragmentsBeforeWorldTimeOwnership=worldResultFragments;
    worldResultFragments=function(value) {
        const result=normalizeWorldResult(value),split=worldResultFragmentsBeforeWorldTimeOwnership(result);
        if(Object.hasOwn(result,'时间'))split.fragments.unshift({label:'时间',result:{摘要:'',时间:result.时间}});
        return split;
    };

    const allowedBeforeWorldTimeOwnership=allowed;
    allowed=function(parts,stat) {
        if(Array.isArray(parts)&&parts.length===2&&parts[0]==='世界'&&parts[1]==='时间')return true;
        return allowedBeforeWorldTimeOwnership(parts,stat);
    };

    const compileWorldResultBeforeWorldTimeOwnership=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=normalizeWorldResult(value),proposal=resolveWorldTimeProposal(stat,result);
        if(proposal)result.时间=proposal;
        assertCalendarCompatibleWorldResultTimes(stat,result);
        if(proposal)assertWorldTimeNotBackwards(stat,proposal);

        // 本轮顶层时间是整份 WorldResult 的事务基准。先把候选时间放进校验快照，
        // 再校验同轮事件/人物/地区/历史/传播，避免“新时间尚未落库 → 新时间下的事实被误判为未来”的死锁。
        const validationStat=proposal?copy(stat):stat;
        if(proposal){
            if(!plain(validationStat.世界))validationStat.世界={};
            validationStat.世界.时间=proposal;
        }
        const compiled=compileWorldResultBeforeWorldTimeOwnership(validationStat,result);
        if(proposal){
            const old=stat?.世界?.时间;
            if(String(old??'')!==proposal)compiled.patches.unshift({op:old===undefined?'add':'replace',path:'/世界/时间',value:proposal});
            compiled.result.时间=proposal;
        }
        return compiled;
    };

    if(Array.isArray(WORLD_REPLAY_SCOPES)&&!WORLD_REPLAY_SCOPES.some(scope=>scope.length===2&&scope[0]==='世界'&&scope[1]==='时间'))WORLD_REPLAY_SCOPES.unshift(['世界','时间']);

        // Phase 5: 主类继承层已迁移到 src/WorldEngine/runtime/；本文件仅保留协议常量与纯函数。
