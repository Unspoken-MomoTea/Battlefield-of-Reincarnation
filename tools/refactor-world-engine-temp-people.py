from pathlib import Path

SCRIPT = Path('script/世界推进系统.js')
AUDIT = Path('docs/世界引擎V2审计.md')
GUIDE = Path('script/世界引擎接入说明.md')

source = SCRIPT.read_text(encoding='utf-8')
audit = AUDIT.read_text(encoding='utf-8')
guide = GUIDE.read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


# 1. Lifecycle/context budgets. Only 世界.时间 participates in age calculations.
source = replace_once(
    source,
    """    const HOT_HISTORY_TARGET = 24;
    const HOT_OFFSET_TARGET = 8;
    const HOT_PROPAGATION_TARGET = 24;""",
    """    const HOT_HISTORY_TARGET = 24;
    const HOT_OFFSET_TARGET = 8;
    const HOT_PROPAGATION_TARGET = 24;
    const HOT_PERSON_TARGET = 24;
    const HOT_PERSON_RECENT_HOURS = 72;
    const COLD_TEMP_PERSON_GRACE_HOURS = 30 * 24;
    const COLD_TEMP_PERSON_TARGET = 32;
    const TERMINAL_PERSON_STATUS = /^(?:已结束|结束|已离场|离场|已离开|离开|退休|已退休|失效|已失效|消失|已消失|死亡)$/;""",
    'temporary person constants',
)

# 2. Shared activity classifier. Formal relationship membership protects storage but does not by itself keep a stale backstage action hot.
anchor = """    function stableNameIn(bucket,name) {
        if(!plain(bucket))return '';
        if(Object.hasOwn(bucket,name))return name;
        const key=nameKey(name),matches=Object.keys(bucket).filter(item=>nameKey(item)===key);
        return matches.length===1?matches[0]:'';
    }
    function alienRosterMatch(stat,name) {"""
helper = """    function stableNameIn(bucket,name) {
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
    function alienRosterMatch(stat,name) {"""
source = replace_once(source, anchor, helper, 'person activity helpers')

# 3. Lifecycle program owns deletion of cold temporary actors; model still cannot remove ordinary people itself.
source = replace_once(
    source,
    """    function compactWorldLifecycle(stat) {
        const state=stat?.世界?.[PATH];
        if(!state)return {归档事件:[],回收传播:[]};
        const now=worldDateKey(stat?.世界?.时间),removed=[];
        for(const [name,record] of Object.entries(state.传播||{})){
            if(propagationEnded(record,now)){delete state.传播[name];removed.push(name);}
        }
        const archived=compactFinishedEvents(stat);
        return {归档事件:archived,回收传播:removed};
    }""",
    """    function compactWorldLifecycle(stat) {
        const state=stat?.世界?.[PATH];
        if(!state)return {归档事件:[],回收传播:[],回收人物:[]};
        const now=worldDateKey(stat?.世界?.时间),removed=[];
        for(const [name,record] of Object.entries(state.传播||{})){
            if(propagationEnded(record,now)){delete state.传播[name];removed.push(name);}
        }
        const archived=compactFinishedEvents(stat);
        const removedPeople=pruneColdTemporaryPeople(stat);
        return {归档事件:archived,回收传播:removed,回收人物:removedPeople};
    }""",
    'temporary person lifecycle hook',
)

# 4. Secondary world-engine prompt context also receives only hot backstage actors, matching the prose-side hot projection.
source = replace_once(
    source,
    """            事件:copy(backend.事件||{}),
            人物:copy(backend.人物||{}),
            势力地区:copy(backend.势力地区||{}),""",
    """            事件:copy(backend.事件||{}),
            人物:projectHotWorldPeople(src),
            势力地区:copy(backend.势力地区||{}),""",
    'model context hot people projection',
)

# 5. Export only the useful projection helper for focused tests/inspection; cleanup remains program-internal.
source = replace_once(
    source,
    "extractWorldProse,derivePersonWorldContext}; return; }",
    "extractWorldProse,derivePersonWorldContext,projectHotWorldPeople}; return; }",
    'CommonJS hot people export',
)

# 6. Docs: close the accumulation loophole explicitly.
audit_marker = "- 专项验收由 `tests/world-engine-person-scene-ui.cjs` 覆盖正式档案、现场标签、临时后台人物和地区资源展示。"
audit_replacement = audit_marker + "\n- 纯后台人物不会无限进入副 API 上下文：只投影活跃异端、活跃/未来事件关联者、当前地点相关者、到期检查者与近72小时活动者，普通热人物最多24名；关系列表仍单独提供正式档案。\n- 程序回收没有正式档案、不是活跃异端、没有活跃/未来事件引用且不在当前地点的冷临时人物：明确结束可直接回收，可比较世界时间下超过30天未活动会回收；无法比较的作品内时间不凭字符串盲删，但完全冷的临时记录最多保留32名。"
audit = replace_once(audit, audit_marker, audit_replacement, 'audit temporary person lifecycle')

guide_marker = "身边人物若已经存在关系列表档案，UI 提供跳转入口并自动回到“全部”筛选后定位正式人物；没有档案的身边人物只显示名称、空间关系和当前行动。世界推进首页的重点人物使用相同规则。所有这些 UI 都由 `script/世界推进系统.js` 的 Shadow DOM 面板直接渲染，不依赖或新增正文美化正则。"
guide_replacement = guide_marker + "\n\n纯后台人物还采用两层降噪：副 API 的 `当前变量.世界.后台.人物` 不再发送整库，只发送真正热的后台活动者；程序生命周期会回收明确结束或长期冷却且没有任何保护引用的临时人物。正式关系列表人物、活跃异端、活跃/未来事件参与者和当前地点相关人物不会被这一临时回收机制删除。所有年龄判断只使用 `世界.时间`，不使用游玩天数。"
guide = replace_once(guide, guide_marker, guide_replacement, 'guide temporary person lifecycle')

for marker in [
    'const HOT_PERSON_TARGET = 24',
    'const COLD_TEMP_PERSON_TARGET = 32',
    'function projectHotWorldPeople',
    'function pruneColdTemporaryPeople',
    '人物:projectHotWorldPeople(src)',
    '回收人物:removedPeople',
]:
    if marker not in source:
        raise SystemExit(f'missing source marker: {marker}')
for marker in ['普通热人物最多24名', '完全冷的临时记录最多保留32名']:
    if marker not in audit:
        raise SystemExit(f'missing audit marker: {marker}')
for marker in ['不再发送整库', '所有年龄判断只使用 `世界.时间`']:
    if marker not in guide:
        raise SystemExit(f'missing guide marker: {marker}')

SCRIPT.write_text(source, encoding='utf-8')
AUDIT.write_text(audit, encoding='utf-8')
GUIDE.write_text(guide, encoding='utf-8')
print('temporary person lifecycle refactor staged')
