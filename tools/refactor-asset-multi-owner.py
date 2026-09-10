from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_bytes().decode('utf-8')
def write(path,text): (ROOT/path).write_bytes(text.encode('utf-8'))
def replace_once(text, old, new, label):
    if old not in text: raise SystemExit(f'anchor not found: {label}')
    if text.count(old) != 1: raise SystemExit(f'anchor count != 1 ({text.count(old)}): {label}')
    return text.replace(old,new,1)

# ZOD: canonical owners array + deletion tombstones.
p='script/ZOD脚本.js'; s=read(p)
anchor="const safeTags = (defaultVal = []) => z.preprocess(\n    v => Array.isArray(v) ? v.filter(item => 'string' === typeof item) : defaultVal,\n    z.array(z.string())\n).prefault(defaultVal).transform(arr => _.uniq(arr));"
insert=anchor+"\n\nconst normalizeAssetOwners = v => {\n    const source = Array.isArray(v) ? v : (v === undefined ? ['<user>'] : [v]);\n    const out = [];\n    for (const raw of source) {\n        const owner = String(raw ?? '').trim();\n        if (!owner || owner === '无主') continue;\n        if (!out.includes(owner)) out.push(owner);\n    }\n    return out;\n};\nconst assetOwners = z.preprocess(v => normalizeAssetOwners(v), z.array(z.string())).prefault(['<user>']);"
s=replace_once(s,anchor,insert,'zod owner helper')
s=replace_once(s,"            运行记录: z.array(z.any()).prefault([]),\n            最近变化: z.array(z.any()).prefault([])","            运行记录: z.array(z.any()).prefault([]),\n            最近变化: z.array(z.any()).prefault([]),\n            // 程序生命周期墓碑：只记用户/MVU明确删除的资产名，防止世界引擎因旧剧情记忆重新创建。\n            资产墓碑: z.record(z.string(), safeStr('')).prefault({})",'zod tombstone')
s=replace_once(s,"        所属对象: safeStr('<user>'),","        所属对象: assetOwners,",'zod asset owner')
write(p,s)

# World engine state: program-owned tombstones.
p='script/world-engine-src/10-world-state.part.js'; s=read(p)
s=replace_once(s,"return { 版本:4, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 剧本:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[] };","return { 版本:4, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 剧本:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{} };",'empty state tombstone')
write(p,s)

# WorldResult schema/compiler: owner arrays, ownerless explicit assets, tombstone guard.
p='script/world-engine-src/20-world-result.part.js'; s=read(p)
s=replace_once(s,"            所属对象:{type:'string',minLength:1},类型:{type:'string'},主体规模:{type:'number',minimum:1,maximum:10},完整度:{type:'number',minimum:0,maximum:100},状态:{type:'string'},","            所属对象:{type:'array',items:{type:'string',minLength:1},maxItems:12},类型:{type:'string'},主体规模:{type:'number',minimum:1,maximum:10},完整度:{type:'number',minimum:0,maximum:100},状态:{type:'string'},",'asset result schema owner')
s=replace_once(s,"        const map=new Map(),stringFields=['所属对象','类型','状态'],numberFields=['主体规模','完整度'];","        const map=new Map(),stringFields=['类型','状态'],numberFields=['主体规模','完整度'];\n        const normalizeOwners=value=>{\n            const source=Array.isArray(value)?value:(value===undefined?[]:[value]),out=[];\n            for(const raw of source){const owner=String(raw??'').trim();if(!owner||owner==='无主'||out.includes(owner))continue;out.push(owner);}\n            return out.slice(0,12);\n        };",'asset normalize owners helper')
s=replace_once(s,"            for(const field of stringFields)if(Object.hasOwn(source,field))item[field]=String(source[field]??'');","            if(Object.hasOwn(source,'所属对象'))item.所属对象=normalizeOwners(source.所属对象);\n            for(const field of stringFields)if(Object.hasOwn(source,field))item[field]=String(source[field]??'');",'asset normalize owner field')
s=replace_once(s,"    const ASSET_DEFAULTS={所属对象:'<user>',类型:'',主体规模:1,完整度:100,状态:'',建设序列:{},驻扎人员:{},待办事件:[]};","    const ASSET_DEFAULTS={所属对象:[],类型:'',主体规模:1,完整度:100,状态:'',建设序列:{},驻扎人员:{},待办事件:[]};",'asset defaults')
old="""        const oldAsset=plain(oldValue)?copy(oldValue):{},asset=Object.assign(copy(ASSET_DEFAULTS),oldAsset);\n        if(!String(asset.所属对象||'').trim())asset.所属对象='<user>';\n        if(isNew){\n            if(!Object.hasOwn(item,'所属对象')||!String(item.所属对象||'').trim())throw new Error('新资产必须明确所属对象：'+item.名称);\n            if(!Object.hasOwn(item,'类型')||!String(item.类型||'').trim())throw new Error('新资产必须明确类型：'+item.名称);\n        }\n        for(const field of ['所属对象','类型','主体规模','完整度','状态'])if(Object.hasOwn(item,field))asset[field]=copy(item[field]);"""
new="""        const oldAsset=plain(oldValue)?copy(oldValue):{},asset=Object.assign(copy(ASSET_DEFAULTS),oldAsset);\n        const normalizeOwners=value=>{const source=Array.isArray(value)?value:(value===undefined?[]:[value]),out=[];for(const raw of source){const owner=String(raw??'').trim();if(!owner||owner==='无主'||out.includes(owner))continue;out.push(owner);}return out.slice(0,12);};\n        // 旧资产没有所属对象时兼容为玩家资产；显式空数组则表示无主。\n        asset.所属对象=Object.hasOwn(oldAsset,'所属对象')?normalizeOwners(oldAsset.所属对象):['<user>'];\n        if(isNew){\n            if(!Object.hasOwn(item,'所属对象'))throw new Error('新资产必须明确所属对象数组；无主资产请使用空数组：'+item.名称);\n            if(!Object.hasOwn(item,'类型')||!String(item.类型||'').trim())throw new Error('新资产必须明确类型：'+item.名称);\n        }\n        if(Object.hasOwn(item,'所属对象'))asset.所属对象=normalizeOwners(item.所属对象);\n        for(const field of ['类型','主体规模','完整度','状态'])if(Object.hasOwn(item,field))asset[field]=copy(item[field]);"""
s=replace_once(s,old,new,'materialize owner semantics')
old="""        for(const item of result.资产||[]){\n            if(item.操作==='撤销本轮')continue;\n            const target=stableNameIn(stat.资产||{},item.名称),existing=target?(stat.资产||{})[target]:undefined;"""
new="""        for(const item of result.资产||[]){\n            if(item.操作==='撤销本轮')continue;\n            const target=stableNameIn(stat.资产||{},item.名称),existing=target?(stat.资产||{})[target]:undefined;\n            const tombstoneName=stableNameIn(stat?.世界?.[PATH]?.资产墓碑||{},item.名称);\n            if(!target&&item.操作!=='移除'&&tombstoneName)throw new Error('资产已被用户或MVU删除，受删除保护，世界引擎不得重建：'+item.名称);"""
s=replace_once(s,old,new,'asset tombstone guard')
write(p,s)

# Context/protocol: expose compact deletion guard and array semantics.
p='script/world-engine-src/30-context-protocol.part.js'; s=read(p)
s=replace_once(s,"            资产:projectAssetsForWorld(src.资产),\n            传闻:copy(src.传闻||{}),","            资产:projectAssetsForWorld(src.资产),\n            资产删除保护:Object.keys(backend.资产墓碑||{}).filter(name=>!stableNameIn(src.资产||{},name)).slice(-50),\n            传闻:copy(src.传闻||{}),",'project deletion guard')
s=replace_once(s,"        if(!Object.keys(out.资产).length)delete out.资产;","        if(!Object.keys(out.资产).length)delete out.资产;\n        if(!out.资产删除保护.length)delete out.资产删除保护;",'drop empty deletion guard')
s=replace_once(s,"资产使用顶层资产作为唯一账簿；所属对象写实际个人或势力，<user>统一写<user>。世界引擎可按已确认场外事件新增、更新、转移或移除资产；当前场景已经结算的变化只同步，不重复计算。","资产使用顶层资产作为唯一账簿；所属对象必须是数组，可包含多个个人/势力，包含<user>表示玩家共同持有，空数组表示无主。世界引擎可按已确认场外事件新增、更新、转移或移除资产；输入中的资产删除保护表示用户/MVU已明确删除的同名资产，不得凭旧剧情记忆重建；当前场景已经结算的变化只同步，不重复计算。",'protocol owner arrays')
write(p,s)

# Prompt v13 + semantics.
p='script/world-engine-src/00-foundation-prompt.part.js'; s=read(p)
s=s.replace('version:12,','version:13,',1)
s=s.replace('顶层资产是个人与势力共用的唯一资产账簿；世界引擎可按已确认场外事实新增、更新、转移或移除资产，并维护所属对象、完整度、能源、消耗、建设、驻扎人员与待办事件。','顶层资产是个人与势力共用的唯一资产账簿；所属对象使用数组，多主体可共管，空数组表示无主，数组含<user>才表示玩家拥有/共管。世界引擎可按已确认场外事实新增、更新、转移或移除资产，并维护完整度、能源、消耗、建设、驻扎人员与待办事件；已进入资产删除保护的同名资产不得自动重建。')
write(p,s)

# Prose current variables: player asset means owners array contains exact <user>.
p='World Book/[variables]当前变量.txt'; s=read(p)
pattern=re.compile(r"const projectionPlayerName = \(\(\) => \{[\s\S]*?const isPlayerOwnedAsset = asset => \{[\s\S]*?\n\};")
repl="""const isPlayerOwnedAsset = asset => {\n  const owners = Array.isArray(asset?.所属对象)\n    ? asset.所属对象\n    : (typeof asset?.所属对象 === 'string' ? [asset.所属对象] : []);\n  return owners.some(owner => String(owner || '').trim() === '<user>');\n};"""
s,n=pattern.subn(repl,s,count=1)
if n!=1: raise SystemExit(f'variables owner helper replacement count {n}')
write(p,s)

# MVU rules + asset rules + behavior ownership wording.
p='World Book/[mvu_update]变量更新规则.txt'; s=read(p)
s=replace_once(s,"      所属对象:\n        type: string\n        check:\n          - 当前实际持有或控制该资产的个人或势力；<user>资产统一写<user>，归属转移时直接更新本字段","      所属对象:\n        type: string[]\n        check:\n          - 当前实际持有或控制该资产的个人/势力列表；允许多个对象共同持有，包含<user>表示玩家拥有/共管，空数组表示无主\n          - 旧资产缺失本字段时兼容迁移为[<user>]；归属变化直接更新数组，不删除重建资产",'mvu owner rules')
write(p,s)

p='World Book/⚙️资产与载具规则.txt'; s=read(p)
s=replace_once(s,"  - 所属对象记录当前实际持有或控制该资产的个人或势力；<user>统一写<user>，旧资产缺失时按<user>兼容\n  - 归属变化直接更新所属对象，不删除重建同一资产；只有所属对象本人/势力及其授权成员可调用资产功能与加成","  - 所属对象为字符串数组，记录当前实际持有或控制该资产的个人/势力；可多方共管，数组包含<user>表示玩家拥有/共管，空数组[]表示无主；旧资产缺失时兼容迁移为[<user>]\n  - 归属变化直接更新所属对象数组，不删除重建同一资产；只有数组中的对象及其授权成员可调用资产功能与加成\n  - 玩家或MVU明确删除资产后视为退出账簿；世界引擎不得凭旧剧情记忆自动重建，只有后续剧情/MVU明确重新建立才解除删除保护",'asset rules owner arrays')
s=s.replace('所属对象: <user>','所属对象: [<user>]')
write(p,s)

p='World Book/⚙️行为判定[mvu_plot].txt'; s=read(p)
s=s.replace('资产归属: 资产加值仅在[所属对象]与执行者一致或执行者获得所属势力授权且当前可调用时生效，禁止借用无关个人/势力资产加成','资产归属: 资产加值仅在[所属对象]数组包含执行者（玩家使用<user>）或执行者获得其中所属势力授权且当前可调用时生效；空数组为无主，未取得控制前不得调用')
write(p,s)

# Auxiliary script: exact <user> harvest gate + deletion tombstone sync on any MVU update.
p='script/辅助计算脚本.js'; s=read(p)
pattern=re.compile(r"    function isPlayerOwnedAsset\(asset, statData\) \{[\s\S]*?\r?\n    \}\r?\n\r?\n    /\*\* 资产全自动收菜系统")
repl="""    function isPlayerOwnedAsset(asset) {\r\n        const owners = Array.isArray(asset?.所属对象)\r\n            ? asset.所属对象\r\n            : (typeof asset?.所属对象 === 'string' ? [asset.所属对象] : []);\r\n        return owners.some(owner => String(owner || '').trim() === '<user>');\r\n    }\r\n\r\n    /** 记录资产显式删除，防止世界引擎根据旧剧情记忆把同名资产重新创建。 */\r\n    function syncRemovedAssets(statData, statDataBefore) {\r\n        if (!statData || !statDataBefore) return [];\r\n        const beforeAssets = statDataBefore.资产 && typeof statDataBefore.资产 === 'object' ? statDataBefore.资产 : {};\r\n        const currentAssets = statData.资产 && typeof statData.资产 === 'object' ? statData.资产 : {};\r\n        statData.世界 = statData.世界 || {};\r\n        statData.世界.后台 = statData.世界.后台 || {};\r\n        const tombstones = statData.世界.后台.资产墓碑 = statData.世界.后台.资产墓碑 || {};\r\n        const removed = [];\r\n        Object.keys(beforeAssets).forEach(name => {\r\n            if (Object.prototype.hasOwnProperty.call(currentAssets, name)) return;\r\n            tombstones[name] = String(statData.世界.时间 || '已删除');\r\n            removed.push(name);\r\n        });\r\n        // 用户/MVU明确重新建立同名资产时解除墓碑。\r\n        Object.keys(currentAssets).forEach(name => { if (Object.prototype.hasOwnProperty.call(tombstones, name)) delete tombstones[name]; });\r\n        return removed;\r\n    }\r\n\r\n    /** 资产全自动收菜系统"""
s,n=pattern.subn(repl,s,count=1)
if n!=1: raise SystemExit(f'helper owner replacement count {n}')
# Existing call uses two args; harmless but make explicit one.
s=s.replace('if (!isPlayerOwnedAsset(asset, statData)) return;','if (!isPlayerOwnedAsset(asset)) return;',1)
call='            syncRemovedRelationshipPeople(statData, statDataBefore);'
if call not in s: raise SystemExit('onUpdate relationship call missing')
s=s.replace(call,call+'\r\n            // 资产删除与重新建立同样走程序生命周期墓碑。\r\n            syncRemovedAssets(statData, statDataBefore);',1)
write(p,s)

# Status bar: all assets remain visible; owner badge/chips + editable tags.
p='script/悬浮球状态栏.js'; s=read(p)
css='.sam-asset-owner-chip { display:inline-flex; align-items:center; max-width:180px; padding:1px 7px; border-radius:9px; border:1px solid var(--sam-border); background:var(--sam-hover); color:var(--sam-text); font-size:10px; line-height:1.5; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\r\n        .sam-asset-owner-chip.player { color:var(--sam-accent); border-color:var(--sam-accent); }\r\n        .sam-asset-owner-chip.unowned { color:var(--sam-sub); border-style:dashed; }\r\n        .sam-asset-owner-list { display:flex; align-items:center; justify-content:flex-end; gap:4px; flex-wrap:wrap; min-width:0; }\r\n        '
anchor='        .sam-asset-integ.bad { color:var(--sam-hp); background:rgba(228,88,125,0.12); }\r\n'
if anchor not in s: anchor=anchor.replace('\r\n','\n'); css=css.replace('\r\n','\n')
s=replace_once(s,anchor,anchor+css,'status owner css')
helper_anchor="    // 资产类型 → 图标"
helpers="""    function normalizeAssetOwnersUi(value) {\r\n        var source = Array.isArray(value) ? value : (value == null ? ['<user>'] : [value]);\r\n        var out = [];\r\n        source.forEach(function(raw) {\r\n            var owner = safeStr(raw).trim();\r\n            if (!owner || owner === '无主' || out.indexOf(owner) >= 0) return;\r\n            out.push(owner);\r\n        });\r\n        return out;\r\n    }\r\n    function assetOwnerChips(owners) {\r\n        if (!owners.length) return '<span class=\"sam-asset-owner-chip unowned\">无主</span>';\r\n        return '<span class=\"sam-asset-owner-list\">' + owners.map(function(owner) {\r\n            return '<span class=\"sam-asset-owner-chip'+(owner === '<user>' ? ' player' : '')+'\">'+esc(owner === '<user>' ? '<user> · 玩家' : owner)+'</span>';\r\n        }).join('') + '</span>';\r\n    }\r\n\r\n"""
if '\r\n' not in s[:1000]: helpers=helpers.replace('\r\n','\n')
s=replace_once(s,helper_anchor,helpers+helper_anchor,'status owner helpers')
s=s.replace('在此管理你的产业、据点与大型载具——它们能为角色提供检定加成、定期产出与战斗支援。','这里显示数据库中的全部资产，包括玩家、NPC、势力共同资产与无主遗迹；只有所属对象包含<user>的资产才启用玩家自动收菜。')
# Add owners variable and summary compact badge.
s=replace_once(s,"        var integW = Math.max(0, Math.min(100, integ));","        var integW = Math.max(0, Math.min(100, integ));\n        var owners = normalizeAssetOwnersUi(a.所属对象);\n        var ownerHead = owners.length === 0 ? '无主' : (owners.length === 1 ? (owners[0] === '<user>' ? '玩家' : owners[0]) : '共管 ' + owners.length);",'status render owners vars')
s=replace_once(s,"            + '<span class=\"sam-asset-badge\">' + esc(type) + '</span>'\n            + '<span class=\"sam-asset-integ '","            + '<span class=\"sam-asset-badge\">' + esc(type) + '</span>'\n            + '<span class=\"sam-asset-badge\">' + esc(ownerHead) + '</span>'\n            + '<span class=\"sam-asset-integ '", 'status head owner badge')
# Add owner row after type in overview. Tags editor supports [] when emptied; special case normalization handled below.
old="""            + '<div class=\"sam-asset-ov-row\">'\n            +   '<span class=\"sam-asset-ov-lbl\">类型</span>'\n            +   '<span class=\"sam-asset-ov-val\">' + (editMode ? editSelect(path + '.类型', ['固定地产', '大型载具与要塞', '便携式据点'], type) : esc(type)) + '</span>'\n            + '</div>'\n            + '</div>';"""
new="""            + '<div class=\"sam-asset-ov-row\">'\n            +   '<span class=\"sam-asset-ov-lbl\">类型</span>'\n            +   '<span class=\"sam-asset-ov-val\">' + (editMode ? editSelect(path + '.类型', ['固定地产', '大型载具与要塞', '便携式据点'], type) : esc(type)) + '</span>'\n            + '</div>'\n            + '<div class=\"sam-asset-ov-row\">'\n            +   '<span class=\"sam-asset-ov-lbl\">所属对象</span>'\n            +   '<span class=\"sam-asset-ov-val\">' + (editMode ? editInput(path + '.所属对象', owners, 'tags') : assetOwnerChips(owners)) + '</span>'\n            + '</div>'\n            + '</div>';"""
if '\r\n' in s[:1000]: old=old.replace('\n','\r\n'); new=new.replace('\n','\r\n')
s=replace_once(s,old,new,'status owner overview')
# Owner tags: blank or “无主” => [] and dedupe before staging.
needle="""        if (type === 'tags') {\n            val = String(val).split(/[,，、]/).map(function(s){return s.trim();}).filter(Boolean);\n        }"""
replacement="""        if (type === 'tags') {\n            val = String(val).split(/[,，、]/).map(function(s){return s.trim();}).filter(Boolean);\n            if (/^资产\\.[^.]+\\.所属对象$/.test(path)) {\n                val = val.filter(function(owner, idx, arr){ return owner !== '无主' && arr.indexOf(owner) === idx; });\n            }\n        }"""
if '\r\n' in s[:1000]: needle=needle.replace('\n','\r\n'); replacement=replacement.replace('\n','\r\n')
s=replace_once(s,needle,replacement,'status owner tag normalization')
write(p,s)

# Documentation/tests version bump and ownership semantics.
for p in ['tests/world-engine-prompt-pipeline.cjs','tests/world-engine-scene-context.cjs','tests/world-engine-asset-writeback.cjs']:
    s=read(p).replace('version:12','version:13').replace('v12','v13')
    write(p,s)
# Existing writeback fixture old scalar becomes array where canonical result is asserted.
p='tests/world-engine-asset-writeback.cjs'; s=read(p)
s=s.replace("所属对象: '<user>'","所属对象: ['<user>']")
s=s.replace("所属对象: '白银之手'","所属对象: ['白银之手']")
s=s.replace("assert.equal(fort.所属对象, '白银之手'","assert.deepEqual(fort.所属对象, ['白银之手']")
s=s.replace("assert.equal(newAsset.所属对象, '白银之手'","assert.deepEqual(newAsset.所属对象, ['白银之手']")
s=s.replace("assert.equal(projected.资产.远征堡.所属对象, '白银之手'","assert.deepEqual(projected.资产.远征堡.所属对象, ['白银之手']")
# New asset missing owner should still reject; no change.
write(p,s)
# old world-engine.cjs onUpdateData stub list, even though suite has unrelated baseline debt.
p='tests/world-engine.cjs'; s=read(p)
s=s.replace("const names=['syncRemovedRelationshipPeople','syncAlienLifecycle'","const names=['syncRemovedRelationshipPeople','syncRemovedAssets','syncAlienLifecycle'")
write(p,s)

# Audit/docs minimal corrections.
p='docs/世界引擎V2审计.md'; s=read(p)
s=s.replace('每项用 `所属对象` 标明当前归属，旧资产缺失时按 `<user>` 兼容。','每项用 `所属对象: string[]` 标明当前归属；可多人/多势力共管，`[]` 表示无主，旧资产缺失时迁移为 `[<user>]`。')
s=s.replace('新增 `所属对象`；世界引擎通过 `WorldResult.资产`','新增数组 `所属对象`；世界引擎通过 `WorldResult.资产`')
write(p,s)
p='script/世界引擎接入说明.md'; s=read(p)
s=s.replace('`所属对象`','`所属对象: string[]`')
# Avoid malformed double typing if repeated replacement occurs; tidy obvious string.
s=s.replace('`所属对象: string[]: string[]`','`所属对象: string[]`')
write(p,s)

print('multi-owner asset lifecycle refactor applied')
