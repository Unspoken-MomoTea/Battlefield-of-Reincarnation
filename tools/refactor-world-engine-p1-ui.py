from pathlib import Path

path = Path('script/世界推进系统.js')
source = path.read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


# 1. Pure world-context derivation shared by UI and tests.
anchor = """    for (const key of ['承诺','待决事项','关系变化']) delete MODEL_DETAILS.人物[key];

    function collectEventRefs(state) {"""
helper = """    for (const key of ['承诺','待决事项','关系变化']) delete MODEL_DETAILS.人物[key];

    function derivePersonWorldContext(stat, personName, playerName='') {
        const backend=stat?.世界?.[PATH]||{},people=backend.人物||{},areas=backend.势力地区||{};
        const key=value=>String(value||'').toLowerCase().replace(/[\\/／·・._\\-\\s]+/g,'');
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
        const relationByKey=new Map(Object.entries(stat?.关系列表||{}).map(([name,record])=>[key(name),record]));
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
                const relation=relationByKey.get(key(name))||{};
                const identity=Array.isArray(relation.身份)?relation.身份[0]:String(relation.身份||'');
                return {
                    名称:String(name),
                    关系:key(other.地点)===key(location)?'贴身':'同地区',
                    身份:identity,
                    行动:String(other.行动||other.公开动态||relation.态度||'')
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

    function collectEventRefs(state) {"""
source = replace_once(source, anchor, helper, 'derivePersonWorldContext insertion')

# 2. Context UI design tokens/classes. New components use semantic theme variables and inherit font scale.
css_anchor = """                '#sam-world-engine .we-change{display:grid;grid-template-columns:62px 1fr;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);font-size:12px}#sam-world-engine .we-change time{color:var(--gold);font-size:10px}#sam-world-engine .we-change p{margin:2px 0;color:var(--sub)}#sam-world-engine .we-progress{height:4px;background:#ffffff0a;border-radius:4px;margin:10px 0 6px;overflow:hidden}#sam-world-engine .we-progress>i{display:block;height:100%;background:var(--mint);border-radius:4px}#sam-world-engine .we-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 18px;align-items:start}#sam-world-engine dl{margin:12px 0;display:grid;grid-template-columns:85px minmax(0,1fr);gap:8px 14px;font-size:12px}#sam-world-engine dt{color:var(--sub)}#sam-world-engine dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}#sam-world-engine details{border-top:1px solid var(--line);margin-top:12px;padding-top:8px}#sam-world-engine summary{cursor:pointer;color:var(--gold);font-size:11px;list-style:none}#sam-world-engine summary:before{content:\"＋ \";}#sam-world-engine details[open]>summary:before{content:\"− \";}',"""
css_new = """                '#sam-world-engine .we-context-list{display:grid;gap:8px}#sam-world-engine .we-context-row{width:100%;display:grid;grid-template-columns:minmax(56px,auto) minmax(0,1fr);align-items:start;gap:10px;padding:11px 12px;border:1px solid var(--we-line,var(--line));border-radius:9px;background:var(--we-card,#18222f);text-align:left;color:var(--we-ink,var(--ink))}#sam-world-engine button.we-context-row:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-context-kind{color:var(--we-accent,var(--gold));font-size:var(--we-fs-tiny,11px);font-weight:700;letter-spacing:.06em}#sam-world-engine .we-context-copy{min-width:0}#sam-world-engine .we-context-copy b{display:block;font-size:var(--we-fs-body,13px);overflow-wrap:anywhere}#sam-world-engine .we-context-copy small{display:block;margin-top:2px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-small,12px)}#sam-world-engine .we-scene-hero{padding:14px 16px;border:1px solid var(--we-line,var(--line));border-radius:11px;background:var(--we-card,#18222f)}#sam-world-engine .we-scene-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}#sam-world-engine .we-scene-head h3{margin:0}#sam-world-engine .we-scene-head small{color:var(--we-sub,var(--sub))}#sam-world-engine .we-scene-hero>p{margin:8px 0 0;color:var(--we-sub,var(--sub))}#sam-world-engine .we-scene-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:11px}#sam-world-engine .we-scene-lane{min-width:0;border:1px solid var(--we-line,var(--line));border-radius:10px;background:var(--we-card,#18222f);padding:11px}#sam-world-engine .we-scene-lane-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}#sam-world-engine .we-scene-lane-head b{font-size:var(--we-fs-small,12px)}#sam-world-engine .we-scene-lane-head span{color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-scene-item{display:block;width:100%;padding:9px 8px;border:0;border-top:1px solid var(--we-line,var(--line));background:transparent;text-align:left;color:var(--we-ink,var(--ink))}#sam-world-engine .we-scene-item:first-of-type{border-top:0}#sam-world-engine button.we-scene-item:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-scene-item b{display:block;font-size:var(--we-fs-body,13px);overflow-wrap:anywhere}#sam-world-engine .we-scene-item small{display:block;color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px);margin-top:2px}#sam-world-engine .we-scene-item p{margin:4px 0 0!important;color:var(--we-sub,var(--sub))!important;font-size:var(--we-fs-small,12px)!important;line-height:1.5!important}#sam-world-engine .we-area-scene-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}@media(max-width:900px){#sam-world-engine .we-scene-grid,#sam-world-engine .we-area-scene-grid{grid-template-columns:1fr}}',
""" + css_anchor
source = replace_once(source, css_anchor, css_new, 'world context CSS')

# 3. Render helpers. UI consumes derivePersonWorldContext; no second data model.
render_anchor = """            const compactPerson=(name,p)=>{
                const rel=(s.关系列表||{})[name]||{};
                return '<button class=\"we-person-compact\" data-jump-person=\"'+text(name)+'\"><span class=\"we-avatar\">'+text(name.slice(0,1))+'</span><span class=\"we-person-copy\"><strong>'+text(name)+'</strong><small>'+text(p.地点||'地点未明')+'</small><em>'+text(p.行动||p.公开动态||rel.态度||'暂无新动态')+'</em></span></button>';
            };
            const eventCard=(name,e)=>"""
render_new = """            const compactPerson=(name,p)=>{
                const rel=(s.关系列表||{})[name]||{};
                return '<button class=\"we-person-compact\" data-jump-person=\"'+text(name)+'\"><span class=\"we-avatar\">'+text(name.slice(0,1))+'</span><span class=\"we-person-copy\"><strong>'+text(name)+'</strong><small>'+text(p.地点||'地点未明')+'</small><em>'+text(p.行动||p.公开动态||rel.态度||'暂无新动态')+'</em></span></button>';
            };
            const contextRows=context=>{
                const rows=[];
                for(const link of context?.背景关联||[])rows.push('<div class=\"we-context-row\"><span class=\"we-context-kind\">'+text(link.类型||'关联')+'</span><span class=\"we-context-copy\"><b>'+text(link.名称||'未命名关联')+'</b><small>'+text(link.关系||'持续关联')+'</small></span></div>');
                for(const eventName of context?.关联事件||[])rows.push('<button class=\"we-context-row\" data-jump-event=\"'+text(eventName)+'\"><span class=\"we-context-kind\">事件</span><span class=\"we-context-copy\"><b>'+text(eventName)+'</b><small>查看关联世界事件 →</small></span></button>');
                return rows.length?'<div class=\"we-context-list\">'+rows.join('')+'</div>':empty('暂无背景关联','世界引擎只记录持续的组织/社交关系与事件关联，不重复人物背景故事。');
            };
            const sceneLane=(title,items,kind)=>{
                const list=Array.isArray(items)?items:[];
                const body=list.map(item=>{
                    if(kind==='person')return '<button class=\"we-scene-item\" data-person=\"'+text(item.名称)+'\"><b>'+text(item.名称)+'</b><small>'+text([item.关系,item.身份].filter(Boolean).join(' · ')||'身边人物')+'</small>'+(item.行动?'<p>'+text(item.行动)+'</p>':'')+'</button>';
                    if(kind==='group')return '<article class=\"we-scene-item\"><b>'+text(item.名称||'未命名群体')+'</b><small>'+text([item.规模,item.身份].filter(Boolean).join(' · ')||'现场群体')+'</small>'+(item.动态?'<p>'+text(item.动态)+'</p>':'')+'</article>';
                    return '<article class=\"we-scene-item\"><b>'+text(item.名称||'未命名资源点')+'</b><small>'+text([item.类型,item.状态,item.控制方].filter(Boolean).join(' · ')||'世界资源点')+'</small>'+(item.动态?'<p>'+text(item.动态)+'</p>':'')+'</article>';
                }).join('');
                return '<div class=\"we-scene-lane\"><div class=\"we-scene-lane-head\"><b>'+text(title)+'</b><span>'+list.length+'</span></div>'+(body||'<div class=\"we-muted\">暂无记录</div>')+'</div>';
            };
            const sceneContextBody=context=>{
                const hasScene=!!(context&&(context.地区||context.身边人物?.length||context.现场群体?.length||context.资源点?.length));
                if(!hasScene)return empty('暂无身边发展','人物尚未匹配到可用的地区现场；不会为填充面板而虚构周边信息。');
                const control=[context.控制方?'控制 · '+context.控制方:'',context.争夺方?.length?'争夺 · '+context.争夺方.join('、'):''].filter(Boolean).join(' · ');
                return '<div class=\"we-scene-hero\"><div class=\"we-scene-head\"><div><small>当前世界现场</small><h3>'+text(context.地区||'未命名地区')+'</h3></div><small>'+text(control||'控制关系未记录')+'</small></div>'+(context.地区动态?'<p>'+text(context.地区动态)+'</p>':'')+(context.环境状态?.length?'<div class=\"we-chips\">'+context.环境状态.map(x=>pill(x,'dim')).join('')+'</div>':'')+'</div><div class=\"we-scene-grid\">'+sceneLane('身边人物',context.身边人物,'person')+sceneLane('现场群体',context.现场群体,'group')+sceneLane('资源点',context.资源点,'resource')+'</div>';
            };
            const areaSceneBody=record=>{
                const groups=Array.isArray(record?.现场群体)?record.现场群体:[],resources=Array.isArray(record?.资源点)?record.资源点:[];
                if(!groups.length&&!resources.length)return '';
                return '<div class=\"we-area-scene-grid\">'+sceneLane('现场群体',groups,'group')+sceneLane('资源点',resources,'resource')+'</div>';
            };
            const eventCard=(name,e)=>"""
source = replace_once(source, render_anchor, render_new, 'render world context helpers')

# 4. Character management layout: world around the person before schedule/audit; background association on right.
old_role = """            }else if(this.tab==='角色管理'){
                if(showRadar&&alienAlive>0)html+='<div class=\"we-meta we-alien-count\">异端存活数量 <b>'+alienAlive+'</b></div>';

                const list=Array.from(people).filter(([n,p])=>matched(n,p)&&((this.filter||'全部')==='全部'||(this.filter==='在场'?!!(s.关系列表||{})[n]?.在场:!(s.关系列表||{})[n]?.在场)));
                const chosen=list.find(([n])=>n===this.selectedPerson)||list[0];
                const chosenAudit=chosen&&plain((s.关系列表||{})[chosen[0]])?npcBuildAssessment(s,chosen[0],(s.关系列表||{})[chosen[0]]):null;
                const auditPanel=chosenAudit?section('NPC构筑审计',
                    '<div class=\"we-card\"><div class=\"we-card-top\"><h3>'+text(chosenAudit.审计级别)+'</h3>'+pill(chosenAudit.缺口.length?'待补强':'构筑完整',chosenAudit.缺口.length?'future':'dim')+'</div>'
                    +fields({层级:chosenAudit.层级,当前组件:chosenAudit.当前组件})
                    +(chosenAudit.缺口.length?'<div class=\"we-chips\">'+chosenAudit.缺口.map(x=>pill(x,'future')).join('')+'</div><p class=\"we-muted\">进入世界推进请求的热人物会由后台优先补齐缺口；难度脚本只负责已有组件的品质调整。</p>':'<p class=\"we-muted\">当前构筑已达到本层级审计最低要求。</p>')+'</div>',
                    '复用NPC生成规则'
                ):'';
                html+=tools(['全部','在场','场外'])+'<div class=\"we-columns\"><div>'+section('人物名册','<div class=\"we-tools\">'+list.map(([n])=>'<button data-person=\"'+text(n)+'\" class=\"'+(chosen?.[0]===n?'active':'')+'\">'+text(n)+'</button>').join('')+'</div>')+(chosen?section('身份与当前行动',person(chosen[0],chosen[1],true))+auditPanel+section('日程与行动',fields({行程:chosen[1].行程,开始时间:chosen[1].开始时间,预计结束:chosen[1].预计结束,下次检查:chosen[1].下次检查})):empty('没有符合条件的人物'))+'</div><aside>'+(chosen?[['情报',chosen[1].认知来源||chosen[1].认知],['近期动向',chosen[1].公开动态]].filter(([,v])=>exists(v)).map(([label,v])=>section(label,value(v))).join(''):'')+'</aside></div>';
"""
new_role = """            }else if(this.tab==='角色管理'){
                if(showRadar&&alienAlive>0)html+='<div class=\"we-meta we-alien-count\">异端存活数量 <b>'+alienAlive+'</b></div>';

                const list=Array.from(people).filter(([n,p])=>matched(n,p)&&((this.filter||'全部')==='全部'||(this.filter==='在场'?!!(s.关系列表||{})[n]?.在场:!(s.关系列表||{})[n]?.在场)));
                const chosen=list.find(([n])=>n===this.selectedPerson)||list[0];
                const chosenContext=chosen?derivePersonWorldContext(s,chosen[0],userName):null;
                const chosenAudit=chosen&&plain((s.关系列表||{})[chosen[0]])?npcBuildAssessment(s,chosen[0],(s.关系列表||{})[chosen[0]]):null;
                const auditPanel=chosenAudit?section('NPC构筑审计',
                    '<div class=\"we-card\"><div class=\"we-card-top\"><h3>'+text(chosenAudit.审计级别)+'</h3>'+pill(chosenAudit.缺口.length?'待补强':'构筑完整',chosenAudit.缺口.length?'future':'dim')+'</div>'
                    +fields({层级:chosenAudit.层级,当前组件:chosenAudit.当前组件})
                    +(chosenAudit.缺口.length?'<div class=\"we-chips\">'+chosenAudit.缺口.map(x=>pill(x,'future')).join('')+'</div><p class=\"we-muted\">进入世界推进请求的热人物会由后台优先补齐缺口；难度脚本只负责已有组件的品质调整。</p>':'<p class=\"we-muted\">当前构筑已达到本层级审计最低要求。</p>')+'</div>',
                    '复用NPC生成规则'
                ):'';
                const backgroundPanel=chosen?section('背景关联',contextRows(chosenContext),(chosenContext?.背景关联?.length||0)+' 关系 · '+(chosenContext?.关联事件?.length||0)+' 事件'):'';
                const surroundingsPanel=chosen?section('身边发展',sceneContextBody(chosenContext),'按人物地点派生 · 不复制存储'):'';
                html+=tools(['全部','在场','场外'])+'<div class=\"we-columns\"><div>'+section('人物名册','<div class=\"we-tools\">'+list.map(([n])=>'<button data-person=\"'+text(n)+'\" class=\"'+(chosen?.[0]===n?'active':'')+'\">'+text(n)+'</button>').join('')+'</div>')+(chosen?section('身份与当前行动',person(chosen[0],chosen[1],true))+surroundingsPanel+section('日程与行动',fields({行程:chosen[1].行程,开始时间:chosen[1].开始时间,预计结束:chosen[1].预计结束,下次检查:chosen[1].下次检查}))+auditPanel:empty('没有符合条件的人物'))+'</div><aside>'+backgroundPanel+(chosen?[['情报',chosen[1].认知来源||chosen[1].认知],['近期动向',chosen[1].公开动态]].filter(([,v])=>exists(v)).map(([label,v])=>section(label,value(v))).join(''):'')+'</aside></div>';
"""
source = replace_once(source, old_role, new_role, 'character management world-context layout')

# 5. Exploration area detail: surface shared groups/resource points instead of hiding them inside generic details.
old_area = """                            +'<div class=\"we-area-note\">'+text(r.描述||'暂无已确认的玩家探索描述。')+'</div>'
                            +(exists(backstage.进展)||exists(backstage.公开动态)||exists(backstage.资源)?details('area-world-'+n,{世界进展:backstage.进展,公开动态:backstage.公开动态,资源:backstage.资源,近期变化:backstage.近期变化},'世界地区档案'):'')
                            +(exists(r.隐藏真相)?details('area-truth-'+n,{隐藏真相:r.隐藏真相},'主持人档案'):'');"""
new_area = """                            +'<div class=\"we-area-note\">'+text(r.描述||'暂无已确认的玩家探索描述。')+'</div>'
                            +areaSceneBody(backstage)
                            +(exists(backstage.进展)||exists(backstage.公开动态)||exists(backstage.资源)||exists(backstage.近期变化)?details('area-world-'+n,{世界进展:backstage.进展,公开动态:backstage.公开动态,资源:backstage.资源,近期变化:backstage.近期变化},'世界地区档案'):'')
                            +(exists(r.隐藏真相)?details('area-truth-'+n,{隐藏真相:r.隐藏真相},'主持人档案'):'');"""
source = replace_once(source, old_area, new_area, 'exploration area scene rendering')

# 6. Export pure helper for tests.
old_export = """module.exports = {SamsaraWorldEngine,applyPatches,parseReply,emptyState,RECORDS,compileWorldResult,normalizeWorldResult,mergeWorldResults,WORLD_RESULT_SCHEMA,projectWorldContext,compactWorldLifecycle,calendarDate,repairExplorationGranularity,sortWorldEvents,eventScheduleLabel,staleActiveEvents,temporalAnomalies,activeAlienActivityRequirements,pruneDeadAlienPeople,extractWorldProse}"""
new_export = """module.exports = {SamsaraWorldEngine,applyPatches,parseReply,emptyState,RECORDS,compileWorldResult,normalizeWorldResult,mergeWorldResults,WORLD_RESULT_SCHEMA,projectWorldContext,compactWorldLifecycle,calendarDate,repairExplorationGranularity,sortWorldEvents,eventScheduleLabel,staleActiveEvents,temporalAnomalies,activeAlienActivityRequirements,pruneDeadAlienPeople,extractWorldProse,derivePersonWorldContext}"""
source = replace_once(source, old_export, new_export, 'CommonJS world-context export')

for marker in [
    'function derivePersonWorldContext',
    "section('身边发展'",
    "section('背景关联'",
    'we-scene-grid',
    'we-context-list',
    'areaSceneBody(backstage)',
    'derivePersonWorldContext(s,chosen[0],userName)',
    'extractWorldProse,derivePersonWorldContext',
]:
    if marker not in source:
        raise SystemExit(f'missing P1-B marker: {marker}')

path.write_text(source, encoding='utf-8')
print('P1-B UI refactor staged')
