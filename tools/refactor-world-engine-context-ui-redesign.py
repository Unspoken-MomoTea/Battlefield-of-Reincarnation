from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
world_state = ROOT / 'script/world-engine-src/10-world-state.part.js'
runtime = ROOT / 'script/world-engine-src/40-engine-runtime.part.js'
ui = ROOT / 'script/world-engine-src/50-engine-ui.part.js'
variables = ROOT / 'World Book/[variables]当前变量.txt'
extra = ROOT / 'World Book/⚙️额外思考.txt'
guide = ROOT / 'script/世界引擎接入说明.md'
audit = ROOT / 'docs/世界引擎V2审计.md'
person_test = ROOT / 'tests/world-engine-person-scene-ui.cjs'
scene_test = ROOT / 'tests/world-engine-scene-context.cjs'


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, got {count}')
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, label, flags=re.S):
    text, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text

# 1) Person-world context remains derived, but every backend person is viewable in the unified roster.
t = world_state.read_text(encoding='utf-8')
t = replace_once(
    t,
    "                    可查看档案:!!profile,\n                    档案名称:String(profile?.名称||'')",
    "                    可查看档案:true,\n                    档案名称:String(profile?.名称||name),\n                    档案类型:profile?'正式档案':'世界人物'",
    'derived nearby person navigation',
)
world_state.write_text(t, encoding='utf-8')

# 2) Prose projection: group hot people by scene once; person rows carry only person-specific facts.
t = variables.read_text(encoding='utf-8')
t = replace_once(
    t,
    "    // 场外人物动态：只读的真正热人物投影，不复制完整后台人物档案。\n    // 目标/行动、背景关联与身边发展供正文维持叙事连续性，不代表角色自动知情；真正可被角色观察的内容仍需服从地点、观察与传播来源。\n    // 异端身份不在这里重复标注：任务世界已有异端雷达名单；单一世界本就没有异端。",
    "    // 场外人物动态：按地区聚合真正热人物。共享现场只在地区层出现一次，人物条目只保留自身地点/目标/行动等事实。\n    // 这些内容用于正文维持叙事连续性，不代表角色自动知情；真正可被角色观察的内容仍需服从地点、观察与传播来源。\n    // 异端身份不在这里重复标注：任务世界已有异端雷达名单；单一世界本就没有异端。",
    'prose projection comment',
)
new_projection = r'''    const projectedPeople = Object.entries(rawPeople).map(([name, person]) => {
      if (!person || typeof person !== 'object') return null;
      const key = personNameKey(name);
      if (playerKeys.has(key)) return null;
      const relationRef = relationByKey.get(key)?.person;
      // 已在正文现场的人物由正文直接维护，不再作为“场外人物”重复发送。
      if (relationRef?.在场 === true) return null;

      const alienRef = alienByKey.get(key);
      if (alienRef?.alien?.状态 === '死亡') return null;
      const isAlien = !!(alienRef && alienRef.alien?.状态 !== '死亡');
      const links = (Array.isArray(person.关联事件) ? person.关联事件 : [])
        .filter(eventName => activeCurrentEventNames.has(eventName))
        .slice(0, 6);
      const atCurrentLocation = locationRelated(person.地点, currentLocation);
      const linkedCurrentEvent = links.length > 0;
      const updatedNow = sameTimeAnchor(person.更新时间, worldTime);

      // 活跃异端永远是热人物；普通人物只保留当前地点、当前事件或本轮刚更新者。
      // “存在于关系列表”本身不再构成热度，避免多年未更新的旧行动污染正文。
      if (!isAlien && !atCurrentLocation && !linkedCurrentEvent && !updatedNow) return null;

      const sceneArea = sceneAreaFor(person.地点);
      const backgroundLinks = compactSceneList(person.背景关联, ['类型', '名称', '关系'], 6);
      return {
        ...compactProjection({
          名称: String(name),
          地点: String(person.地点 || ''),
          目标: String(person.目标 || ''),
          行动: String(person.行动 || ''),
          状态: String(person.状态 || ''),
          更新时间: String(person.更新时间 || ''),
          公开动态: String(person.公开动态 || ''),
          背景关联: backgroundLinks,
          关联事件: links
        }),
        __异端: isAlien,
        __优先级: isAlien ? -10 : atCurrentLocation ? 0 : linkedCurrentEvent ? 1 : 2,
        __地区: String(sceneArea?.名称 || person.地点 || '地点未明')
      };
    }).filter(Boolean);

    const alienPeople = projectedPeople.filter(person => person.__异端)
      .sort((a, b) => a.名称.localeCompare(b.名称, 'zh-CN'));
    const ordinaryPeople = projectedPeople.filter(person => !person.__异端)
      .sort((a, b) => a.__优先级 - b.__优先级 || a.名称.localeCompare(b.名称, 'zh-CN'))
      .slice(0, 8);
    const hotPeople = [...alienPeople, ...ordinaryPeople];
    const sceneGroups = new Map();
    for (const person of hotPeople) {
      const groupName = String(person.__地区 || person.地点 || '地点未明');
      let group = sceneGroups.get(groupName);
      if (!group) {
        const sceneArea = sceneAreaFor(person.地点);
        const sceneRecord = sceneArea?.记录 || {};
        group = compactProjection({
          地区: String(sceneArea?.名称 || groupName),
          地区动态: String(sceneRecord.公开动态 || sceneRecord.进展 || ''),
          控制方: String(sceneRecord.控制方 || ''),
          争夺方: (Array.isArray(sceneRecord.争夺方) ? sceneRecord.争夺方 : []).filter(Boolean).slice(0, 6),
          现场群体: compactSceneList(sceneRecord.现场群体, ['名称', '规模', '身份', '动态'], 6),
          资源点: compactSceneList(sceneRecord.资源点, ['名称', '类型', '状态', '控制方', '动态'], 6),
          环境状态: (Array.isArray(sceneRecord.环境状态) ? sceneRecord.环境状态 : []).filter(Boolean).slice(0, 6)
        });
        group.人物 = [];
        sceneGroups.set(groupName, group);
      }
      const clean = { ...person };
      delete clean.__异端;
      delete clean.__优先级;
      delete clean.__地区;
      group.人物.push(compactProjection(clean));
    }
    const groupedScenes = Array.from(sceneGroups.values()).map(group => compactProjection({
      地区: group.地区,
      地区动态: group.地区动态,
      控制方: group.控制方,
      争夺方: group.争夺方,
      环境状态: group.环境状态,
      现场群体: group.现场群体,
      资源点: group.资源点,
      人物: group.人物
    }));
    if (groupedScenes.length) readonly.世界.场外人物动态 = groupedScenes;'''
t = sub_once(
    t,
    r"    const nearbyPeopleFor = \(selfName, self, sceneArea\) => \{[\s\S]*?    if \(prosePeople\.length\) readonly\.世界\.场外人物动态 = prosePeople;",
    new_projection,
    'grouped prose scene projection',
)
variables.write_text(t, encoding='utf-8')

# 3) Prose-side instruction must describe the grouped projection shape, not per-person duplicated surroundings.
t = extra.read_text(encoding='utf-8')
t = replace_once(
    t,
    "      - 【世界.场外人物动态】只用于保持人物行动连续性，不得替其推进下一步；目标/行动不是公开知识，公开动态也需满足观察、距离或传播渠道",
    "      - 【世界.场外人物动态】按地区分组：地区级现场只出现一次，人物子项只记录各自行动。它只用于保持人物行动连续性，不得替其推进下一步；目标/行动不是公开知识，公开动态也需满足观察、距离或传播渠道",
    'prose grouped scene instruction',
)
extra.write_text(t, encoding='utf-8')

# 4) World-engine request description should truthfully describe what prose receives.
t = runtime.read_text(encoding='utf-8')
t = replace_once(
    t,
    "正文还会读取进行中当前事件的名称/状态/时间/地点/公开征兆/可见影响，以及程序筛选的场外人物动态（地点/目标/行动/状态/更新时间/公开动态/关联事件）；活跃异端始终进入人物动态。",
    "正文还会读取进行中当前事件的名称/状态/时间/地点/公开征兆/可见影响，以及程序按地区聚合的场外人物动态（地区共享现场 + 人物自身地点/目标/行动/状态/更新时间/公开动态/关联事件）；活跃异端始终进入人物动态。",
    'runtime prose projection description',
)
runtime.write_text(t, encoding='utf-8')

# 5) UI helpers: unified roster navigation and wide area scene layout.
t = ui.read_text(encoding='utf-8')
old_css = "#sam-world-engine .we-scene-label,#sam-world-engine .we-person-label{cursor:default}#sam-world-engine .we-temp-person-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#sam-world-engine .we-temp-person{min-width:0;padding:12px 14px;border:1px dashed var(--we-line,var(--line));border-radius:10px;background:var(--we-card,#18222f)}#sam-world-engine .we-temp-person h3{margin:0}#sam-world-engine .we-temp-person p{margin:6px 0 0;color:var(--we-sub,var(--sub))}@media(max-width:900px){#sam-world-engine .we-temp-person-list{grid-template-columns:1fr}}#sam-world-engine .we-area-scene-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}@media(max-width:900px){#sam-world-engine .we-scene-grid,#sam-world-engine .we-area-scene-grid{grid-template-columns:1fr}}"
new_css = "#sam-world-engine .we-scene-label,#sam-world-engine .we-person-label{cursor:default}#sam-world-engine .we-roster-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#sam-world-engine .we-roster-person{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;width:100%;min-width:0;padding:11px 12px;border:1px solid var(--we-line,var(--line));border-radius:10px;background:var(--we-card,#18222f);text-align:left;color:var(--we-ink,var(--ink))}#sam-world-engine .we-roster-person:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-roster-person.active{border-color:var(--we-accent,var(--gold));box-shadow:0 0 0 2px color-mix(in srgb,var(--we-accent,var(--gold)) 18%,transparent)}#sam-world-engine .we-roster-copy{min-width:0}#sam-world-engine .we-roster-copy b{display:block;font-size:var(--we-fs-body,13px);overflow-wrap:anywhere}#sam-world-engine .we-roster-copy small{display:block;margin-top:2px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-roster-copy em{display:block;margin-top:5px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-small,12px);font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#sam-world-engine .we-area-scene-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}#sam-world-engine .we-area-detail{display:grid;gap:14px}#sam-world-engine .we-area-summary-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:12px;align-items:stretch}#sam-world-engine .we-area-summary-main,#sam-world-engine .we-area-facts{min-width:0;padding:14px 16px;border:1px solid var(--we-line,var(--line));border-radius:11px;background:var(--we-card,#18222f)}#sam-world-engine .we-area-summary-main .we-area-hero{padding-top:0}#sam-world-engine .we-area-scene-wide{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#sam-world-engine .we-area-archive{padding:0 2px}#sam-world-engine .we-explore-index{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}@media(max-width:900px){#sam-world-engine .we-roster-list,#sam-world-engine .we-scene-grid,#sam-world-engine .we-area-scene-grid,#sam-world-engine .we-area-summary-grid,#sam-world-engine .we-area-scene-wide{grid-template-columns:1fr}}"
t = replace_once(t, old_css, new_css, 'role/area CSS')

# person() resolves normalized formal profiles; background people remain read-only but fully viewable.
t = replace_once(
    t,
    "            const person=(name,p,full=false)=>{\n                const rel=(s.关系列表||{})[name]||{};",
    "            const person=(name,p,full=false)=>{\n                const profileName=relationNamesByKey.get(nameKey(name))||'';\n                const rel=profileName?relationRoster[profileName]||{}:{};",
    'person normalized profile',
)
t = replace_once(
    t,
    "(full?fields({目标:p.目标,当前时间段:[p.开始时间,p.预计结束].filter(Boolean).join(' → '),下次检查:p.下次检查,所属世界:p.所属世界,好感度:rel.好感度})",
    "(full?fields({档案类型:profileName?'正式关系人物':'世界活动人物',目标:p.目标,当前时间段:[p.开始时间,p.预计结束].filter(Boolean).join(' → '),下次检查:p.下次检查,所属世界:p.所属世界,好感度:rel.好感度})",
    'person detail source',
)
old_compact = """            const compactPerson=(name,p)=>{
                const profileName=relationNamesByKey.get(nameKey(name))||'';
                const rel=profileName?relationRoster[profileName]||{}:{};
                const inner='<span class=\"we-avatar\">'+text(name.slice(0,1))+'</span><span class=\"we-person-copy\"><strong>'+text(name)+'</strong><small>'+text(p.地点||'地点未明')+'</small><em>'+text(p.行动||p.公开动态||rel.态度||'暂无新动态')+'</em></span>';
                return profileName?'<button class=\"we-person-compact\" data-jump-person=\"'+text(profileName)+'\">'+inner+'</button>':'<article class=\"we-person-compact we-person-label\" title=\"后台临时活动人物，不自动进入关系列表\">'+inner+'</article>';
            };"""
new_compact = """            const compactPerson=(name,p)=>{
                const profileName=relationNamesByKey.get(nameKey(name))||'';
                const rel=profileName?relationRoster[profileName]||{}:{};
                const targetName=profileName||name;
                const inner='<span class=\"we-avatar\">'+text(name.slice(0,1))+'</span><span class=\"we-person-copy\"><strong>'+text(name)+'</strong><small>'+text(p.地点||'地点未明')+'</small><em>'+text(p.行动||p.公开动态||rel.态度||'暂无新动态')+'</em></span>';
                return '<button class=\"we-person-compact\" data-jump-person=\"'+text(targetName)+'\" title=\"'+text(profileName?'查看正式人物档案':'查看世界人物动态；不会创建关系列表档案')+'\">'+inner+'</button>';
            };"""
t = replace_once(t, old_compact, new_compact, 'compact person unified jump')
t = replace_once(
    t,
    "const meta=[item.关系,item.身份,item.可查看档案?'已有档案':'现场标签'].filter(Boolean).join(' · ');",
    "const meta=[item.关系,item.身份,item.档案类型||'世界人物'].filter(Boolean).join(' · ');",
    'scene person source label',
)
t = replace_once(
    t,
    "                return '<div class=\"we-area-scene-grid\">'+sceneLane('现场群体',groups,'group')+sceneLane('资源点',resources,'resource')+'</div>';",
    "                return '<div class=\"we-area-scene-wide\">'+sceneLane('现场群体',groups,'group')+sceneLane('资源点',resources,'resource')+'</div>';",
    'wide area scene body',
)

# Replace entire role-management render branch with one unified roster.
role_branch = r'''            }else if(this.tab==='角色管理'){
                if(showRadar&&alienAlive>0)html+='<div class="we-meta we-alien-count">异端存活数量 <b>'+alienAlive+'</b></div>';

                const alienByKey=new Map(entries(radar.名单).map(([name,record])=>[nameKey(name),{名称:name,记录:record}]));
                const rolePeople=[
                    ...Array.from(formalPeople).map(([n,p])=>[n,p,{正式:true,异端:alienByKey.has(nameKey(n))}]),
                    ...backstagePeople.map(([n,p])=>[n,p,{正式:false,异端:alienByKey.has(nameKey(n))}])
                ];
                const list=rolePeople.filter(([n,p,meta])=>{
                    const searchable=meta.正式?Object.assign({},p,relationRoster[n]||{}):p;
                    if(!matched(n,searchable))return false;
                    if((this.filter||'全部')==='全部')return true;
                    const present=meta.正式&&!!relationRoster[n]?.在场;
                    return this.filter==='在场'?present:!present;
                });
                const chosen=list.find(([n])=>n===this.selectedPerson)||list[0];
                const chosenMeta=chosen?.[2]||{};
                const chosenContext=chosen?derivePersonWorldContext(s,chosen[0],userName):null;
                const chosenRelation=chosenMeta.正式&&plain(relationRoster[chosen?.[0]])?relationRoster[chosen[0]]:null;
                const chosenAudit=chosenRelation?npcBuildAssessment(s,chosen[0],chosenRelation):null;
                const chosenAlien=chosen?alienByKey.get(nameKey(chosen[0]))?.记录:null;
                const auditPanel=chosenAudit?section('NPC构筑审计',
                    '<div class="we-card"><div class="we-card-top"><h3>'+text(chosenAudit.审计级别)+'</h3>'+pill(chosenAudit.缺口.length?'待补强':'构筑完整',chosenAudit.缺口.length?'future':'dim')+'</div>'
                    +fields({层级:chosenAudit.层级,当前组件:chosenAudit.当前组件})
                    +(chosenAudit.缺口.length?'<div class="we-chips">'+chosenAudit.缺口.map(x=>pill(x,'future')).join('')+'</div><p class="we-muted">进入世界推进请求的热人物会由后台优先补齐缺口；难度脚本只负责已有组件的品质调整。</p>':'<p class="we-muted">当前构筑已达到本层级审计最低要求。</p>')+'</div>',
                    '仅正式关系人物 · 复用NPC生成规则'
                ):'';
                const backgroundPanel=chosen?section('背景关联',contextRows(chosenContext),(chosenContext?.背景关联?.length||0)+' 关系 · '+(chosenContext?.关联事件?.length||0)+' 事件'):'';
                const surroundingsPanel=chosen?section('身边发展',sceneContextBody(chosenContext),'剧情推演现场标签 · 只读派生'):'';
                const alienPanel=chosenAlien?section('异端档案',fields({来源:chosenAlien.来源,经历:chosenAlien.经历,阵营:chosenAlien.阵营,职业:chosenAlien.职业,层级:chosenAlien.层级,状态:chosenAlien.状态}),'异端雷达 · 只读'):'';
                const formalCount=rolePeople.filter(([, ,meta])=>meta.正式).length;
                const worldCount=rolePeople.length-formalCount;
                const roster=list.length?'<div class="we-roster-list">'+list.map(([n,p,meta])=>{
                    const rel=meta.正式?relationRoster[n]||{}:{};
                    const present=meta.正式&&!!rel.在场;
                    const status=present?'在场':p.状态||'场外';
                    const source=meta.正式?'正式档案':meta.异端?'异端 · 世界人物':'世界人物';
                    const summary=p.行动||p.公开动态||rel.态度||'等待下一次世界推演';
                    return '<button class="we-roster-person '+(chosen?.[0]===n?'active':'')+'" data-person="'+text(n)+'"><span class="we-roster-copy"><b>'+text(n)+'</b><small>⌖ '+text(p.地点||'地点未明')+' · '+text(status)+'</small><em>'+text(summary)+'</em></span>'+pill(source,meta.异端?'future':'dim')+'</button>';
                }).join('')+'</div>':empty('没有符合条件的人物','调整筛选或等待世界人物进入活动范围。');
                html+=tools(['全部','在场','场外'])+'<div class="we-columns"><div>'
                    +section('人物名册',roster,'正式 '+formalCount+' · 世界人物 '+worldCount)
                    +(chosen?section('身份与当前行动',person(chosen[0],chosen[1],true),chosenMeta.正式?'正式关系人物':'世界后台人物')+surroundingsPanel+section('日程与行动',fields({行程:chosen[1].行程,开始时间:chosen[1].开始时间,预计结束:chosen[1].预计结束,下次检查:chosen[1].下次检查}))+auditPanel:empty('尚未选择人物'))
                    +'</div><aside>'+backgroundPanel+alienPanel+(chosen?[['情报',chosen[1].认知来源||chosen[1].认知],['近期动向',chosen[1].公开动态]].filter(([,v])=>exists(v)).map(([label,v])=>section(label,value(v))).join(''):'')+'</aside></div>';
'''
t = sub_once(
    t,
    r"            \}else if\(this\.tab==='角色管理'\)\{[\s\S]*?            \}else if\(this\.tab==='探索与势力'\)\{",
    role_branch + "            }else if(this.tab==='探索与势力'){",
    'unified role branch',
)

# Exploration: cards become a full-width index; selected region is a separate full-width archive.
t = replace_once(
    t,
    "                        const environment=Array.isArray(r.环境状态)&&r.环境状态.length?r.环境状态.join('、'):r.环境状态||'环境未记录';",
    "                        const environment=Array.isArray(r.环境状态)?(r.环境状态.length?r.环境状态.length+'项':'未记录'):r.环境状态||'未记录';",
    'compact exploration environment summary',
)
old_area_detail = """                        return '<div class=\"we-area-hero\"><small>当前选择</small><h3>'+text(n)+'</h3><div class=\"we-area-progress\"><strong>'+progress+'%</strong><div><span><b>'+text(progressStage(progress))+'</b><em>'+text(next)+'</em></span><div class=\"we-explore-bar\"><i style=\"width:'+progress+'%\"></i></div></div></div></div>'
                            +fields({风险:r.风险,控制方:r.控制方||'未明',争夺方:r.争夺方,环境状态:r.环境状态})
                            +'<div class=\"we-area-note\">'+text(r.描述||'暂无已确认的玩家探索描述。')+'</div>'
                            +areaSceneBody(backstage)
                            +(exists(backstage.进展)||exists(backstage.公开动态)||exists(backstage.资源)||exists(backstage.近期变化)?details('area-world-'+n,{世界进展:backstage.进展,公开动态:backstage.公开动态,资源:backstage.资源,近期变化:backstage.近期变化},'世界地区档案'):'')
                            +(exists(r.隐藏真相)?details('area-truth-'+n,{隐藏真相:r.隐藏真相},'主持人档案'):'');"""
new_area_detail = """                        return '<div class=\"we-area-detail\"><div class=\"we-area-summary-grid\"><div class=\"we-area-summary-main\"><div class=\"we-area-hero\"><small>当前选择</small><h3>'+text(n)+'</h3><div class=\"we-area-progress\"><strong>'+progress+'%</strong><div><span><b>'+text(progressStage(progress))+'</b><em>'+text(next)+'</em></span><div class=\"we-explore-bar\"><i style=\"width:'+progress+'%\"></i></div></div></div></div><div class=\"we-area-note\">'+text(r.描述||'暂无已确认的玩家探索描述。')+'</div></div><div class=\"we-area-facts\">'+fields({风险:r.风险,控制方:r.控制方||'未明',争夺方:r.争夺方,环境状态:r.环境状态})+'</div></div>'
                            +areaSceneBody(backstage)
                            +'<div class=\"we-area-archive\">'+(exists(backstage.进展)||exists(backstage.公开动态)||exists(backstage.资源)||exists(backstage.近期变化)?details('area-world-'+n,{世界进展:backstage.进展,公开动态:backstage.公开动态,资源:backstage.资源,近期变化:backstage.近期变化},'世界地区档案'):'')
                            +(exists(r.隐藏真相)?details('area-truth-'+n,{隐藏真相:r.隐藏真相},'主持人档案'):'')+'</div></div>';"""
t = replace_once(t, old_area_detail, new_area_detail, 'full width area detail body')
old_area_layout = "html+=section('探索结算名录','<div class=\"we-explore-layout\"><div class=\"we-explore-grid\">'+(cards||empty('暂无探索地标','等待玩家实际发现整体区域。'))+'</div><aside class=\"we-area-side\">'+section('区域档案',areaDetail,'点击左侧地标切换')+'</aside></div>','总权重 '+totalProgress+'% · 结算上限 300%');"
new_area_layout = "html+=section('探索结算名录','<div class=\"we-explore-grid we-explore-index\">'+(cards||empty('暂无探索地标','等待玩家实际发现整体区域。'))+'</div>','总权重 '+totalProgress+'% · 结算上限 300%');\n                    html+=section('区域档案',areaDetail,'完整宽度地区现场 · 点击上方地标切换');"
t = replace_once(t, old_area_layout, new_area_layout, 'exploration full width layout')

# No dedicated background-person panel or its CSS should survive.
if "section('后台活动人物'" in t or 'we-temp-person-list' in t:
    raise SystemExit('dedicated background-person UI still present')
ui.write_text(t, encoding='utf-8')

# 6) Update permanent tests to the new semantics.
t = person_test.read_text(encoding='utf-8')
t = replace_once(t, "assert.equal(context.身边人物[1].可查看档案, false);", "assert.equal(context.身边人物[1].可查看档案, true);", 'background nearby clickable 1')
t = replace_once(t, "assert.equal(context.身边人物[2].可查看档案, false);", "assert.equal(context.身边人物[2].可查看档案, true);", 'background nearby clickable 2')
t = replace_once(t, "assert.equal(context.身边人物[2].档案名称, '');", "assert.equal(context.身边人物[2].档案名称, '难民传令兵');\nassert.equal(context.身边人物[2].档案类型, '世界人物');", 'background nearby target')
t = replace_once(t, "  \"section('后台活动人物'\",", "  \"section('人物名册'\",", 'role marker')
t = replace_once(t, "  '正式人物名册',\n  '临时调度，不会自动进入关系列表',", "  'we-roster-list',\n  '世界人物',\n  '异端档案',", 'role source markers')
t = replace_once(t, "assert.ok(!source.includes(\"kind==='person')return '<button class=\\\"we-scene-item\\\" data-person=\"), '身边人物不能一律变成正式人物按钮');\nassert.ok(source.includes('data-jump-person'), '已有正式档案的现场人物应复用安全跳转入口');", "assert.ok(!source.includes(\"section('后台活动人物'\"), '角色管理不应再把世界人物拆成独立后台面板');\nassert.ok(source.includes('data-jump-person'), '正式人物与世界人物都应能跳转统一名册，不会因此写入关系列表');", 'role navigation assertion')
person_test.write_text(t, encoding='utf-8')

t = scene_test.read_text(encoding='utf-8')
t = replace_once(
    t,
    "  '背景关联',\n  '身边发展',\n  '现场群体',\n  '资源点',\n  '身边人物',",
    "  '背景关联',\n  'sceneGroups',\n  '现场群体',\n  '资源点',\n  '人物: group.人物',",
    'scene projection markers',
)
t = replace_once(t, "assert.match(variableProjection, /\\.slice\\(0, 4\\)/, '身边发展必须限制投影规模');", "assert.match(variableProjection, /readonly\\.世界\\.场外人物动态 = groupedScenes/, '正文场外人物动态必须按地区聚合输出');\nassert.doesNotMatch(variableProjection, /身边发展:\\s*Object\\.keys\\(surroundings\\)/, '正文投影不得为每个人复制共享现场');", 'scene projection assertion')
scene_test.write_text(t, encoding='utf-8')

# 7) Docs: update role, prose projection, and exploration information architecture.
t = guide.read_text(encoding='utf-8')
t = replace_once(
    t,
    "- 「世界动向」只保留在世界推进总览；探索与势力页不再重复同一批地区/势力变化。",
    "- 「世界动向」只保留在世界推进总览；探索与势力页不再重复同一批地区/势力变化。探索名录只负责选择地标，`区域档案` 改为下方完整宽度详情；现场群体与资源点并排占用主内容宽度，不再挤入窄右栏。",
    'exploration docs',
)
t = replace_once(
    t,
    "- `身边发展` 与 `身边人物` 不属于 WorldResult Schema，也不持久化。正文投影按人物地点匹配最具体地区，临时组合地区动态、现场群体、资源点、环境状态及同地区人物；人物移动后视图自然变化，不需要模型清理复制数据。",
    "- `身边发展` 与 `身边人物` 不属于 WorldResult Schema，也不持久化。角色管理 UI 仍按人物地点即时派生它们。正文只读的 `世界.场外人物动态` 则按地区聚合：地区动态、现场群体、资源点、环境状态只输出一次，人物子项只保留各自地点、目标、行动、状态、公开动态与关联事件；同地区三个人不会再复制三份相同现场。",
    'grouped prose docs',
)
role_docs = """### 角色管理统一人物名册与现场标签（2026-09-10）

角色管理 UI 不再把 `关系列表` 与 `世界.后台.人物` 拆成两个互相割裂的面板。两类人物现在进入同一个 **统一人物名册**：正式关系人物标记为“正式档案”，只存在于世界后台的人物标记为“世界人物”；活跃异端也直接出现在这里，并额外显示异端雷达中的来源、经历、阵营、职业、层级与状态。

选中任意人物后都复用同一套“身份与当前行动 → 身边发展 → 日程与行动 → 背景关联/情报/近期动向”详情结构。只有正式关系人物才执行 NPC 构筑审计；查看世界人物不会创建 `关系列表`、不会自动晋升 NPC，也不会改变其生命周期。`身边人物` 仍只是按地点派生的剧情现场关系，但只要该人物已经存在于世界后台，就可以跳转到统一名册查看现有资料，不再因为“没有正式档案”而成为不可查看的死标签。

世界推进首页的重点人物使用相同跳转规则。所有这些 UI 都由 `script/世界推进系统.js` 的 Shadow DOM 面板直接渲染，不依赖或新增正文美化正则。

"""
t = sub_once(
    t,
    r"### 角色管理的正式档案与现场标签（2026-09-10）\n\n[\s\S]*?(?=### |\Z)",
    role_docs,
    'role docs section',
)
guide.write_text(t, encoding='utf-8')

t = audit.read_text(encoding='utf-8')
t = t.replace(
    '| 场外人物动态 | 热人物投影，活跃异端强制热 | 项目专用优势 | 保留并扩展世界现场投影 | P1-A | 活跃异端持续活动；死亡后不诈尸；现场信息不复制存储 |',
    '| 场外人物动态 | 热人物投影，活跃异端强制热 | 项目专用优势 | 正文按地区聚合热人物，共享现场只投影一次 | P1-A / 后续修正 | 活跃异端持续活动；死亡后不诈尸；同地区现场不按人物重复输出 |'
)
t = t.replace(
    '| 角色管理 UI | 已有正式名册、背景关联、身边发展、后台活动人物 | 世界关系展示边界已明确 | 保持只读派生与正式档案分离 | P1-B（已完成） | 不造第二份数据；现场标签不自动晋升 NPC |',
    '| 角色管理 UI | 统一人物名册、背景关联、身边发展、异端档案 | 世界关系展示边界已明确 | 正式关系人物与世界人物统一查看，写入职责仍分离 | P1-B（已完成并修正信息架构） | 不造第二份数据；查看世界人物不自动晋升 NPC |'
)
old_boundary = """### 角色展示边界

- 角色管理的正式人物名册只取 `关系列表`；世界后台中没有关系列表档案的人物单列为“后台活动人物”，只表示当前推演需要，不进入 NPC 构筑审计。
- `身边人物` 是按地点派生的剧情推演标签。只有已经存在 `关系列表` 档案的人物才显示可跳转入口；纯后台人物只显示现场标签，不因被点击或被推演而自动晋升。
- 世界推进首页的重点人物遵循同一边界：正式人物可进入角色管理，纯后台活动者只展示动态。
- `背景故事` 继续由 MVU 维护；`背景关联 / 身边发展 / 现场群体 / 资源点` 仍按 P1-A 的数据归属工作。"""
new_boundary = """### 角色展示边界

- 角色管理使用统一人物名册：`关系列表` 人物标记“正式档案”，仅存在于 `世界.后台.人物` 的对象标记“世界人物”；活跃异端不再另开后台活动面板。
- 两类人物都能进入同一只读详情视图；只有正式人物触发 NPC 构筑审计。查看世界人物不创建 `关系列表`，因此“可查看”与“正式建档”不再混为一谈。
- `身边人物` 仍是按地点派生的剧情现场标签；只要后台已有对应人物记录就可跳转统一名册，不会因点击而自动晋升。
- `背景故事` 继续由 MVU 维护；`背景关联 / 身边发展 / 现场群体 / 资源点` 仍按 P1-A 的数据归属工作。正文场外人物动态改为地区级聚合，避免共享现场按人物重复投影。"""
if old_boundary in t:
    t = t.replace(old_boundary, new_boundary, 1)
else:
    raise SystemExit('audit role boundary anchor missing')
audit.write_text(t, encoding='utf-8')

print('context/UI redesign patch applied')
