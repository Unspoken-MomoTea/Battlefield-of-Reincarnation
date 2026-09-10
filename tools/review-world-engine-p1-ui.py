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


# 1. 身边人物只标记是否已有正式关系列表档案；不因为参与后台推演而自动晋升。
source = replace_once(
    source,
    "        const relationByKey=new Map(Object.entries(stat?.关系列表||{}).map(([name,record])=>[key(name),record]));",
    "        const relationByKey=new Map(Object.entries(stat?.关系列表||{}).map(([name,record])=>[key(name),{名称:name,记录:record}]));",
    'context relation index',
)
source = replace_once(
    source,
    """            .map(([name,other])=>{
                const relation=relationByKey.get(key(name))||{};
                const identity=Array.isArray(relation.身份)?relation.身份[0]:String(relation.身份||'');
                return {
                    名称:String(name),
                    关系:key(other.地点)===key(location)?'贴身':'同地区',
                    身份:identity,
                    行动:String(other.行动||other.公开动态||relation.态度||'')
                };
            })""",
    """            .map(([name,other])=>{
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
            })""",
    'context nearby profile marker',
)

# 2. 角色页把正式人物与纯后台活动人物分层；总览仍能看到所有真正活动者。
source = replace_once(
    source,
    """            const peopleAll=new Map(entries(state.人物));entries(s.关系列表).forEach(([n,p])=>{if(!peopleAll.has(n))peopleAll.set(n,{状态:p.在场?'在场':'场外',公开动态:p.态度||'',地点:'',目标:'',行动:''});});
            const userName=String(this.host.SillyTavern?.name1||this.env.SillyTavern?.name1||this.host.SillyTavern?.getContext?.()?.name1||this.host.name1||'').trim();
            const playerAliases=new Set([userName,'{{user}}','<user>','玩家'].filter(Boolean).map(nameKey));
            const deadAlienAliases=new Set(entries(w.异端雷达?.名单).filter(([,alien])=>alien?.状态==='死亡').map(([name])=>nameKey(name)));
            const people=new Map(Array.from(peopleAll).filter(([name])=>!playerAliases.has(nameKey(name))&&!deadAlienAliases.has(nameKey(name))));""",
    """            const relationRoster=s.关系列表||{};
            const relationNamesByKey=new Map(entries(relationRoster).map(([name])=>[nameKey(name),name]));
            const peopleAll=new Map(entries(state.人物));entries(relationRoster).forEach(([n,p])=>{if(!peopleAll.has(n))peopleAll.set(n,{状态:p.在场?'在场':'场外',公开动态:p.态度||'',地点:'',目标:'',行动:''});});
            const userName=String(this.host.SillyTavern?.name1||this.env.SillyTavern?.name1||this.host.SillyTavern?.getContext?.()?.name1||this.host.name1||'').trim();
            const playerAliases=new Set([userName,'{{user}}','<user>','玩家'].filter(Boolean).map(nameKey));
            const deadAlienAliases=new Set(entries(w.异端雷达?.名单).filter(([,alien])=>alien?.状态==='死亡').map(([name])=>nameKey(name)));
            const people=new Map(Array.from(peopleAll).filter(([name])=>!playerAliases.has(nameKey(name))&&!deadAlienAliases.has(nameKey(name))));
            const formalPeople=new Map(entries(relationRoster)
                .filter(([name])=>!playerAliases.has(nameKey(name))&&!deadAlienAliases.has(nameKey(name)))
                .map(([name,rel])=>{
                    const backend=Array.from(people).find(([otherName])=>nameKey(otherName)===nameKey(name))?.[1];
                    return [name,backend||{状态:rel.在场?'在场':'场外',公开动态:rel.态度||'',地点:'',目标:'',行动:''}];
                }));
            const backstagePeople=Array.from(people).filter(([name])=>!relationNamesByKey.has(nameKey(name)));""",
    'formal/backstage person split',
)

# 3. 首页重点人物：正式档案才可点击；后台临时人物只是动态标签。
source = replace_once(
    source,
    """            const compactPerson=(name,p)=>{
                const rel=(s.关系列表||{})[name]||{};
                return '<button class=\"we-person-compact\" data-jump-person=\"'+text(name)+'\"><span class=\"we-avatar\">'+text(name.slice(0,1))+'</span><span class=\"we-person-copy\"><strong>'+text(name)+'</strong><small>'+text(p.地点||'地点未明')+'</small><em>'+text(p.行动||p.公开动态||rel.态度||'暂无新动态')+'</em></span></button>';
            };""",
    """            const compactPerson=(name,p)=>{
                const profileName=relationNamesByKey.get(nameKey(name))||'';
                const rel=profileName?relationRoster[profileName]||{}:{};
                const inner='<span class=\"we-avatar\">'+text(name.slice(0,1))+'</span><span class=\"we-person-copy\"><strong>'+text(name)+'</strong><small>'+text(p.地点||'地点未明')+'</small><em>'+text(p.行动||p.公开动态||rel.态度||'暂无新动态')+'</em></span>';
                return profileName?'<button class=\"we-person-compact\" data-jump-person=\"'+text(profileName)+'\">'+inner+'</button>':'<article class=\"we-person-compact we-person-label\" title=\"后台临时活动人物，不自动进入关系列表\">'+inner+'</article>';
            };""",
    'compact person profile boundary',
)

# 4. 身边人物是剧情推演标签；只有已经存在正式档案者才有跳转按钮。
source = replace_once(
    source,
    """                    if(kind==='person')return '<button class=\"we-scene-item\" data-person=\"'+text(item.名称)+'\"><b>'+text(item.名称)+'</b><small>'+text([item.关系,item.身份].filter(Boolean).join(' · ')||'身边人物')+'</small>'+(item.行动?'<p>'+text(item.行动)+'</p>':'')+'</button>';""",
    """                    if(kind==='person'){
                        const meta=[item.关系,item.身份,item.可查看档案?'已有档案':'现场标签'].filter(Boolean).join(' · ');
                        const inner='<b>'+text(item.名称)+'</b><small>'+text(meta||'现场标签')+'</small>'+(item.行动?'<p>'+text(item.行动)+'</p>':'');
                        return item.可查看档案&&item.档案名称
                            ?'<button class=\"we-scene-item\" data-jump-person=\"'+text(item.档案名称)+'\">'+inner+'</button>'
                            :'<article class=\"we-scene-item we-scene-label\">'+inner+'</article>';
                    }""",
    'scene person label boundary',
)

# 5. 角色管理：正式人物名册只来自关系列表；后台独立行动者另列为不可审计的临时调度区。
source = replace_once(
    source,
    """                const list=Array.from(people).filter(([n,p])=>matched(n,p)&&((this.filter||'全部')==='全部'||(this.filter==='在场'?!!(s.关系列表||{})[n]?.在场:!(s.关系列表||{})[n]?.在场)));
                const chosen=list.find(([n])=>n===this.selectedPerson)||list[0];
                const chosenContext=chosen?derivePersonWorldContext(s,chosen[0],userName):null;
                const chosenAudit=chosen&&plain((s.关系列表||{})[chosen[0]])?npcBuildAssessment(s,chosen[0],(s.关系列表||{})[chosen[0]]):null;""",
    """                const list=Array.from(formalPeople).filter(([n,p])=>matched(n,p)&&((this.filter||'全部')==='全部'||(this.filter==='在场'?!!relationRoster[n]?.在场:!relationRoster[n]?.在场)));
                const backstageList=backstagePeople.filter(([n,p])=>matched(n,p));
                const chosen=list.find(([n])=>n===this.selectedPerson)||list[0];
                const chosenContext=chosen?derivePersonWorldContext(s,chosen[0],userName):null;
                const chosenAudit=chosen&&plain(relationRoster[chosen[0]])?npcBuildAssessment(s,chosen[0],relationRoster[chosen[0]]):null;""",
    'character page roster source',
)
source = replace_once(
    source,
    """                const backgroundPanel=chosen?section('背景关联',contextRows(chosenContext),(chosenContext?.背景关联?.length||0)+' 关系 · '+(chosenContext?.关联事件?.length||0)+' 事件'):'';
                const surroundingsPanel=chosen?section('身边发展',sceneContextBody(chosenContext),'按人物地点派生 · 不复制存储'):'';
                html+=tools(['全部','在场','场外'])+'<div class=\"we-columns\"><div>'+section('人物名册','<div class=\"we-tools\">'+list.map(([n])=>'<button data-person=\"'+text(n)+'\" class=\"'+(chosen?.[0]===n?'active':'')+'\">'+text(n)+'</button>').join('')+'</div>')+(chosen?section('身份与当前行动',person(chosen[0],chosen[1],true))+surroundingsPanel+section('日程与行动',fields({行程:chosen[1].行程,开始时间:chosen[1].开始时间,预计结束:chosen[1].预计结束,下次检查:chosen[1].下次检查}))+auditPanel:empty('没有符合条件的人物'))+'</div><aside>'+backgroundPanel+(chosen?[['情报',chosen[1].认知来源||chosen[1].认知],['近期动向',chosen[1].公开动态]].filter(([,v])=>exists(v)).map(([label,v])=>section(label,value(v))).join(''):'')+'</aside></div>';""",
    """                const backgroundPanel=chosen?section('背景关联',contextRows(chosenContext),(chosenContext?.背景关联?.length||0)+' 关系 · '+(chosenContext?.关联事件?.length||0)+' 事件'):'';
                const surroundingsPanel=chosen?section('身边发展',sceneContextBody(chosenContext),'剧情推演现场标签 · 不复制存储'):'';
                const backstagePanel=backstageList.length?section('后台活动人物','<div class=\"we-temp-person-list\">'+backstageList.slice(0,12).map(([n,p])=>'<article class=\"we-temp-person\"><div class=\"we-card-top\"><h3>'+text(n)+'</h3>'+pill('临时调度','dim')+'</div><div class=\"we-meta\"><span>⌖ '+text(p.地点||'地点未明')+'</span><span>'+text(p.状态||'后台活动')+'</span></div><p>'+text(p.行动||p.公开动态||p.目标||'等待下一次世界推演')+'</p></article>').join('')+'</div><p class=\"we-muted\">这些人物仅因当前世界推演需要保持活动，不属于正式人物名册，也不会触发 NPC 构筑审计。临时调度，不会自动进入关系列表。</p>','纯后台调度 · '+backstageList.length+' 人'):'';
                html+=tools(['全部','在场','场外'])+'<div class=\"we-columns\"><div>'+section('正式人物名册','<div class=\"we-tools\">'+list.map(([n])=>'<button data-person=\"'+text(n)+'\" class=\"'+(chosen?.[0]===n?'active':'')+'\">'+text(n)+'</button>').join('')+'</div>','只显示已存在于关系列表的人物')+(chosen?section('身份与当前行动',person(chosen[0],chosen[1],true))+surroundingsPanel+section('日程与行动',fields({行程:chosen[1].行程,开始时间:chosen[1].开始时间,预计结束:chosen[1].预计结束,下次检查:chosen[1].下次检查}))+auditPanel:empty('没有符合条件的正式人物','后台活动人物不会因此自动晋升为正式 NPC。'))+backstagePanel+'</div><aside>'+backgroundPanel+(chosen?[['情报',chosen[1].认知来源||chosen[1].认知],['近期动向',chosen[1].公开动态]].filter(([,v])=>exists(v)).map(([label,v])=>section(label,value(v))).join(''):'')+'</aside></div>';""",
    'character page split UI',
)

# 6. UI 样式仍全部内置在世界推进系统；不创建/修改正文美化正则。
css_anchor = "#sam-world-engine .we-scene-item p{margin:4px 0 0!important;color:var(--we-sub,var(--sub))!important;font-size:var(--we-fs-small,12px)!important;line-height:1.5!important}#sam-world-engine .we-area-scene-grid"
css_new = "#sam-world-engine .we-scene-item p{margin:4px 0 0!important;color:var(--we-sub,var(--sub))!important;font-size:var(--we-fs-small,12px)!important;line-height:1.5!important}#sam-world-engine .we-scene-label,#sam-world-engine .we-person-label{cursor:default}#sam-world-engine .we-temp-person-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#sam-world-engine .we-temp-person{min-width:0;padding:12px 14px;border:1px dashed var(--we-line,var(--line));border-radius:10px;background:var(--we-card,#18222f)}#sam-world-engine .we-temp-person h3{margin:0}#sam-world-engine .we-temp-person p{margin:6px 0 0;color:var(--we-sub,var(--sub))}@media(max-width:900px){#sam-world-engine .we-temp-person-list{grid-template-columns:1fr}}#sam-world-engine .we-area-scene-grid"
source = replace_once(source, css_anchor, css_new, 'temporary person CSS')

# 7. 文档同步：明确 UI 边界和“参与推演 != 正式档案”。
p1b = """## P1-B：角色管理世界关系 UI（已完成）

- 角色管理的正式人物名册只取 `关系列表`；世界后台中没有关系列表档案的人物单列为“后台活动人物”，只表示当前推演需要，不进入 NPC 构筑审计。
- `身边人物` 是按地点派生的剧情推演标签。只有已经存在 `关系列表` 档案的人物才显示可跳转入口；纯后台人物只显示现场标签，不因被点击或被推演而自动晋升。
- 世界推进首页的重点人物遵循同一边界：正式人物可进入角色管理，纯后台活动者只展示动态。
- `背景故事` 继续由 MVU 维护；`背景关联 / 身边发展 / 现场群体 / 资源点` 仍按 P1-A 的数据归属工作。
- UI 改动全部位于 `script/世界推进系统.js` 的 Shadow DOM 面板，不新增正文美化正则。
- 专项验收由 `tests/world-engine-person-scene-ui.cjs` 覆盖正式档案、现场标签、临时后台人物和地区资源展示。

"""
if '## P1-B：角色管理世界关系 UI（已完成）' not in audit:
    audit = replace_once(audit, '## 后续顺序\n', p1b + '## 后续顺序\n', 'audit P1-B section')
audit = audit.replace('P1-A 世界现场数据语义（已完成） → P1-B 角色管理/UI 视觉重构 → P1-C Prompt 可观测性 → P2 单文件拆分。', 'P1-A 世界现场数据语义（已完成） → P1-B 角色管理/UI 世界关系展示（已完成） → P1-C Prompt 可观测性 → P2 单文件拆分。')

guide_section = """### 角色管理的正式档案与现场标签（2026-09-10）

角色管理 UI 现在区分三种语义：`关系列表` 中的人物属于正式人物名册；仅存在于 `世界.后台.人物` 的对象属于后台临时活动人物；人物详情中的 `身边人物` 则是按地点派生的剧情现场标签。后台人物可以参与世界推演，但这不会自动创建关系列表档案，也不会触发 NPC 构筑审计。

身边人物若已经存在关系列表档案，UI 提供跳转入口并自动回到“全部”筛选后定位正式人物；没有档案的身边人物只显示名称、空间关系和当前行动。世界推进首页的重点人物使用相同规则。所有这些 UI 都由 `script/世界推进系统.js` 的 Shadow DOM 面板直接渲染，不依赖或新增正文美化正则。

"""
if '### 角色管理的正式档案与现场标签（2026-09-10）' not in guide:
    guide = replace_once(guide, '\n## 验证\n', '\n' + guide_section + '## 验证\n', 'guide P1-B section')

# Acceptance assertions before writing.
for marker in [
    '可查看档案:!!profile',
    "档案名称:String(profile?.名称||'')",
    'const formalPeople=new Map',
    'const backstagePeople=',
    "section('正式人物名册'",
    "section('后台活动人物'",
    '临时调度，不会自动进入关系列表',
    "item.可查看档案&&item.档案名称",
    'data-jump-person',
    'we-temp-person-list',
]:
    if marker not in source:
        raise SystemExit(f'missing source marker after review: {marker}')

if "kind==='person')return '<button class=\"we-scene-item\" data-person=" in source:
    raise SystemExit('scene people are still unconditional formal-person buttons')
if 'regex' in str(SCRIPT).lower():
    raise SystemExit('unexpected regex target')
for marker in ['P1-B：角色管理世界关系 UI（已完成）', '不新增正文美化正则']:
    if marker not in audit:
        raise SystemExit(f'missing audit marker: {marker}')
for marker in ['角色管理的正式档案与现场标签', '不依赖或新增正文美化正则']:
    if marker not in guide:
        raise SystemExit(f'missing guide marker: {marker}')

SCRIPT.write_text(source, encoding='utf-8')
AUDIT.write_text(audit, encoding='utf-8')
GUIDE.write_text(guide, encoding='utf-8')
print('P1-B roster boundary review staged')
