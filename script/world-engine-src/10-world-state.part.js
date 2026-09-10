    const RECORDS = {
        事件: { 描述:'', 时间:'', 条件:'', 前因:[], 状态:'待发生', 默认走向:'', 结果:'', 公开征兆:'', 地点:'' },
        人物: { 所属世界:'', 地点:'', 目标:'', 行动:'', 认知:[], 下次检查:'', 关联事件:[], 公开动态:'' },
        势力地区: { 类型:'地区', 描述:'', 目标:'', 进展:'', 下次检查:'', 关联事件:[], 公开动态:'' },
        剧本: { 描述:'', 关联任务:[], 前置条件:'', 下一节点:'', 关联事件:[], 公开动态:'' },
        历史: { 时间:'', 事实:'', 关联事件:[] },
        传播: { 关联事件:[], 来源:'', 范围:'', 时间:'', 内容:'', 真相:'', 状态:'传播中' }
    };
    // 可选明细兼容第一版记录：对应参考助手的行程、承诺、认知、资源及任务阶段。
    const DETAILS = {
        事件: {分类:'',开始时间:'',预计结束:'',更新时间:'',下次检查:'',参与者:[],关联任务:[],可见影响:[{时间:'',地点:'',影响:''}]},
        人物: {状态:'',更新时间:'',开始时间:'',预计结束:'',行程:[{开始:'',结束:'',地点:'',行动:'',状态:'',结果:''}],承诺:[{对象:'',内容:'',期限:'',解除条件:''}],待决事项:[{问题:'',选项:[],等待:''}],关系变化:[{对象:'',关系:'',变化:'',时间:''}],认知来源:[{事实:'',来源:'',获知时间:'',状态:''}],登场条件:'',背景关联:[{类型:'',名称:'',关系:''}]},
        势力地区: {更新时间:'',控制方:'',争夺方:[],资源:[{名称:'',数量:'',用途:'',限制:''}],内部派系:[{名称:'',立场:'',行动:'',影响:''}],近期变化:[{时间:'',事实:'',关联事件:''}],环境状态:[],现场群体:[{名称:'',规模:'',身份:'',动态:''}],资源点:[{名称:'',类型:'',状态:'',控制方:'',动态:''}]},
        剧本: {状态:'',来源:'',更新时间:'',期限:'',完成条件:'',失败条件:'',结果:'',参与者:[],地点:[],阻碍:[],阶段:[{名称:'',状态:'',时间:'',说明:'',前置阶段:''}]},
        历史:{},传播:{更新时间:'',到期时间:'',受众:[],引发行动:[]}
    };
    const MODEL_RECORDS = Object.fromEntries(Object.entries(RECORDS).filter(([name])=>name!=='剧本'));
    const MODEL_DETAILS = copy(DETAILS);
    delete MODEL_DETAILS.剧本;
    delete MODEL_DETAILS.事件.关联任务;
    for (const key of ['承诺','待决事项','关系变化']) delete MODEL_DETAILS.人物[key];

    function derivePersonWorldContext(stat, personName, playerName='') {
        const backend=stat?.世界?.[PATH]||{},people=backend.人物||{},areas=backend.势力地区||{};
        const key=value=>String(value||'').toLowerCase().replace(/[\/／·・._\-\s]+/g,'');
        const normalizedName=key(personName);
        const pair=Object.entries(people).find(([name])=>key(name)===normalizedName);
        const person=pair?.[1]||{},location=String(person.地点||'').trim();
        const related=(a,b)=>{
            const x=key(a),y=key(b);if(!x||!y)return false;
            return x===y||x.includes(y)||y.includes(x);
        };
        const areaPair=Object.entries(areas)
            .filter(([,area])=>plain(area)&&area.类型!=='势力'&&related(location,area?.名称||''))
            .sort((a,b)=>String(b[0]).length-String(a[0]).length)[0]
            ||Object.entries(areas)
                .filter(([name,area])=>plain(area)&&area.类型!=='势力'&&related(location,name))
                .sort((a,b)=>String(b[0]).length-String(a[0]).length)[0];
        const areaName=String(areaPair?.[0]||''),area=areaPair?.[1]||{};
        const relationByKey=new Map(Object.entries(stat?.关系列表||{}).map(([name,record])=>[key(name),{名称:name,记录:record}]));
        const alienByKey=new Map(Object.entries(stat?.世界?.异端雷达?.名单||{}).map(([name,record])=>[key(name),record]));
        const playerKeys=new Set([playerName,'{{user}}','<user>','玩家'].filter(Boolean).map(key));
        const nearby=Object.entries(people)
            .filter(([name,other])=>{
                const otherKey=key(name);if(!plain(other)||otherKey===normalizedName||playerKeys.has(otherKey))return false;
                if(alienByKey.get(otherKey)?.状态==='死亡')return false;
                const otherLocation=String(other.地点||'').trim();if(!otherLocation)return false;
                return areaName?related(otherLocation,areaName):related(otherLocation,location);
            })
            .map(([name,other])=>{
                const profile=relationByKey.get(key(name));
                const relation=profile?.记录||{};
                const identity=Array.isArray(relation.身份)?relation.身份[0]:String(relation.身份||'');
                return {
                    名称:String(name),
                    关系:key(other.地点)===key(location)?'贴身':'同地区',
                    身份:identity,
                    行动:String(other.行动||other.公开动态||relation.态度||''),
                    可查看档案:!!profile,
                    档案名称:String(profile?.名称||'')
                };
            })
            .slice(0,8);
        const objectList=(value,limit=8)=>Array.isArray(value)?value.filter(plain).slice(0,limit).map(copy):[];
        return {
            地区:areaName,
            地区动态:String(area.公开动态||area.进展||''),
            控制方:String(area.控制方||''),
            争夺方:Array.isArray(area.争夺方)?area.争夺方.filter(Boolean).slice(0,6):[],
            环境状态:Array.isArray(area.环境状态)?area.环境状态.filter(Boolean).slice(0,6):[],
            背景关联:objectList(person.背景关联,8),
            关联事件:Array.isArray(person.关联事件)?person.关联事件.filter(Boolean).slice(0,8):[],
            身边人物:nearby,
            现场群体:objectList(area.现场群体,8),
            资源点:objectList(area.资源点,8)
        };
    }

    function collectEventRefs(state) {
        const refs=new Set();
        for(const event of Object.values(state.事件||{}))for(const id of event.前因||[])refs.add(id);
        for(const category of ['人物','势力地区','传播'])for(const record of Object.values(state[category]||{}))for(const id of record.关联事件||[])refs.add(id);
        return refs;
    }
    function detachEventSoftRefs(state,eventName) {
        const changed=[];
        for(const category of ['人物','势力地区','传播']){
            for(const [name,record] of Object.entries(state?.[category]||{})){
                if(!Array.isArray(record?.关联事件)||!record.关联事件.includes(eventName))continue;
                record.关联事件=record.关联事件.filter(id=>id!==eventName);
                changed.push(category+'/'+name);
            }
        }
        return changed;
    }
    function archiveFinishedEvent(stat,state,name,event,archived) {
        let key='归档·'+name,seq=2;
        while(Object.hasOwn(state.历史||{},key))key='归档·'+name+'#'+seq++;
        state.历史=state.历史||{};
        state.历史[key]={
            时间:event.更新时间||event.预计结束||event.时间||stat.世界.时间||'',
            事实:event.结果||event.描述||(event.状态==='已取消'?'事件已取消':'事件已结束'),
            关联事件:[]
        };
        delete state.事件[name];
        archived.push(name);
    }
    function propagationEnded(record,nowKey) {
        if(!plain(record))return true;
        const status=String(record.状态||'').trim();
        if(/^(?:已结束|结束|已停止|停止|已失效|失效|已过期|过期|传播结束)$/.test(status))return true;
        const expiry=worldDateKey(record.到期时间);
        return expiry!==null&&nowKey!==null&&expiry<=nowKey;
    }
    function pruneSoftRefsToColdFinishedEvents(state,now) {
        if(now===null)return [];
        const cold=new Set();
        for(const [name,event] of Object.entries(state?.事件||{})){
            if(!['已完成','已取消'].includes(event?.状态))continue;
            const endedAt=worldDateKey(event.更新时间||event.预计结束||event.时间);
            if(endedAt!==null&&now-endedAt>=FINISHED_EVENT_GRACE_HOURS)cold.add(name);
        }
        if(!cold.size)return [];
        const changed=[];
        for(const eventName of cold)changed.push(...detachEventSoftRefs(state,eventName));
        // 已结束且同样进入冷区的事件之间不再互相作为热前因引用；
        // 活跃/未来事件的前因仍保留，因此不会破坏仍在推进的因果链。
        for(const [name,event] of Object.entries(state?.事件||{})){
            if(!cold.has(name)||!Array.isArray(event?.前因)||!event.前因.some(id=>cold.has(id)))continue;
            event.前因=event.前因.filter(id=>!cold.has(id));
            changed.push('事件/'+name);
        }
        return changed;
    }
    function compactFinishedEvents(stat,target=EVENT_TARGET) {
        const state=stat?.世界?.[PATH]; if(!state?.事件)return [];
        const archived=[],now=worldDateKey(stat?.世界?.时间);
        pruneSoftRefsToColdFinishedEvents(state,now);
        const protectedNames=new Set(storyStages(stat?.世界?.因果轨道?.故事线));
        let refs=collectEventRefs(state);
        const finished=()=>Object.entries(state.事件||{}).filter(([name,event])=>['已完成','已取消'].includes(event.状态)&&!refs.has(name)&&!protectedNames.has(name));
        // 有明确时间的旧结束事件，在经过一个世界日后直接冷归档；刚刚结束的内容至少保留到下一阶段。
        for(const [name,event] of finished()){
            const endedAt=worldDateKey(event.更新时间||event.预计结束||event.时间);
            if(now!==null&&endedAt!==null&&now-endedAt>=FINISHED_EVENT_GRACE_HOURS)archiveFinishedEvent(stat,state,name,event,archived);
        }
        // 无法比较作品内时间时，用“最多保留最近8条结束事件”兜底，避免长期无限增长。
        refs=collectEventRefs(state);
        let candidates=finished();
        while(candidates.length>RECENT_FINISHED_EVENT_TARGET){
            const [name,event]=candidates[0];
            archiveFinishedEvent(stat,state,name,event,archived);
            refs=collectEventRefs(state);candidates=finished();
        }
        // 旧存档超大时继续沿用硬上限兜底，只回收无引用的结束事件。
        while(Object.keys(state.事件||{}).length>target){
            refs=collectEventRefs(state);
            const candidate=Object.entries(state.事件||{}).find(([name,event])=>['已完成','已取消'].includes(event.状态)&&!refs.has(name));
            if(!candidate)break;
            archiveFinishedEvent(stat,state,candidate[0],candidate[1],archived);
        }
        const historyKeys=Object.keys(state.历史||{});
        if(historyKeys.length>HISTORY_TARGET)for(const key of historyKeys.slice(0,historyKeys.length-HISTORY_TARGET))delete state.历史[key];
        return archived;
    }
    function compactWorldLifecycle(stat) {
        const state=stat?.世界?.[PATH];
        if(!state)return {归档事件:[],回收传播:[],回收人物:[]};
        const now=worldDateKey(stat?.世界?.时间),removed=[];
        for(const [name,record] of Object.entries(state.传播||{})){
            if(propagationEnded(record,now)){delete state.传播[name];removed.push(name);}
        }
        const archived=compactFinishedEvents(stat);
        const removedPeople=pruneColdTemporaryPeople(stat);
        return {归档事件:archived,回收传播:removed,回收人物:removedPeople};
    }
    function storyStages(value) {
        return String(value||'').split(/\s*(?:→|⇒|->|=>|\n)\s*/).map(x=>x.trim()).filter(x=>x&&!/^(待初始化|无|未知)$/.test(x));
    }
    const VAGUE_EVENT_TIME=/^(?:近期|稍后|未来|之后|待定|未定|未知|不详|待确认|时间未定|日期未定)$/;
    function eventTimeAnchor(event) {
        return String(event?.时间||event?.开始时间||'').trim();
    }
    function eventScheduleLabel(event) {
        const raw=eventTimeAnchor(event);
        if(raw&&!VAGUE_EVENT_TIME.test(raw))return raw;
        const condition=String(event?.条件||'').trim();
        if(condition)return '条件触发 · '+condition;
        const predecessors=Array.isArray(event?.前因)?event.前因.filter(Boolean):[];
        if(predecessors.length)return '前置节点后 · '+predecessors.join('、');
        return '时间待补';
    }
    const STALE_CURRENT_EVENT_HOURS=7*24;
    const STALE_NEAR_EVENT_HOURS=30*24;
    function staleActiveEvents(stat) {
        const now=worldDateKey(stat?.世界?.时间);if(now===null)return [];
        const out=[];
        for(const [名称,event] of Object.entries(stat?.世界?.[PATH]?.事件||{})){
            if(event?.状态!=='进行中'||event?.分类==='宏观节点')continue;
            const touched=worldDateKey(event.更新时间||event.时间||event.开始时间);
            if(touched===null)continue;
            const threshold=event.分类==='当前事件'?STALE_CURRENT_EVENT_HOURS:STALE_NEAR_EVENT_HOURS;
            const age=now-touched;
            if(age>threshold)out.push({名称,分类:event.分类,状态:event.状态,时间:event.时间||event.开始时间||'',更新时间:event.更新时间||'',已陈旧小时:age,说明:'局部活动长期停留在进行中；应结束/取消，或确认仍持续并更新到当前世界时间、当前进展与下次检查。'});
        }
        return out;
    }
    function temporalAnomalies(stat) {
        const now=worldDateKey(stat?.世界?.时间);if(now===null)return [];
        const state=stat?.世界?.[PATH]||{},out=[];
        const push=(类型,名称,字段,值,原因)=>{
            const key=worldDateKey(值);if(key!==null&&key>now)out.push({类型,名称,字段,值:String(值||''),原因});
        };
        for(const [name,event] of Object.entries(state.事件||{})){
            if(['进行中','已完成'].includes(event?.状态))push('事件',name,'时间',event.时间||event.开始时间,'已发生/进行中的事件不能晚于当前世界时间');
            if(event?.更新时间)push('事件',name,'更新时间',event.更新时间,'事件更新时间不能晚于当前世界时间');
        }
        for(const [name,person] of Object.entries(state.人物||{}))if(person?.更新时间)push('人物',name,'更新时间',person.更新时间,'人物当前动态不能来自未来');
        for(const [name,area] of Object.entries(state.势力地区||{})){
            if(area?.更新时间)push('势力地区',name,'更新时间',area.更新时间,'地区当前状态不能来自未来');
            for(const change of area?.近期变化||[])if(change?.时间)push('势力地区',name,'近期变化.时间',change.时间,'已经发生的地区变化不能来自未来');
        }
        for(const [name,item] of Object.entries(state.历史||{}))if(item?.时间)push('历史',name,'时间',item.时间,'历史事实不能晚于当前世界时间');
        for(const [name,item] of Object.entries(state.传播||{}))if(item?.时间)push('传播',name,'时间',item.时间,'已经开始传播的信息不能晚于当前世界时间');
        return out;
    }
    function validateTemporalWrites(before,next,patches) {
        const touched=new Set();
        for(const patch of patches||[]){
            let parts;try{parts=tokens(patch.path);}catch(_){continue;}
            if(parts[0]!=='世界'||parts[1]!==PATH)continue;
            if(['事件','人物','势力地区','历史','传播'].includes(parts[2])&&parts[3])touched.add(parts[2]+'\u0000'+parts[3]);
        }
        if(!touched.size)return;
        const all=temporalAnomalies(next);
        const hit=all.find(item=>touched.has(item.类型+'\u0000'+item.名称));
        if(hit)throw new Error('时间事实超过当前世界时间：'+hit.类型+'/'+hit.名称+' '+hit.字段+'='+hit.值+'；'+hit.原因);
    }
    function eventDisplayBucket(event) {
        if(event?.状态==='进行中')return 0;
        if(event?.状态==='待发生'&&event?.分类==='当前事件')return 1;
        if(event?.状态==='待发生'&&event?.分类==='近期节点')return 2;
        if(event?.状态==='待发生'&&event?.分类==='宏观节点')return 3;
        if(event?.状态==='已完成')return 4;
        if(event?.状态==='已取消')return 5;
        return 6;
    }
    function sortWorldEvents(records,orbit={}) {
        const storyIndex=new Map(storyStages(orbit?.故事线).map((name,index)=>[nameKey(name),index]));
        return Object.entries(records||{}).sort((a,b)=>{
            const bucket=eventDisplayBucket(a[1])-eventDisplayBucket(b[1]);if(bucket)return bucket;
            if(a[1]?.分类==='宏观节点'&&b[1]?.分类==='宏观节点'){
                const ai=storyIndex.get(nameKey(a[0])),bi=storyIndex.get(nameKey(b[0]));
                if(ai!==undefined||bi!==undefined){
                    if(ai===undefined)return 1;
                    if(bi===undefined)return -1;
                    if(ai!==bi)return ai-bi;
                }
            }
            const da=worldDateKey(a[1]?.时间||a[1]?.开始时间),db=worldDateKey(b[1]?.时间||b[1]?.开始时间);
            if(da!==db)return (da??Infinity)-(db??Infinity);
            return String(a[0]).localeCompare(String(b[0]),'zh-CN');
        });
    }
    function repairCausalProjection(stat) {
        const orbit=stat.世界.因果轨道||(stat.世界.因果轨道={当前阶段:'',故事线:'',下一节点:'',偏移记录:{}});
        const existing=storyStages(orbit.故事线);
        const macroEntries=Object.entries(stat.世界[PATH]?.事件||{})
            .filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消')
            .map((item,index)=>({item,index,key:worldDateKey(item[1].时间||item[1].开始时间)}))
            .sort((a,b)=>(a.key??Infinity)-(b.key??Infinity)||a.index-b.index)
            .map(x=>x.item);
        const macroNames=new Set(macroEntries.map(([name])=>name));
        const patches=[];
        let line=[];
        const existingValid=existing.length>=3&&existing.length<=5&&existing.every(name=>macroNames.has(name));
        if(existingValid)line=existing.slice(0,5);
        else {
            // 因果轨道只能由宏观事件投影。宏观事实不足时宁可等待模型补齐，
            // 也不能拿当前事件/近期节点凑出一条“看似完整”的故事线。
            if(macroEntries.length<3)return patches;
            const chosen=[],seen=new Set();
            const take=name=>{if(name&&macroNames.has(name)&&!seen.has(name)){seen.add(name);chosen.push(name);}};
            take(orbit.当前阶段);
            for(const [name] of macroEntries)take(name);
            if(chosen.length<3)return patches;
            line=chosen.slice(0,5);
            const story=line.join(' -> ');
            if(orbit.故事线!==story){orbit.故事线=story;patches.push({op:'replace',path:'/世界/因果轨道/故事线',value:story});}
        }
        const nextName=line.find(name=>(stat.世界[PATH].事件[name]||{}).状态==='待发生')||'';
        if(orbit.下一节点!==nextName){orbit.下一节点=nextName;patches.push({op:'replace',path:'/世界/因果轨道/下一节点',value:nextName});}
        const current=line.find(name=>(stat.世界[PATH].事件[name]||{}).状态==='进行中');
        if(current&&(!orbit.当前阶段||orbit.当前阶段==='待初始化')){orbit.当前阶段=current;patches.push({op:'replace',path:'/世界/因果轨道/当前阶段',value:current});}
        return patches;
    }
    function timelineState(stat) {
        const state=stat.世界[PATH],events=Object.entries(state.事件||{}),now=worldDateKey(stat.世界.时间);
        const waiting=events.filter(([,e])=>['待发生','进行中'].includes(e.状态));
        const near=events.filter(([,e])=>['当前事件','近期节点'].includes(e.分类));
        const macro=events.filter(([,e])=>e.分类==='宏观节点');
        const macroFuture=macro.filter(([,e])=>e.状态==='待发生');
        const macroOpen=macro.filter(([,e])=>['进行中','待发生'].includes(e.状态));
        const expand=macroFuture.filter(([,e])=>{const t=worldDateKey(e.时间||e.开始时间);return now!==null&&t!==null&&t>=now&&t-now<=7*24;});
        const semantic=waiting.filter(([,e])=>String(e.时间||e.开始时间||'').trim()&&worldDateKey(e.时间||e.开始时间)===null);
        const orbit=stat.世界.因果轨道||{},orbitStages=storyStages(orbit.故事线);
        const macroNames=new Set(macro.map(([name])=>name));
        const orbitProjectionInvalid=orbitStages.length<3||orbitStages.length>5||orbitStages.some(name=>!macroNames.has(name));
        const orbitMacro=macroFuture.find(([name])=>name===orbit.下一节点);
        const datedMacro=macroFuture.map((item,index)=>({item,index,key:worldDateKey(item[1].时间||item[1].开始时间)}))
            .filter(x=>x.key!==null&&(now===null||x.key>=now))
            .sort((a,b)=>a.key-b.key||a.index-b.index);
        const nextPair=orbitMacro||datedMacro[0]?.item||macroFuture[0]||null;
        const nextMacro=nextPair?{
            名称:nextPair[0],
            时间:nextPair[1].时间||nextPair[1].开始时间||'',
            分类:nextPair[1].分类||'',
            条件:nextPair[1].条件||'',
            前因:nextPair[1].前因||[],
            来源:'宏观事件图'
        }:null;
        return {
            当前时间锚点:stat.世界.时间,
            因果轨道节点数:orbitStages.length,
            因果轨道需重建:orbitProjectionInvalid,
            需要初始化:near.length===0&&macro.length===0,
            当前活动事件数:waiting.filter(([,e])=>e.状态==='进行中').length,
            近期节点数:near.length,
            宏观节点数:macro.length,
            需要补充远期:macroOpen.length<3,
            下一宏观节点:nextMacro,
            桥接区间:{
                起点:stat.世界.时间,
                终点:nextMacro?.时间||'待建立宏观节点',
                边界事件:nextMacro?.名称||''
            },
            需要展开的宏观节点:expand.map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,前因:e.前因})),
            需语义复核节点:semantic.map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,下次检查:e.下次检查})),
            说明:'先用因果轨道、当前事实与模型已有世界/原著知识建立宏观骨架；世界书若存在只作补充校正。随后仅展开当前时间到下一宏观节点之间的近期事件、人物、势力与传播。非公历或作品内时间按作品语义比较，不强行改写为公历。'
        };
    }
    function emptyState() {
        return { 版本:4, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 剧本:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[] };
    }
    // 只拆显式分隔的阶段，不把自然语言段落猜成多个事件，也不凭空分配日期。
    function importStory(stat) {
        const orbit=stat.世界.因果轨道||{},events=stat.世界.后台?.事件||{};
        if(Object.values(events).some(e=>e.分类==='主线节点'))return [];
        const stages=storyStages(orbit.故事线);
        if(stages.length<2||stages.length>30)return [];
        const index=stages.findIndex(n=>n===orbit.下一节点);
        const remaining=index>=0?stages.slice(index):stages;
        let previous='';
        return remaining.filter(name=>!Object.hasOwn(events,name)).map(name=>{
            const value={...copy(RECORDS.事件),描述:name,分类:'主线节点',前因:previous?[previous]:[],条件:previous?'前置节点「'+previous+'」达到进入本阶段所需的条件':'待依据世界设定与正文明确触发条件',下次检查:'本轮首次排程'};
            previous=name;
            return {op:'add',path:'/世界/后台/事件/'+name.replace(/~/g,'~0').replace(/\//g,'~1'),value};
        });
    }
    function tokens(path) {
        if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('补丁路径必须以 / 开头');
        const parts = path.slice(1).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
        if (parts.some(p => !p || forbidden.has(p))) throw new Error('补丁路径含非法键');
        return parts;
    }
    function get(obj, parts) {
        return parts.reduce((v, key) => v != null && Object.prototype.hasOwnProperty.call(v, key) ? v[key] : undefined, obj);
    }
    function pointer(parts) {
        return '/'+parts.map(p=>String(p).replace(/~/g,'~0').replace(/\//g,'~1')).join('/');
    }
    const nameKey=value=>String(value||'').toLowerCase().replace(/[\\/／·・._\-\s]+/g,'');
    function stableNameIn(bucket,name) {
        if(!plain(bucket))return '';
        if(Object.hasOwn(bucket,name))return name;
        const key=nameKey(name),matches=Object.keys(bucket).filter(item=>nameKey(item)===key);
        return matches.length===1?matches[0]:'';
    }
    function worldLocationRelated(a,b) {
        const x=nameKey(a),y=nameKey(b);if(!x||!y)return false;
        return x===y||x.includes(y)||y.includes(x);
    }
    function personActivityMeta(stat,name,person) {
        const relations=stat?.关系列表||{},roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
        const events=stat?.世界?.[PATH]?.事件||{},worldTime=String(stat?.世界?.时间||''),currentLocation=String(stat?.世界?.地点||'');
        const formalName=stableNameIn(relations,name),alienName=stableNameIn(roster,name),alien=alienName?roster[alienName]:null;
        const activeAlien=!!(alien&&alien.状态!=='死亡'),deadAlien=!!(alien&&alien.状态==='死亡');
        const liveEntries=Object.entries(events).filter(([,event])=>event&&['待发生','进行中'].includes(event.状态));
        const liveNames=new Set(liveEntries.map(([eventName])=>eventName));
        const linked=Array.isArray(person?.关联事件)&&person.关联事件.some(eventName=>liveNames.has(eventName));
        const participant=liveEntries.some(([,event])=>(event.参与者||[]).some(item=>nameKey(item)===nameKey(name)));
        const here=!!(person?.地点&&currentLocation&&worldLocationRelated(person.地点,currentLocation));
        const now=worldDateKey(worldTime),updated=worldDateKey(person?.更新时间);
        const ageHours=now!==null&&updated!==null?now-updated:null;
        const recent=sameWorldTimeAnchor(person?.更新时间,worldTime)||(ageHours!==null&&ageHours>=0&&ageHours<=HOT_PERSON_RECENT_HOURS);
        const checkAt=worldDateKey(person?.下次检查);
        const dueSoon=now!==null&&checkAt!==null&&checkAt>=now-HOT_PERSON_RECENT_HOURS&&checkAt<=now+7*24;
        const terminal=TERMINAL_PERSON_STATUS.test(String(person?.状态||'').trim());
        return {formalName,activeAlien,deadAlien,linked,participant,here,recent,dueSoon,terminal,ageHours};
    }
    function projectHotWorldPeople(stat,limit=HOT_PERSON_TARGET) {
        const people=stat?.世界?.[PATH]?.人物||{},rows=[];
        for(const [name,person] of Object.entries(people)){
            if(!plain(person))continue;
            const meta=personActivityMeta(stat,name,person);
            if(meta.deadAlien)continue;
            const hot=meta.activeAlien||(!meta.terminal&&(meta.linked||meta.participant||meta.here||meta.dueSoon||meta.recent));
            if(!hot)continue;
            const score=(meta.activeAlien?1000:0)+(meta.linked||meta.participant?600:0)+(meta.here?450:0)+(meta.dueSoon?320:0)+(meta.recent?220:0)+(meta.formalName?20:0);
            rows.push({name,person,meta,score});
        }
        rows.sort((a,b)=>b.score-a.score||String(a.name).localeCompare(String(b.name),'zh-CN'));
        const aliens=rows.filter(row=>row.meta.activeAlien),ordinary=rows.filter(row=>!row.meta.activeAlien).slice(0,Math.max(0,Number(limit)||0));
        return Object.fromEntries([...aliens,...ordinary].map(row=>[row.name,copy(row.person)]));
    }
    function pruneColdTemporaryPeople(stat) {
        const people=stat?.世界?.[PATH]?.人物;if(!plain(people))return [];
        const removed=[];
        const entries=Object.entries(people);
        for(const [name,person] of entries){
            if(!plain(person))continue;
            const meta=personActivityMeta(stat,name,person);
            const protectedNow=!!(meta.formalName||meta.activeAlien||meta.linked||meta.participant||meta.here||meta.dueSoon);
            if(protectedNow)continue;
            const stale=meta.ageHours!==null&&meta.ageHours>COLD_TEMP_PERSON_GRACE_HOURS;
            if(meta.terminal||stale){delete people[name];removed.push(name);}
        }
        const cold=Object.entries(people).filter(([name,person])=>{
            if(!plain(person))return false;
            const meta=personActivityMeta(stat,name,person);
            const protectedNow=!!(meta.formalName||meta.activeAlien||meta.linked||meta.participant||meta.here||meta.dueSoon);
            const recentlyActive=meta.ageHours!==null&&meta.ageHours>=0&&meta.ageHours<=COLD_TEMP_PERSON_GRACE_HOURS;
            return !protectedNow&&!recentlyActive;
        });
        while(cold.length>COLD_TEMP_PERSON_TARGET){
            const [name]=cold.shift();
            if(Object.hasOwn(people,name)){delete people[name];removed.push(name);}
        }
        return removed;
    }
    function alienRosterMatch(stat,name) {
        const roster=stat?.世界?.异端雷达?.名单||{},matched=stableNameIn(roster,name);
        return matched?{名称:matched,记录:roster[matched]}:null;
    }
    function pruneDeadAlienPeople(stat) {
        const people=stat?.世界?.[PATH]?.人物,roster=stat?.世界?.异端雷达?.名单;
        if(!plain(people)||!plain(roster))return [];
        const removed=[];
        for(const [alienName,alien] of Object.entries(roster)){
            if(alien?.状态!=='死亡')continue;
            const personName=stableNameIn(people,alienName);
            if(personName){delete people[personName];removed.push(personName);}
        }
        return removed;
    }
    function activeAlienActivityRequirements(stat) {
        if((stat?.设置||{}).单一世界)return [];
        const roster=stat?.世界?.异端雷达?.名单||{},people=stat?.世界?.[PATH]?.人物||{},required=[];
        for(const [alienName,alien] of Object.entries(roster)){
            if(!alien||alien.状态==='死亡')continue;
            const personName=stableNameIn(people,alienName)||alienName,person=people[personName]||{};
            required.push({
                名称:personName,雷达名称:alienName,来源:String(alien.来源||''),经历:String(alien.经历||''),阵营:String(alien.阵营||''),职业:String(alien.职业||''),层级:String(alien.层级||''),
                当前活动:{地点:String(person.地点||''),目标:String(person.目标||''),行动:String(person.行动||''),更新时间:String(person.更新时间||'')},
                要求:'本轮必须在 WorldResult.人物 中提交该异端的活动复核；至少给出非空地点、目标、行动，并将更新时间精确写为当前世界时间。若本轮已确认其死亡，则只把异端状态更新为死亡，不再提交人物活动。'
            });
        }
        return required;
    }
    function seedMissingAlienPeople(stat,required) {
        const state=stat?.世界?.[PATH],patches=[];if(!state)return patches;
        const people=state.人物||(state.人物={});
        for(const item of required||[]){
            if(stableNameIn(people,item.名称))continue;
            const relationName=stableNameIn(stat.关系列表||{},item.雷达名称),relation=relationName?(stat.关系列表||{})[relationName]:null;
            const seed=normalizeBackendRecord('人物',{所属世界:stat.世界?.名称||'',地点:String(relation?.地点||''),目标:'',行动:'',公开动态:''});
            people[item.名称]=seed;
            patches.push({op:'add',path:pointer(['世界',PATH,'人物',item.名称]),value:copy(seed)});
        }
        return patches;
    }
    function ensureActiveAlienActivity(next,required,acceptedResult,worldTime) {
        const roster=next?.世界?.异端雷达?.名单||{},people=next?.世界?.[PATH]?.人物||{},proposals=acceptedResult?.人物||[],missing=[];
        for(const item of required||[]){
            const rosterName=stableNameIn(roster,item.雷达名称||item.名称),alien=rosterName?roster[rosterName]:null;
            if(!alien||alien.状态==='死亡')continue;
            const personName=stableNameIn(people,item.名称)||stableNameIn(people,rosterName),person=personName?people[personName]:null;
            const proposal=proposals.find(p=>nameKey(p.名称)===nameKey(item.名称)||nameKey(p.名称)===nameKey(rosterName));
            const complete=person&&String(person.地点||'').trim()&&String(person.目标||'').trim()&&String(person.行动||'').trim()&&String(person.更新时间||'').trim()===String(worldTime||'').trim();
            if(!proposal||!complete)missing.push(rosterName||item.名称);
        }
        if(missing.length)throw new Error('异端活动未复核：'+missing.join('、')+'；活跃异端每轮都必须提交人物活动，写明地点、目标、行动，并把更新时间精确写为当前世界时间；若已死亡则更新异端状态为死亡');
    }
    function canonicalizeParts(parts,stat) {
        const p=parts.slice();
        if(p[0]==='世界'&&p[1]===PATH&&p[3]&&['人物','事件','势力地区'].includes(p[2])){
            const pools=[];
            const state=stat?.世界?.[PATH]||{};
            if(plain(state[p[2]]))pools.push(...Object.keys(state[p[2]]));
            if(p[2]==='人物'){
                pools.push(...Object.keys(stat?.关系列表||{}));
                pools.push(...Object.keys(stat?.世界?.异端雷达?.名单||{}));
            }
            const key=nameKey(p[3]),matches=[...new Set(pools)].filter(name=>nameKey(name)===key);
            if(matches.length===1)p[3]=matches[0];
        }
        return p;
    }
    function bootstrapBackendParent(stat,parts) {
        if(parts[0]!=='世界'||parts[1]!==PATH||parts.length!==5)return;
        const category=parts[2],name=parts[3];
        if(!['事件','人物','势力地区','传播'].includes(category))return;
        const bucket=stat.世界[PATH][category]||(stat.世界[PATH][category]={});
        if(Object.hasOwn(bucket,name))return;
        const seed=category==='事件'?{描述:name}:category==='人物'?{所属世界:stat.世界.名称||'',地点:'',行动:''}:{};
        bucket[name]=normalizeBackendRecord(category,seed);
    }
    function canUpsertMissing(parts,stat) {
        if(parts[0]==='世界'&&parts[1]===PATH){
            if(parts[2]==='历史'||parts[2]==='剧本')return false;
            if(parts.length===4&&['事件','人物','势力地区','传播'].includes(parts[2]))return true;
            if(parts.length===5&&['事件','人物','势力地区','传播'].includes(parts[2])&&!!get(stat,parts.slice(0,4)))return true;
        }
        if(parts[0]==='世界'&&parts[1]==='因果轨道'&&parts[2]==='偏移记录'&&parts.length===4)return true;
        if(parts[0]==='世界'&&['势力','探索'].includes(parts[1])&&parts.length===3)return true;
        if(parts[0]==='传闻'&&['街头巷议','情报交易','布告与檄文'].includes(parts[1])&&parts.length===3)return true;
        return false;
    }
    function checkRecord(value, template, optional = {}) {
        if(!plain(value))throw new Error('记录必须是完整对象，不能是文本或数组');
        const missing=Object.keys(template).filter(k=>!Object.hasOwn(value,k));
        const unknown=Object.keys(value).filter(k=>!Object.hasOwn(template,k)&&!Object.hasOwn(optional,k));
        if(missing.length||unknown.length)throw new Error('记录字段不完整或不受支持：'+(missing.length?'缺少 '+missing.join('、'):'')+(unknown.length?'；未知 '+unknown.join('、'):''));
        for (const [key, base] of Object.entries(template)) {
            const v = value[key];
            if (Array.isArray(base) ? !Array.isArray(v) || v.some(x => typeof x !== 'string') : typeof v !== typeof base) throw new Error('记录字段类型错误：' + key);
        }
    }
    function checkDetails(value, optional) {
        for (const [key, base] of Object.entries(optional)) {
            if (!Object.hasOwn(value,key)) continue;
            const v=value[key];
            if (Array.isArray(base)) {
                if (!Array.isArray(v)) throw new Error('明细需为列表：'+key);
                if (base.length) v.forEach(item=>checkRecord(item,base[0]));
                else if (v.some(item=>typeof item !== 'string')) throw new Error('明细需为文本列表：'+key);
            } else if (typeof v !== typeof base) throw new Error('明细类型错误：'+key);
        }
    }
    // LLM 常会只返回本轮实际变化的字段。后台整记录在安全边界内自动补默认值/合并旧值，
    // 未知字段直接丢弃；可选明细若提供，仍按完整明细结构严格校验。
    function normalizeBackendRecord(category,value,old) {
        if(!plain(value)||!Object.hasOwn(RECORDS,category))return value;
        const template=RECORDS[category],optional=DETAILS[category]||{};
        const out=Object.assign(copy(template),plain(old)?copy(old):{});
        for(const [key,item] of Object.entries(value)){
            if(Object.hasOwn(template,key)||Object.hasOwn(optional,key))out[key]=copy(item);
        }
        return out;
    }
    function normalizeBackendState(stat) {
        const state=stat?.世界?.[PATH]; if(!state)return stat;
        // v3 → v4：旧“公开摘要”直接迁移为因果轨道.当前阶段描述，然后删除两份重复交接字段。
        const legacySummary=String(state.公开摘要||'').trim();
        if(legacySummary){
            if(!plain(stat.世界.因果轨道))stat.世界.因果轨道={当前阶段:'',故事线:'',下一节点:'',偏移记录:{}};
            stat.世界.因果轨道.当前阶段=legacySummary;
        }
        delete state.公开摘要;
        delete state.正文承接;
        state.版本=Math.max(4,Number(state.版本)||0);
        for(const category of Object.keys(RECORDS)){
            if(!plain(state[category]))state[category]={};
            for(const [name,value] of Object.entries(state[category])){
                if(plain(value))state[category][name]=normalizeBackendRecord(category,value);
            }
        }
        pruneDeadAlienPeople(stat);
        return stat;
    }
    const EVENT_CATEGORIES=new Set(['当前事件','近期节点','宏观节点']);
    const LOCAL_EVENT_WORDS=/(?:天台|教室|办公室|医务室|走廊|楼梯|楼层|入口|门扉|校门|校车|桥头|大桥|房间|仓库|食堂|街口|小巷|会合|汇合|集结|夺取|抢夺|突破|开门|绕行|护送|搜索|调查)/;
    const MACRO_EVENT_WORDS=/(?:世界级|全国|跨国|地区级灾难|城市级灾难|战略级|核(?:打击|爆|武器)|EMP|电磁脉冲|战争|政权|社会秩序|基础设施(?:失效|崩溃)|大规模迁移|长期流亡|生存阶段|篇章转折|据点(?:建立|失守|沦陷|崩溃|保卫)|文明|国家|大陆)/;
    function eventText(name,event) {
        return [name,event?.描述,event?.条件,event?.默认走向,event?.结果,event?.公开征兆,event?.地点].filter(Boolean).join(' ');
    }
    function obviouslyLocalMacro(name,event) {
        const text=eventText(name,event);
        if(MACRO_EVENT_WORDS.test(text))return false;
        const fineLocation=/(?:天台|教室|办公室|医务室|走廊|楼梯|楼层|入口|门扉|校门|校车|桥头|大桥|房间|仓库|食堂|街口|小巷)/.test(String(event?.地点||'')+' '+String(name||''));
        return fineLocation&&LOCAL_EVENT_WORDS.test(text);
    }
    function normalizedEventCategory(name,event) {
        const raw=String(event?.分类||'').trim();
        if(raw==='宏观节点')return obviouslyLocalMacro(name,event)?(event?.状态==='进行中'?'当前事件':'近期节点'):'宏观节点';
        if(raw==='当前事件')return '当前事件';
        if(raw==='近期节点')return event?.状态==='进行中'?'当前事件':'近期节点';
        if(raw==='近期事件'||raw==='主线节点'||!EVENT_CATEGORIES.has(raw))return event?.状态==='进行中'?'当前事件':'近期节点';
        return raw;
    }
    function normalizeEventLayers(stat) {
        const events=stat?.世界?.[PATH]?.事件||{},patches=[];
        for(const [name,event] of Object.entries(events)){
            const category=normalizedEventCategory(name,event);
            if(event.分类!==category){
                event.分类=category;
                patches.push({op:'replace',path:'/世界/后台/事件/'+String(name).replace(/~/g,'~0').replace(/\//g,'~1')+'/分类',value:category});
            }
        }
        return patches;
    }
    function explicitPersonAliases(name) {
        const full=String(name||'').trim(), short=full.split(/[·・／/]/)[0].trim();
        return [...new Set([full,short].filter(x=>x.length>=2))];
    }
    function repairExplicitEventLinks(stat) {
        const state=stat?.世界?.[PATH],patches=[]; if(!state)return patches;
        const events=state.事件||{},people=state.人物||{};
        for(const [eventName,event] of Object.entries(events)){
            const haystack=eventText(eventName,event);
            const participants=Array.isArray(event.参与者)?event.参与者.slice():[];
            let participantsChanged=false;
            for(const personName of Object.keys(people)){
                const explicit=participants.some(x=>nameKey(x)===nameKey(personName))||explicitPersonAliases(personName).some(alias=>haystack.includes(alias));
                if(!explicit)continue;
                if(!participants.some(x=>nameKey(x)===nameKey(personName))){
                    participants.push(personName);participantsChanged=true;
                }
                const person=people[personName],links=Array.isArray(person.关联事件)?person.关联事件:[];
                if(!links.includes(eventName)){
                    person.关联事件=[...links,eventName];
                    patches.push({op:'replace',path:'/世界/后台/人物/'+String(personName).replace(/~/g,'~0').replace(/\//g,'~1')+'/关联事件',value:copy(person.关联事件)});
                }
            }
            if(participantsChanged){
                event.参与者=participants;
                patches.push({op:'replace',path:'/世界/后台/事件/'+String(eventName).replace(/~/g,'~0').replace(/\//g,'~1')+'/参与者',value:copy(participants)});
            }
        }
        return patches;
    }
    function repairMacroPredecessors(stat) {
        const state=stat?.世界?.[PATH],orbit=stat?.世界?.因果轨道||{},patches=[]; if(!state)return patches;
        const stages=storyStages(orbit.故事线).filter(name=>state.事件?.[name]?.分类==='宏观节点'&&state.事件[name].状态!=='已取消');
        for(let i=1;i<stages.length;i++){
            const prev=stages[i-1],name=stages[i],event=state.事件[name],parents=Array.isArray(event.前因)?event.前因:[];
            if(!parents.includes(prev)){
                event.前因=[...parents,prev];
                patches.push({op:'replace',path:'/世界/后台/事件/'+String(name).replace(/~/g,'~0').replace(/\//g,'~1')+'/前因',value:copy(event.前因)});
            }
        }
        return patches;
    }

    const MODEL_IGNORED_PATHS = [
        /^\/任务(?:\/|$)/,
        /^\/系统状态\/待播报记录$/,
        /^\/世界\/后台\/(?:版本|已处理楼层|已处理时间|运行记录|最近变化)(?:\/|$)/,
        /^\/世界\/后台\/剧本(?:\/|$)/
    ];
    function sanitizeModelPatches(patches) {
        if(!Array.isArray(patches))return patches;
        return patches.filter(p=>!(plain(p)&&typeof p.path==='string'&&MODEL_IGNORED_PATHS.some(rule=>rule.test(p.path))));
    }
    function normalizeModelPatches(patches) {
        if(!Array.isArray(patches))return patches;
        const out=[],esc=value=>String(value).replace(/~/g,'~0').replace(/\//g,'~1');
        for(const raw of patches){
            if(!plain(raw)){out.push(raw);continue;}
            const patch=copy(raw);
            if(typeof patch.path==='string')patch.path=patch.path.replace(/^\/世界\/因校轨道(?=\/|$)/,'/世界/因果轨道');
            if(patch.path==='/世界/因果轨道'&&patch.op!=='remove'&&plain(patch.value)){
                for(const key of ['当前阶段','故事线','下一节点']){
                    if(Object.hasOwn(patch.value,key))out.push({op:'add',path:'/世界/因果轨道/'+key,value:copy(patch.value[key])});
                }
                if(plain(patch.value.偏移记录))for(const [name,value] of Object.entries(patch.value.偏移记录)){
                    out.push({op:'add',path:'/世界/因果轨道/偏移记录/'+esc(name),value:copy(value)});
                }
                continue;
            }
            if(patch.path==='/世界/因果轨道/偏移记录'&&patch.op!=='remove'&&plain(patch.value)){
                for(const [name,value] of Object.entries(patch.value))out.push({op:'add',path:'/世界/因果轨道/偏移记录/'+esc(name),value:copy(value)});
                continue;
            }
            out.push(patch);
        }
        return out;
    }
    function retryableModelFailure(error) {
        const message=String(error?.message||error||'');
        if(!message)return false;
        if(/^(?:请求已取消|上下文已经切换|推演期间世界时间或副本锚点发生变化|请在主神终端设置|请加载更新后的|禁止写入：)/.test(message))return false;
        if(error?.name==='AbortError')return false;
        return true;
    }
    function retryInput(baseInput,error,lastReply,attempt,maxRetries,acceptedResult,retryPlan=[]) {
        let payload;try{payload=JSON.parse(baseInput);}catch(_){payload={原始请求:baseInput};}
        const plan=Array.isArray(retryPlan)?retryPlan.filter(Boolean).map(String):[];
        payload.纠错重试={
            当前重试:attempt,
            最大重试次数:maxRetries,
            上次拒绝原因:String(error?.message||error||''),
            上次模型回复:String(lastReply||'').slice(-12000),
            已接受业务结果:acceptedResult?copy(acceptedResult):undefined,
            补充清单:plan.length?copy(plan):undefined,
            要求:acceptedResult
                ?(plan.length
                    ?'严格按“补充清单”只补充或修正未通过的业务片段。已接受业务结果已经通过本地验收，默认全部保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。'
                    :'只补充或修正导致拒绝的业务片段。已接受业务结果默认保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。')
                :'修正格式或业务错误后重新输出一个 WorldResult JSON；不要解释错误，不要输出存储路径。'
        };
        if(payload.纠错重试.已接受业务结果===undefined)delete payload.纠错重试.已接受业务结果;
        if(payload.纠错重试.补充清单===undefined)delete payload.纠错重试.补充清单;
        return JSON.stringify(payload,null,2);
    }
    // 仅允许世界叙事字段与世界经济三字段；玩家数值、持币余额、奖励发放和时钟不在写入名单内。
    function allowed(parts, stat) {
        const [a,b,c,d] = parts;
        if (a === '世界' && b === PATH) {
            if (c === '剧本') return false;
            if (!Object.hasOwn(RECORDS, c) || !d) return false;
            if (c === '历史') return parts.length === 4;
            return parts.length === 4 || (parts.length === 5 && (Object.hasOwn(RECORDS[c], parts[4]) || Object.hasOwn(DETAILS[c],parts[4])));
        }
        if (a === '世界' && b === '因果轨道') {
            if (['当前阶段','故事线','下一节点'].includes(c)) return parts.length === 3;
            return !(stat.设置 || {}).世界超稳 && c === '偏移记录' && parts.length === 4;
        }
        if (a === '世界' && b === '货币') return parts.length === 3 && Object.hasOwn(CURRENCY_FIELDS,c);
        if (a === '世界' && b === '历法') return parts.length === 3 && Object.hasOwn(CALENDAR_FIELDS,c);
        if (a === '世界' && ['势力','探索'].includes(b)) return parts.length === 3 || (parts.length === 4 && Object.hasOwn(b === '势力' ? {实力:0,领地:0,描述:0,声望:0} : {风险:0,探索度:0,描述:0,隐藏真相:0},d));
        if (a === '世界' && b === '异端雷达') return parts.length === 5 && c === '名单' && parts[4] === '状态' && !(stat.设置 || {}).单一世界;
        if (a === '传闻' && ['街头巷议','情报交易','布告与檄文'].includes(b)) return parts.length === 3;
        // 只允许修改变量AI已经建立的 NPC；禁止通过世界引擎创建关系列表对象。
        if (a === '关系列表') return parts.length === 3 && RELATION_SYNC_KEYS.has(c) && !!get(stat,[a,b]);
        if (a === '任务') return parts.length === 4 && ['列表','副本成就'].includes(b) && d === '状态' && !!get(stat,[a,b,c]);
        return false;
    }
