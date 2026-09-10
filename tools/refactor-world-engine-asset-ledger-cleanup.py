from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, got {count}')
    return text.replace(old, new, 1)

# 00 foundation prompt -------------------------------------------------------
p='script/world-engine-src/00-foundation-prompt.part.js'
s=read(p)
s=replace_once(s,
    '现场群体、资源点和环境事实写在势力地区；人物只维护自身地点、目标、行动、认知与持续背景关联，不复制地点现场。场外人物、势力与地区按职责、利益、资源、路程、能力和认知运行',
    '现场群体和环境事实写在势力地区；人物只维护自身地点、目标、行动、认知与持续背景关联，不复制地点现场。场外人物、势力与地区按职责、利益、现有资产与地区资源、路程、能力和认知运行',
    'preset step4')
s=replace_once(s,
    '世界引擎负责场外世界，资产只作为世界推演条件读取；当前场景直接事实与即时消费由正文/MVU负责。',
    '世界引擎负责场外世界；现有资产账簿只作为世界推演条件读取，驻扎人员、待办事件、建设序列、能源与消耗可影响后台行动；资产增减、战损、消费与收益仍由正文/MVU资产流程结算。当前场景直接事实与即时消费由正文/MVU负责。',
    'core asset semantics')
s=replace_once(s,
    '5. 现场与人物：现场群体/资源点属于势力地区，人物背景关联只记录持续的团体、组织、社交圈或阵营关系；同一现场事实不得复制进人物。',
    '5. 现场与人物：现场群体与环境事实属于势力地区，人物背景关联只记录持续的团体、组织、社交圈或阵营关系；同一现场事实不得复制进人物。',
    'core scene semantics')
s=replace_once(s, "version:10,", "version:11,", 'builtin prompt version')
write(p,s)

# 10 world-state -------------------------------------------------------------
p='script/world-engine-src/10-world-state.part.js'
s=read(p)
s=replace_once(s,
    "        势力地区: {更新时间:'',控制方:'',争夺方:[],资源:[{名称:'',数量:'',用途:'',限制:''}],内部派系:[{名称:'',立场:'',行动:'',影响:''}],近期变化:[{时间:'',事实:'',关联事件:''}],环境状态:[],现场群体:[{名称:'',规模:'',身份:'',动态:''}],资源点:[{名称:'',类型:'',状态:'',控制方:'',动态:''}]},",
    "        势力地区: {更新时间:'',控制方:'',争夺方:[],资源:[{名称:'',数量:'',用途:'',限制:''}],内部派系:[{名称:'',立场:'',行动:'',影响:''}],近期变化:[{时间:'',事实:'',关联事件:''}],环境状态:[],现场群体:[{名称:'',规模:'',身份:'',动态:''}]},",
    'area details resource points')
s=replace_once(s,
    "            现场群体:objectList(area.现场群体,8),\n            资源点:objectList(area.资源点,8)",
    "            现场群体:objectList(area.现场群体,8)",
    'person context resource points')
write(p,s)

# 30 context/protocol --------------------------------------------------------
p='script/world-engine-src/30-context-protocol.part.js'
s=read(p)
s=replace_once(s,
    "        // 旧档中可能仍有事件→任务引用；后台不再消费任务数据。\n        for(const event of Object.values(projectedBackend.事件))if(plain(event))delete event.关联任务;",
    "        // 旧档中可能仍有事件→任务引用；后台不再消费任务数据。\n        for(const event of Object.values(projectedBackend.事件))if(plain(event))delete event.关联任务;\n        // 早期世界引擎曾误加地区“资源点”。保留旧存档兼容，但不再发送给模型；资产只读取现有顶层资产账簿。\n        for(const area of Object.values(projectedBackend.势力地区||{}))if(plain(area))delete area.资源点;",
    'legacy area resource point strip')
s=replace_once(s,
    '人物背景关联只记录持续的团体/组织/社交关系，不复制地点或事件；现场群体、资源点与环境变化写在势力地区，由地点关系形成身边发展。',
    '人物背景关联只记录持续的团体/组织/社交关系，不复制地点或事件；现场群体与环境变化写在势力地区，由地点关系形成身边发展。',
    'protocol scene ownership')
s=replace_once(s,
    '主神任务、晋升试炼、任务状态、副本成就、奖励、击杀计数、世界时间、玩家属性和玩家持币余额均不属于 WorldResult。',
    '主神任务、晋升试炼、任务状态、副本成就、奖励、击杀计数、世界时间、玩家属性、玩家持币余额和资产账簿均不属于 WorldResult。',
    'protocol asset readonly')
write(p,s)

# 40 runtime -----------------------------------------------------------------
p='script/world-engine-src/40-engine-runtime.part.js'
s=read(p)
s=replace_once(s,
    '每个热地区只出现一次共享环境/现场群体/资源点，人物列表只携带各自行动事实',
    '每个热地区只出现一次共享环境/现场群体，人物列表只携带各自行动事实',
    'runtime prose projection description')
write(p,s)

# 50 UI ----------------------------------------------------------------------
p='script/world-engine-src/50-engine-ui.part.js'
s=read(p)
s=replace_once(s,
    '#sam-world-engine .we-scene-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:11px}',
    '#sam-world-engine .we-scene-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:11px}',
    'scene grid columns')
# Remove obsolete area scene-wide / summary-main layout rules while retaining area detail/facts card.
s=replace_once(s,
    '#sam-world-engine .we-area-detail{display:grid;gap:14px}#sam-world-engine .we-area-summary-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:12px;align-items:stretch}#sam-world-engine .we-area-summary-main,#sam-world-engine .we-area-facts{min-width:0;padding:14px 16px;border:1px solid var(--we-line,var(--line));border-radius:11px;background:var(--we-card,#18222f)}#sam-world-engine .we-area-summary-main .we-area-hero{padding-top:0}#sam-world-engine .we-area-scene-wide{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#sam-world-engine .we-area-archive{padding:0 2px}#sam-world-engine .we-explore-index{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}@media(max-width:900px){#sam-world-engine .we-roster-list,#sam-world-engine .we-scene-grid,#sam-world-engine .we-area-scene-grid,#sam-world-engine .we-area-summary-grid,#sam-world-engine .we-area-scene-wide{grid-template-columns:1fr}}',
    '#sam-world-engine .we-area-detail{display:grid;gap:14px}#sam-world-engine .we-area-facts{min-width:0;padding:14px 16px;border:1px solid var(--we-line,var(--line));border-radius:11px;background:var(--we-card,#18222f)}#sam-world-engine .we-area-archive{padding:0 2px}#sam-world-engine .we-explore-index{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}@media(max-width:900px){#sam-world-engine .we-roster-list,#sam-world-engine .we-scene-grid,#sam-world-engine .we-area-scene-grid{grid-template-columns:1fr}}',
    'area detail CSS')
old="""                    if(kind==='group')return '<article class=\"we-scene-item\"><b>'+text(item.名称||'未命名群体')+'</b><small>'+text([item.规模,item.身份].filter(Boolean).join(' · ')||'现场群体')+'</small>'+(item.动态?'<p>'+text(item.动态)+'</p>':'')+'</article>';
                    return '<article class=\"we-scene-item\"><b>'+text(item.名称||'未命名资源点')+'</b><small>'+text([item.类型,item.状态,item.控制方].filter(Boolean).join(' · ')||'世界资源点')+'</small>'+(item.动态?'<p>'+text(item.动态)+'</p>':'')+'</article>';"""
new="""                    if(kind==='group')return '<article class=\"we-scene-item\"><b>'+text(item.名称||'未命名群体')+'</b><small>'+text([item.规模,item.身份].filter(Boolean).join(' · ')||'现场群体')+'</small>'+(item.动态?'<p>'+text(item.动态)+'</p>':'')+'</article>';
                    return '';"""
s=replace_once(s,old,new,'scene lane resource fallback')
s=replace_once(s,
    "                const hasScene=!!(context&&(context.地区||context.身边人物?.length||context.现场群体?.length||context.资源点?.length));",
    "                const hasScene=!!(context&&(context.地区||context.身边人物?.length||context.现场群体?.length));",
    'scene context resource condition')
s=replace_once(s,
    "+'</div><div class=\"we-scene-grid\">'+sceneLane('身边人物',context.身边人物,'person')+sceneLane('现场群体',context.现场群体,'group')+sceneLane('资源点',context.资源点,'resource')+'</div>';",
    "+'</div><div class=\"we-scene-grid\">'+sceneLane('身边人物',context.身边人物,'person')+sceneLane('现场群体',context.现场群体,'group')+'</div>';",
    'scene context resource lane')
s=replace_once(s,
    "                const groups=Array.isArray(record?.现场群体)?record.现场群体:[],resources=Array.isArray(record?.资源点)?record.资源点:[];\n                if(!groups.length&&!resources.length)return '';\n                return '<div class=\"we-area-scene-wide\">'+sceneLane('现场群体',groups,'group')+sceneLane('资源点',resources,'resource')+'</div>';",
    "                const groups=Array.isArray(record?.现场群体)?record.现场群体:[];\n                if(!groups.length)return '';\n                return sceneLane('现场群体',groups,'group');",
    'area scene body')
old_area="""                        const [n,r]=chosenArea,progress=Math.max(0,Math.min(100,Number(r.探索度)||0));
                        const backstage=regionRecords[n]||{};
                        const next=progress>=100?'已抵达核心':progress>=90?'距离核心仍有关键真相':progress>=60?'继续深入关键区域':progress>=30?'补全路线、资源与风险情报':progress>=10?'建立稳定认知与行动路线':'尚未形成有效探索';
                        return '<div class=\"we-area-detail\"><div class=\"we-area-summary-grid\"><div class=\"we-area-summary-main\"><div class=\"we-area-hero\"><small>当前选择</small><h3>'+text(n)+'</h3><div class=\"we-area-progress\"><strong>'+progress+'%</strong><div><span><b>'+text(progressStage(progress))+'</b><em>'+text(next)+'</em></span><div class=\"we-explore-bar\"><i style=\"width:'+progress+'%\"></i></div></div></div></div><div class=\"we-area-note\">'+text(r.描述||'暂无已确认的玩家探索描述。')+'</div></div><div class=\"we-area-facts\">'+fields({风险:r.风险,控制方:r.控制方||'未明',争夺方:r.争夺方,环境状态:r.环境状态})+'</div></div>'
                            +areaSceneBody(backstage)
                            +'<div class=\"we-area-archive\">'+(exists(backstage.进展)||exists(backstage.公开动态)||exists(backstage.资源)||exists(backstage.近期变化)?details('area-world-'+n,{世界进展:backstage.进展,公开动态:backstage.公开动态,资源:backstage.资源,近期变化:backstage.近期变化},'世界地区档案'):'')
                            +(exists(r.隐藏真相)?details('area-truth-'+n,{隐藏真相:r.隐藏真相},'主持人档案'):'')+'</div></div>';"""
new_area="""                        const [n,r]=chosenArea;
                        const backstage=regionRecords[n]||{};
                        return '<div class=\"we-area-detail\"><div class=\"we-area-facts\">'+fields({风险:r.风险,控制方:r.控制方||'未明',争夺方:r.争夺方,环境状态:r.环境状态})+'<div class=\"we-area-note\">'+text(r.描述||'暂无已确认的玩家探索描述。')+'</div></div>'
                            +areaSceneBody(backstage)
                            +'<div class=\"we-area-archive\">'+(exists(backstage.进展)||exists(backstage.公开动态)||exists(backstage.资源)||exists(backstage.近期变化)?details('area-world-'+n,{世界进展:backstage.进展,公开动态:backstage.公开动态,资源:backstage.资源,近期变化:backstage.近期变化},'世界地区档案'):'')
                            +(exists(r.隐藏真相)?details('area-truth-'+n,{隐藏真相:r.隐藏真相},'主持人档案'):'')+'</div></div>';"""
s=replace_once(s,old_area,new_area,'exploration duplicate selected summary')
s=replace_once(s,
    "html+=section('区域档案',areaDetail,'完整宽度地区现场 · 点击上方地标切换');",
    "html+=section('区域档案',areaDetail,'地区现场与后台档案 · 点击上方地标切换');",
    'area archive subtitle')
write(p,s)

# prose read-only projection --------------------------------------------------
p='World Book/[variables]当前变量.txt'
s=read(p)
s=replace_once(s,
    "      (Array.isArray(record.现场群体) && record.现场群体.length) ||\n      (Array.isArray(record.资源点) && record.资源点.length)",
    "      (Array.isArray(record.现场群体) && record.现场群体.length)",
    'hot scene resourcepoint trigger')
s=replace_once(s,
    "          现场群体: compactSceneList(record.现场群体, ['名称', '规模', '身份', '动态'], 6),\n          资源点: compactSceneList(record.资源点, ['名称', '类型', '状态', '控制方', '动态'], 6),",
    "          现场群体: compactSceneList(record.现场群体, ['名称', '规模', '身份', '动态'], 6),",
    'hot scene resourcepoint projection')
write(p,s)

# tests: scene context --------------------------------------------------------
p='tests/world-engine-scene-context.cjs'
s=read(p)
s=replace_once(s,
    "assert.ok(areaProps.现场群体, '势力地区应支持共享现场群体');\nassert.ok(areaProps.资源点, '势力地区应支持世界资源点');",
    "assert.ok(areaProps.现场群体, '势力地区应支持共享现场群体');\nassert.ok(areaProps.资源, '势力地区应保留原有世界资源摘要');\nassert.equal(areaProps.资源点, undefined, '势力地区不应再维护误加的资源点');",
    'scene schema assertions')
s=replace_once(s,
    "assert.deepEqual(Object.keys(areaProps.现场群体.items.properties), ['名称', '规模', '身份', '动态']);\nassert.deepEqual(Object.keys(areaProps.资源点.items.properties), ['名称', '类型', '状态', '控制方', '动态']);",
    "assert.deepEqual(Object.keys(areaProps.现场群体.items.properties), ['名称', '规模', '身份', '动态']);\nassert.deepEqual(Object.keys(areaProps.资源.items.properties), ['名称', '数量', '用途', '限制']);",
    'scene schema shapes')
old="""    资源点: [
      { 名称: '临时粮仓', 类型: '补给', 状态: '紧缺', 控制方: '白银之手残部', 动态: '每日消耗速度正在加快' },
      { 名称: '废弃修道院', 类型: '避难设施', 状态: '可用', 控制方: '洛丹伦流亡者', 动态: '正在改造成伤员安置点' },
    ],"""
new="""    资源: [
      { 名称: '粮食', 数量: '紧缺', 用途: '维持流亡营', 限制: '补给线受阻' },
    ],"""
s=replace_once(s,old,new,'scene fixture resource')
s=replace_once(s,
    "assert.equal(next.世界.后台.势力地区['安多哈尔南郊'].资源点[0].状态, '紧缺');",
    "assert.equal(next.世界.后台.势力地区['安多哈尔南郊'].资源[0].名称, '粮食');",
    'scene compiled resource assertion')
s=s.replace("  '资源点',\n",'')
s=replace_once(s,
    "assert.match(variableProjection, /readonly\\.世界\\.场外场景 = hotScenes/, '正文必须输出地区级热场景');",
    "assert.match(variableProjection, /readonly\\.世界\\.场外场景 = hotScenes/, '正文必须输出地区级热场景');\nassert.doesNotMatch(variableProjection, /资源点/, '正文热场景不应继续投影误加的资源点');",
    'scene projection no resourcepoint')
s=replace_once(s,
    "/version:10,\\n        builtin:true,\\n        name:'默认设置'/, 'P1-A 默认提示词应升级到 v10'",
    "/version:11,\\n        builtin:true,\\n        name:'默认设置'/, '资产语义纠正后内置默认提示词应升级到 v11'",
    'scene prompt version test')
write(p,s)

# tests: person scene UI ------------------------------------------------------
p='tests/world-engine-person-scene-ui.cjs'
s=read(p)
s=re.sub(r"\n    资源点: \[\n      \{ 名称: '临时粮仓'.*?\n    \],",'',s,count=1,flags=re.S)
s=replace_once(s,"assert.deepEqual(context.资源点.map(x => x.名称), ['临时粮仓']);\n",'', 'person resourcepoint assertion')
s=replace_once(s,"assert.deepEqual(moved.资源点, []);\n",'', 'moved resourcepoint assertion')
s=s.replace("  '资源点',\n",'')
write(p,s)

# tests: hot scenes -----------------------------------------------------------
p='tests/world-engine-hot-scenes.cjs'
s=read(p)
# Remove inline 资源点 arrays from area fixtures, regardless of one/multiple items.
s=re.sub(r", 资源点: \[[^\n]*\]",'',s)
s=replace_once(s,
    "  for (const key of ['身边发展', '身边人物', '现场群体', '资源点', '环境状态']) {",
    "  for (const key of ['身边发展', '身边人物', '现场群体', '环境状态']) {",
    'hot scene person shared keys')
s=replace_once(s,
    "assert.equal(new Set(scenes.map(scene => scene.地区)).size, scenes.length, '同一地区只能出现一个热场景');",
    "assert.equal(new Set(scenes.map(scene => scene.地区)).size, scenes.length, '同一地区只能出现一个热场景');\nassert.equal(scenes.some(scene => Object.hasOwn(scene, '资源点')), false, '热场景不得继续暴露误加的资源点');",
    'hot scene no resourcepoint assertion')
write(p,s)

# tests: context UI redesign --------------------------------------------------
p='tests/world-engine-context-ui-redesign.cjs'
s=read(p)
s=replace_once(s,
    '// 探索页必须把地区详情移出窄右栏，现场群体/资源点使用完整宽度展示。',
    '// 探索页必须把地区详情移出窄右栏，并删除与上方选中地标重复的摘要。',
    'context UI comment')
s=replace_once(s,
    "assert.match(ui, /we-area-scene-wide/, '现场群体与资源点应使用宽版现场布局');\n",
    "assert.doesNotMatch(ui, /<small>当前选择<\\/small>/, '区域档案不应重复上方选中地标摘要');\nassert.doesNotMatch(ui, /sceneLane\\('资源点'/, '区域档案不应再渲染误加的资源点栏');\n",
    'context UI area assertions')
write(p,s)

# tests: prompt pipeline ------------------------------------------------------
p='tests/world-engine-prompt-pipeline.cjs'
s=read(p)
s=replace_once(s,
    '"version:10,\\n        builtin:true,\\n        name:\'默认设置\'", \'built-in prompt version should be 10\'',
    '"version:11,\\n        builtin:true,\\n        name:\'默认设置\'", \'built-in prompt version should be 11\'',
    'pipeline version assertion')
s=replace_once(s,
    "  '现场群体/资源点属于势力地区',",
    "  '现场群体与环境事实属于势力地区',",
    'pipeline core invariant')
s=replace_once(s,
    "assert(protocol.includes('现场群体、资源点与环境变化写在势力地区'), 'protocol should define shared scene ownership');",
    "assert(protocol.includes('现场群体与环境变化写在势力地区'), 'protocol should define shared scene ownership');\nassert(core.includes('现有资产账簿') && core.includes('驻扎人员') && core.includes('待办事件'), 'core should make existing asset ledger relevant to offscreen world actions');",
    'pipeline protocol asset assertions')
write(p,s)

# docs: audit ----------------------------------------------------------------
p='docs/世界引擎V2审计.md'
s=read(p)
s=replace_once(s,
    '- 玩家资产与世界资源点分离：资产是玩家拥有并参与建设/战损/产出的玩法实体；资源点是地区中可争夺、利用、耗尽、破坏或控制的世界事实。',
    '- 顶层 `资产` 是唯一资产账簿；世界引擎只读取其状态、驻扎人员、待办事件、建设序列、能源与消耗作为场外推演条件，不另建地区“资源点”副本，也不直接结算资产增减/战损/消费/收益。',
    'audit asset principle')
s=replace_once(s,
    '| 世界现场容器 | `势力地区` 已有控制方/资源/派系/近期变化 | 已有基础，可自然扩展 | 新增 `现场群体`、`资源点` | P1-A | 群体/资源随地区推进而变化 |',
    '| 世界现场容器 | `势力地区` 已有控制方/资源/派系/近期变化 | 已有基础，可自然扩展 | 仅新增 `现场群体`；原有 `资源` 继续表示地区资源摘要 | P1-A / 语义纠正 | 群体与地区资源随世界推进而变化，不复制玩家资产 |',
    'audit scene container row')
s=replace_once(s,
    '| 世界资源点 | 只有泛 `资源`，与可争夺地点语义混合 | 需要独立世界语义 | 地区新增 `资源点` | P1-A | 粮仓/矿井/避难所等可变化、控制、耗尽 |',
    '| 资产账簿联动 | 顶层 `资产` 已有完整度/能源/消耗单元/建设序列/驻扎人员/待办事件 | 已足以承担资产与后台任务联动 | 世界引擎读取现有资产作为人物/势力/地区行动条件；不生成第二套地区资产数据库 | 语义纠正 | 外派人员、商队、勘察、战争等可参考资产状态，实际账簿变化仍由 MVU 资产流程结算 |',
    'audit resourcepoint row')
s=replace_once(s,
    '| 玩家资产 | 已有完整度/能源/建设/产出/待办 | 独立玩法系统 | 与资源点严格分离，仅允许剧情转换 | P1-A | 世界资源不会凭空成为玩家资产 |',
    '| 玩家资产 | 已有完整度/能源/建设/产出/驻扎/待办 | 唯一资产账簿 | 保留原系统；世界引擎只读引用，不直接写入 | 语义纠正 | 不产生第二资产源；后台行动可受资产现状约束 |',
    'audit player asset row')
s=s.replace('`背景关联 / 身边发展 / 现场群体 / 资源点`','`背景关联 / 身边发展 / 现场群体`')
s=s.replace('默认 Prompt 版本 | v8 → v9 → v10 | P0/P1-A 已迁移 | 保留 v10 | P1-A |', '默认 Prompt 版本 | v8 → v9 → v10 → v11 | P0/P1-A 后因资产语义纠正升级 | 保留 v11 | 语义纠正 |')
write(p,s)

# docs: integration guide ----------------------------------------------------
p='script/世界引擎接入说明.md'
s=read(p)
s=replace_once(s,
    '- 「世界动向」只保留在世界推进总览；探索与势力页不再重复同一批地区/势力变化。探索名录只负责选择地标，`区域档案` 改为下方完整宽度详情；现场群体与资源点并排占用主内容宽度，不再挤入窄右栏。',
    '- 「世界动向」只保留在世界推进总览；探索与势力页不再重复同一批地区/势力变化。探索名录只负责选择地标，`区域档案` 改为下方完整宽度详情，并删除与上方选中地标重复的“当前选择/探索度”摘要；现场群体直接使用主内容宽度，不再挤入窄右栏。',
    'guide exploration UI')
s=replace_once(s,
    '势力地区继续维护控制权、资源、内部派系及近期变化，并作为共享“世界现场”容器维护 `现场群体` 与 `资源点`。',
    '势力地区继续维护控制权、原有 `资源` 摘要、内部派系及近期变化，并作为共享“世界现场”容器维护 `现场群体`。',
    'guide area semantics')
s=replace_once(s,
    '- `世界.后台.势力地区.<名称>.资源点` 保存可争夺、利用、耗尽、破坏或控制的世界地点/设施，元素为 `名称 / 类型 / 状态 / 控制方 / 动态`。它不是玩家 `资产`；只有剧情明确取得长期所有权/控制后，才由正常 MVU 流程转成资产。',
    '- 顶层 `资产` 是唯一资产账簿。世界引擎已经通过 `projectAssetsForWorld` 读取现有资产，可依据完整度、状态、驻扎人员、待办事件、建设序列、能源与消耗单元推进相关后台人物/势力/地区行动；WorldResult 不直接修改资产账簿，资产增减、战损、消费和收益仍由正文/MVU资产流程结算。早期误加的地区 `资源点` 仅兼容旧存档，模型、正文投影与 UI 均忽略，不再生成。',
    'guide resourcepoint bullet')
s=replace_once(s,
    '地区是一级单位，共享环境/群体/资源只出现一次，人物与公开当前事件挂在对应地区下面；',
    '地区是一级单位，共享环境/群体只出现一次，人物与公开当前事件挂在对应地区下面；',
    'guide hot scene shared facts')
s=replace_once(s,
    '- 默认提示词从 v9 升到 v10，执行顺序明确为“先更新当前区间内确实变化的地区现场，再决定人物行动”。自定义提示词文档仍不被内置版本强制覆盖。',
    '- 默认提示词当前为 v11：继续保持“先更新当前区间内确实变化的地区现场，再决定人物行动”，并纠正资产语义为“只读现有资产账簿，不建立地区资源点副本”。自定义提示词文档仍不被内置版本强制覆盖。',
    'guide prompt version')
write(p,s)

print('asset-ledger cleanup patch applied')
