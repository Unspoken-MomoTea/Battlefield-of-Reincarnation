from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_bytes().decode('utf-8')


def write(path, text):
    (ROOT / path).write_bytes(text.encode('utf-8'))


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, got {count}')
    return text.replace(old, new, 1)


def regex_once(text, pattern, repl, label, flags=0):
    next_text, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 regex match, got {count}')
    return next_text

# ---------------------------------------------------------------------------
# 00 foundation prompt: writable shared asset ledger + prompt version 12
# ---------------------------------------------------------------------------
p = 'script/world-engine-src/00-foundation-prompt.part.js'
s = read(p)
s = replace_once(
    s,
    '场外人物、势力与地区按职责、利益、现有资产与地区资源、路程、能力和认知运行，不围绕<user>空转；同场人物以正文为准，即将与<user>相遇时停在交互前一步。',
    '场外人物、势力与地区按职责、利益、现有资产与地区资源、路程、能力和认知运行，不围绕<user>空转；已确认的场外资产变化同步到唯一资产账簿，可新增、更新、转移归属或移除已彻底消失资产；同场人物以正文为准，即将与<user>相遇时停在交互前一步。',
    'preset asset writeback')
s = replace_once(s, 'version:11,', 'version:12,', 'builtin prompt version')
s = replace_once(
    s,
    '4. 认知与职责：人物只有通过在场、既有认知或传播链获得信息后才能行动，不得全知反应。世界引擎负责场外世界；现有资产账簿只作为世界推演条件读取，驻扎人员、待办事件、建设序列、能源与消耗可影响后台行动；资产增减、战损、消费与收益仍由正文/MVU资产流程结算。当前场景直接事实与即时消费由正文/MVU负责。不得替<user>建立后台行动；主神任务、晋升试炼、任务状态、副本成就不读取、不更新、不据此驱动世界。普通副本返回主神空间后停止本世界推演；单一世界的局部结算不得重置世界。',
    '4. 认知与职责：人物只有通过在场、既有认知或传播链获得信息后才能行动，不得全知反应。顶层资产是个人与势力共用的唯一资产账簿；世界引擎可按已确认场外事实新增、更新、转移或移除资产，并维护所属对象、完整度、能源、消耗、建设、驻扎人员与待办事件。正文/MVU已结算的当前场景资产变化只同步，不重复扣算。不得替<user>建立后台行动；主神任务、晋升试炼、任务状态、副本成就不读取、不更新、不据此驱动世界。普通副本返回主神空间后停止本世界推演；单一世界的局部结算不得重置世界。',
    'core asset writeback')
write(p, s)

# ---------------------------------------------------------------------------
# ZOD: every asset has an owner; legacy assets default to <user>
# ---------------------------------------------------------------------------
p = 'script/ZOD脚本.js'
s = read(p)
s = replace_once(
    s,
    "    资产: z.record(z.string(), strictItem(z.object({\n        类型: safeStr(''),",
    "    资产: z.record(z.string(), strictItem(z.object({\n        所属对象: safeStr('<user>'),\n        类型: safeStr(''),",
    'zod asset owner')
write(p, s)

# ---------------------------------------------------------------------------
# MVU rules: owner semantics and split responsibility while engine is enabled
# ---------------------------------------------------------------------------
p = 'World Book/[mvu_update]变量更新规则.txt'
s = read(p)
s = replace_once(
    s,
    '       - 不同资产可并存，禁止无故覆盖；载具/便携据点必须有[能源]\n    "[资产名称]":\n      类型:',
    '       - 不同资产可并存，禁止无故覆盖；载具/便携据点必须有[能源]\n<%_ if (isWorldEngineEnabled) { _%>\n       - 世界引擎开启时，普通变量AI只处理正文当前场景内<user>所属资产的已发生变化；其他个人/势力资产及场外变化由世界引擎维护，禁止重复结算\n<%_ } _%>\n    "[资产名称]":\n      所属对象:\n        type: string\n        check:\n          - 当前实际持有或控制该资产的个人或势力；<user>资产统一写<user>，归属转移时直接更新本字段\n      类型:',
    'mvu asset owner')
write(p, s)

# ---------------------------------------------------------------------------
# Asset rules: one ledger, owner-bound use, world-engine writeback
# ---------------------------------------------------------------------------
p = 'World Book/⚙️资产与载具规则.txt'
s = read(p)
s = replace_once(
    s,
    '执行优先级:\n  - 资产的添加、收益、建设升级必须以事件驱动,严禁无故凭空生成\n  - 若大型载具【能源】枯竭,所有相关功能与DC加成强制失效',
    '资产归属:\n  - 所属对象记录当前实际持有或控制该资产的个人或势力；<user>统一写<user>，旧资产缺失时按<user>兼容\n  - 归属变化直接更新所属对象，不删除重建同一资产；只有所属对象本人/势力及其授权成员可调用资产功能与加成\n  - 顶层资产是正文/MVU与世界引擎共用的唯一账簿；世界引擎可按已确认场外事件新增、更新、转移或移除资产，正文已结算的当前场景变化不得重复结算\n\n执行优先级:\n  - 资产的添加、收益、建设升级必须以事件驱动,严禁无故凭空生成\n  - 若大型载具【能源】枯竭,所有相关功能与DC加成强制失效',
    'asset ownership rules')
s = s.replace('    深红铁匠铺:\n      类型: 固定地产', '    深红铁匠铺:\n      所属对象: <user>\n      类型: 固定地产', 1)
s = s.replace('    星穹号:\n      类型: 大型载具', '    星穹号:\n      所属对象: <user>\n      类型: 大型载具', 1)
write(p, s)

# ---------------------------------------------------------------------------
# Behavior checks: unrelated assets cannot lend bonuses
# ---------------------------------------------------------------------------
p = 'World Book/⚙️行为判定[mvu_plot].txt'
s = read(p)
s = replace_once(
    s,
    '    - 额外加值: 装备、技能、状态、资产、环境可提供额外检定修正\n    - 修正互斥:',
    '    - 额外加值: 装备、技能、状态、资产、环境可提供额外检定修正\n    - 资产归属: 资产加值仅在[所属对象]与执行者一致或执行者获得所属势力授权且当前可调用时生效，禁止借用无关个人/势力资产加成\n    - 修正互斥:',
    'behavior asset ownership')
write(p, s)

# ---------------------------------------------------------------------------
# Ordinary prose/variable AI only sees player-owned assets
# ---------------------------------------------------------------------------
p = 'World Book/[variables]当前变量.txt'
s = read(p)
s = replace_once(
    s,
    "const projectionNameKey = value => String(value || '').toLowerCase().replace(/[\\\\/／·・._\\-\\s]+/g, '');\nconst deadAlienNameKeys = new Set(",
    "const projectionNameKey = value => String(value || '').toLowerCase().replace(/[\\\\/／·・._\\-\\s]+/g, '');\nconst projectionPlayerName = (() => {\n  try {\n    const host = (typeof window !== 'undefined' && window.parent && window.parent !== window) ? window.parent : (typeof window !== 'undefined' ? window : null);\n    return String(host?.SillyTavern?.name1 || host?.SillyTavern?.getContext?.()?.name1 || host?.name1 || '').trim();\n  } catch (_) { return ''; }\n})();\nconst playerOwnerKeys = new Set(['<user>', '{{user}}', '玩家', projectionPlayerName].filter(Boolean).map(projectionNameKey));\nconst isPlayerOwnedAsset = asset => {\n  const owner = String(asset?.所属对象 || '<user>').trim() || '<user>';\n  return playerOwnerKeys.has(projectionNameKey(owner));\n};\nconst deadAlienNameKeys = new Set(",
    'prose player asset helper')
s = replace_once(
    s,
    "const stripHarvestFields = (seq) => _.omit(seq, ['下次产出日期', '下次产出游天']);\nif (!_.isEmpty(data.资产)) {\n  if (!isCombat) {",
    "const stripHarvestFields = (seq) => _.omit(seq, ['下次产出日期', '下次产出游天']);\nconst playerAssets = _.pickBy(data.资产 || {}, asset => isPlayerOwnedAsset(asset));\nif (!_.isEmpty(playerAssets)) {\n  if (!isCombat) {",
    'prose player assets source')
s = replace_once(s, 'current.资产 = _.mapValues(data.资产, (asset, name) => {', 'current.资产 = _.mapValues(playerAssets, (asset, name) => {', 'prose noncombat assets')
s = replace_once(s, 'current.资产 = _.transform(data.资产, (result, asset, name) => {', 'current.资产 = _.transform(playerAssets, (result, asset, name) => {', 'prose combat assets')
write(p, s)

# ---------------------------------------------------------------------------
# Auto-harvest only player-owned assets
# ---------------------------------------------------------------------------
p = 'script/辅助计算脚本.js'
s = read(p)
anchor = '    /** 资产全自动收菜系统 (改由 系统状态.游玩天数 轴驱动, 免疫副本时间跳跃) */\r\n    function autoHarvestAssets(statData, statDataBefore) {'
if anchor not in s:
    anchor = '    /** 资产全自动收菜系统 (改由 系统状态.游玩天数 轴驱动, 免疫副本时间跳跃) */\n    function autoHarvestAssets(statData, statDataBefore) {'
newline = '\r\n' if '\r\n' in anchor else '\n'
helper = (
    '    function isPlayerOwnedAsset(asset, statData) {' + newline +
    "        const normalize = value => String(value || '').toLowerCase().replace(/[\\\\/／·・._\\-\\s]+/g, '');" + newline +
    "        let playerName = '';" + newline +
    '        try {' + newline +
    "            const host = (typeof window !== 'undefined' && window.parent && window.parent !== window) ? window.parent : (typeof window !== 'undefined' ? window : null);" + newline +
    "            playerName = String(host?.SillyTavern?.name1 || host?.SillyTavern?.getContext?.()?.name1 || host?.name1 || '').trim();" + newline +
    '        } catch (e) {}' + newline +
    "        const owners = new Set(['<user>', '{{user}}', '玩家', playerName].filter(Boolean).map(normalize));" + newline +
    "        const owner = String(asset?.所属对象 || '<user>').trim() || '<user>';" + newline +
    '        return owners.has(normalize(owner));' + newline +
    '    }' + newline + newline
)
if anchor not in s:
    raise SystemExit('auto harvest anchor not found')
s = s.replace(anchor, helper + anchor, 1)
loop_anchor = '        Object.entries(assets).forEach(([assetName, asset]) => {'
loop_new = "        Object.entries(assets).forEach(([assetName, asset]) => {\r\n            if (!isPlayerOwnedAsset(asset, statData)) return;" if '\r\n' in s else "        Object.entries(assets).forEach(([assetName, asset]) => {\n            if (!isPlayerOwnedAsset(asset, statData)) return;"
s = replace_once(s, loop_anchor, loop_new, 'auto harvest owner filter')
write(p, s)

# ---------------------------------------------------------------------------
# 10 state: allow atomic /资产/<name> writes
# ---------------------------------------------------------------------------
p = 'script/world-engine-src/10-world-state.part.js'
s = read(p)
s = replace_once(
    s,
    '// 仅允许世界叙事字段与世界经济三字段；玩家数值、持币余额、奖励发放和时钟不在写入名单内。',
    '// 允许世界叙事、世界经济与共享资产账簿；玩家属性、持币余额、奖励发放和时钟仍不在写入名单内。',
    'allowed comment')
s = replace_once(
    s,
    "        if (a === '传闻' && ['街头巷议','情报交易','布告与檄文'].includes(b)) return parts.length === 3;\n        // 只允许修改变量AI已经建立的 NPC；禁止通过世界引擎创建关系列表对象。",
    "        if (a === '传闻' && ['街头巷议','情报交易','布告与檄文'].includes(b)) return parts.length === 3;\n        if (a === '资产') return parts.length === 2 && !!b;\n        // 只允许修改变量AI已经建立的 NPC；禁止通过世界引擎创建关系列表对象。",
    'allowed assets')
write(p, s)

# ---------------------------------------------------------------------------
# 20 WorldResult: schema + normalize + merge + fragment + compile + remove
# ---------------------------------------------------------------------------
p = 'script/world-engine-src/20-world-result.part.js'
s = read(p)
s = replace_once(
    s,
    "    const WORLD_RESULT_LISTS=['事件','人物','势力地区','历史','传播','势力','探索','异端','关系'];",
    "    const WORLD_RESULT_LISTS=['事件','人物','势力地区','历史','传播','势力','探索','资产','异端','关系'];",
    'world result list assets')

asset_schema = """    const ASSET_RESULT_SCHEMA={
        type:'object',additionalProperties:false,required:['名称'],properties:{
            名称:{type:'string',minLength:1},操作:{type:'string',enum:['更新','移除','撤销本轮']},
            所属对象:{type:'string',minLength:1},类型:{type:'string'},主体规模:{type:'number',minimum:1,maximum:10},完整度:{type:'number',minimum:0,maximum:100},状态:{type:'string'},
            能源:{anyOf:[{type:'object',additionalProperties:false,properties:{类型:{type:'string'},当前:{type:'number'},上限:{type:'number'},描述:{type:'string'}}},{type:'null'}]},
            消耗单元:{type:'object',additionalProperties:{anyOf:[{type:'object',additionalProperties:false,properties:{余量:{type:'number'},上限:{type:'number'},加成:{type:'array',items:{type:'string'}}}},{type:'null'}]}},
            建设序列:{type:'object',additionalProperties:{anyOf:[{type:'object',additionalProperties:false,properties:{阶段:{type:'string',enum:['基础','进阶','专业','顶尖','禁忌']},功能:{type:'string'},加成:{type:'array',items:{type:'string'}},产出:{type:'string'}}},{type:'null'}]}},
            驻扎人员:{type:'object',additionalProperties:{anyOf:[{type:'string'},{type:'null'}]}},
            待办事件:{type:'array',items:{type:'string'}}
        }
    };
"""
s = replace_once(s, '    const WORLD_RESULT_SCHEMA={\n', asset_schema + '    const WORLD_RESULT_SCHEMA={\n', 'asset result schema declaration')
s = replace_once(
    s,
    "            探索:{type:'array',maxItems:20,items:EXPLORATION_RESULT_SCHEMA},\n            异端:{type:'array'",
    "            探索:{type:'array',maxItems:20,items:EXPLORATION_RESULT_SCHEMA},\n            资产:{type:'array',maxItems:20,items:ASSET_RESULT_SCHEMA},\n            异端:{type:'array'",
    'asset result schema property')

asset_normalizer = """    function normalizeAssetResultList(value) {
        const sourceList=Array.isArray(value)?value:plain(value)?Object.entries(value).map(([name,item])=>plain(item)?Object.assign({名称:name},copy(item)):{名称:name,操作:item==='移除'?'移除':'更新'}):[];
        const map=new Map(),stringFields=['所属对象','类型','状态'],numberFields=['主体规模','完整度'];
        const normalizeMap=(value,kind)=>{
            if(!plain(value))return {};
            const out={};
            for(const [name,raw] of Object.entries(value)){
                if(forbidden.has(name))continue;
                if(raw===null){out[name]=null;continue;}
                if(kind==='person'){
                    if(typeof raw==='string')out[name]=raw;
                    continue;
                }
                if(!plain(raw))continue;
                const item={};
                if(kind==='unit'){
                    for(const key of ['余量','上限'])if(Object.hasOwn(raw,key)){const n=Number(raw[key]);if(Number.isFinite(n))item[key]=n;}
                    if(Array.isArray(raw.加成))item.加成=raw.加成.filter(x=>typeof x==='string');
                }else{
                    if(Object.hasOwn(raw,'阶段'))item.阶段=String(raw.阶段||'');
                    for(const key of ['功能','产出'])if(Object.hasOwn(raw,key))item[key]=String(raw[key]??'');
                    if(Array.isArray(raw.加成))item.加成=raw.加成.filter(x=>typeof x==='string');
                }
                out[name]=item;
            }
            return out;
        };
        const mergeItem=(previous,item)=>{
            if(!previous)return item;
            const merged=Object.assign({},previous,item);
            for(const field of ['消耗单元','建设序列','驻扎人员']){
                if(plain(previous[field])&&plain(item[field]))merged[field]=Object.assign({},previous[field],item[field]);
            }
            if(plain(previous.能源)&&plain(item.能源))merged.能源=Object.assign({},previous.能源,item.能源);
            return merged;
        };
        for(const source of sourceList){
            if(!plain(source))continue;
            const name=String(source.名称??source.name??'').trim();if(!name||forbidden.has(name))continue;
            const operation=['更新','移除','撤销本轮'].includes(source.操作)?source.操作:'更新';
            const id=nameKey(name);
            if(operation==='撤销本轮'){map.delete(id);continue;}
            const item={名称:name,操作:operation};
            for(const field of stringFields)if(Object.hasOwn(source,field))item[field]=String(source[field]??'');
            for(const field of numberFields)if(Object.hasOwn(source,field)){const n=Number(source[field]);item[field]=Number.isFinite(n)?n:source[field];}
            if(Object.hasOwn(source,'能源')){
                if(source.能源===null)item.能源=null;
                else if(plain(source.能源)){
                    item.能源={};
                    for(const field of ['类型','描述'])if(Object.hasOwn(source.能源,field))item.能源[field]=String(source.能源[field]??'');
                    for(const field of ['当前','上限'])if(Object.hasOwn(source.能源,field)){const n=Number(source.能源[field]);if(Number.isFinite(n))item.能源[field]=n;}
                }
            }
            if(Object.hasOwn(source,'消耗单元'))item.消耗单元=normalizeMap(source.消耗单元,'unit');
            if(Object.hasOwn(source,'建设序列'))item.建设序列=normalizeMap(source.建设序列,'build');
            if(Object.hasOwn(source,'驻扎人员'))item.驻扎人员=normalizeMap(source.驻扎人员,'person');
            if(Object.hasOwn(source,'待办事件'))item.待办事件=Array.isArray(source.待办事件)?source.待办事件.filter(x=>typeof x==='string'):[];
            map.set(id,mergeItem(map.get(id),item));
        }
        return Array.from(map.values());
    }
"""
s = replace_once(s, '    function normalizeRelationResultList(value) {\n', asset_normalizer + '    function normalizeRelationResultList(value) {\n', 'asset normalizer')
s = replace_once(
    s,
    "        for(const key of ['事件','人物','势力地区','历史','传播','势力','探索']){\n            const operations=(key==='传播')?['更新','移除','撤销本轮']:['更新','撤销本轮'];\n            result[key]=normalizeNamedResultList(value[key],sampleForWorldResultList(key),operations);\n        }",
    "        for(const key of ['事件','人物','势力地区','历史','传播','势力','探索']){\n            const operations=(key==='传播')?['更新','移除','撤销本轮']:['更新','撤销本轮'];\n            result[key]=normalizeNamedResultList(value[key],sampleForWorldResultList(key),operations);\n        }\n        result.资产=normalizeAssetResultList(value.资产);",
    'normalize assets')
s = replace_once(
    s,
    "        for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','异端','关系'])result[key]=mergeNamedResultLists(a[key],b[key]);",
    "        for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','资产','异端','关系'])result[key]=mergeNamedResultLists(a[key],b[key]);",
    'merge assets')
s = replace_once(
    s,
    "        for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','异端']){",
    "        for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','资产','异端']){",
    'fragment assets')

asset_materializer = """    const ASSET_DEFAULTS={所属对象:'<user>',类型:'',主体规模:1,完整度:100,状态:'',建设序列:{},驻扎人员:{},待办事件:[]};
    const ASSET_ENERGY_DEFAULTS={类型:'',当前:0,上限:0,描述:''};
    const ASSET_UNIT_DEFAULTS={余量:0,上限:0,加成:[]};
    const ASSET_BUILD_DEFAULTS={阶段:'基础',功能:'',加成:[],产出:'',下次产出日期:'',下次产出游天:0};
    function materializeAssetRecord(oldValue,item,isNew=false) {
        const oldAsset=plain(oldValue)?copy(oldValue):{},asset=Object.assign(copy(ASSET_DEFAULTS),oldAsset);
        if(!String(asset.所属对象||'').trim())asset.所属对象='<user>';
        if(isNew){
            if(!Object.hasOwn(item,'所属对象')||!String(item.所属对象||'').trim())throw new Error('新资产必须明确所属对象：'+item.名称);
            if(!Object.hasOwn(item,'类型')||!String(item.类型||'').trim())throw new Error('新资产必须明确类型：'+item.名称);
        }
        for(const field of ['所属对象','类型','主体规模','完整度','状态'])if(Object.hasOwn(item,field))asset[field]=copy(item[field]);
        if(Object.hasOwn(item,'能源')){
            if(item.能源===null)delete asset.能源;
            else asset.能源=Object.assign(copy(ASSET_ENERGY_DEFAULTS),plain(oldAsset.能源)?copy(oldAsset.能源):{},plain(item.能源)?copy(item.能源):{});
        }
        const mergeNamedMap=(field,defaults)=>{
            if(!Object.hasOwn(item,field))return;
            const merged=plain(oldAsset[field])?copy(oldAsset[field]):{};
            for(const [name,value] of Object.entries(item[field]||{})){
                if(forbidden.has(name))continue;
                if(value===null){delete merged[name];continue;}
                const previous=plain(merged[name])?copy(merged[name]):{};
                merged[name]=Object.assign(copy(defaults),previous,copy(value));
            }
            if(Object.keys(merged).length)asset[field]=merged;else delete asset[field];
        };
        mergeNamedMap('消耗单元',ASSET_UNIT_DEFAULTS);
        mergeNamedMap('建设序列',ASSET_BUILD_DEFAULTS);
        if(Object.hasOwn(item,'驻扎人员')){
            const merged=plain(oldAsset.驻扎人员)?copy(oldAsset.驻扎人员):{};
            for(const [name,value] of Object.entries(item.驻扎人员||{})){
                if(forbidden.has(name))continue;
                if(value===null)delete merged[name];else merged[name]=String(value??'');
            }
            asset.驻扎人员=merged;
        }
        if(Object.hasOwn(item,'待办事件'))asset.待办事件=copy(item.待办事件||[]);
        if(!plain(asset.建设序列))asset.建设序列={};
        if(!plain(asset.驻扎人员))asset.驻扎人员={};
        if(!Array.isArray(asset.待办事件))asset.待办事件=[];
        return asset;
    }
"""
s = replace_once(s, '    function compileWorldResult(stat,value) {\n', asset_materializer + '\n    function compileWorldResult(stat,value) {\n', 'asset materializer')

compile_anchor = "        for(const item of result.探索){\n            const granularity=explorationGranularity(item.名称);"
compile_insert = """        for(const item of result.资产||[]){
            if(item.操作==='撤销本轮')continue;
            const target=stableNameIn(stat.资产||{},item.名称),existing=target?(stat.资产||{})[target]:undefined;
            if(item.操作==='移除'){
                if(target)patches.push({op:'remove',path:pointer(['资产',target])});
                else warnings.push('资产对象不存在，忽略移除：'+item.名称);
                continue;
            }
            const finalName=target||item.名称;
            const record=materializeAssetRecord(existing,item,!target);
            if(existing&&same(existing,record))continue;
            patches.push({op:target?'replace':'add',path:pointer(['资产',finalName]),value:record});
        }
"""
s = replace_once(s, compile_anchor, compile_insert + compile_anchor, 'compile assets')
s = replace_once(
    s,
    "            if (patch.op === 'remove' && !(p[0] === '传闻' || (p[1] === PATH && p[2] === '传播'))) throw new Error('仅可移除过期传播与传闻，其他记录使用状态结束');",
    "            if (patch.op === 'remove' && !(p[0] === '传闻' || (p[1] === PATH && p[2] === '传播') || (p[0] === '资产' && p.length === 2))) throw new Error('仅可移除过期传播、传闻与已彻底消失的资产，其他记录使用状态结束');",
    'asset removal permission')
write(p, s)

# ---------------------------------------------------------------------------
# 30 protocol: shared writable asset ledger
# ---------------------------------------------------------------------------
p = 'script/world-engine-src/30-context-protocol.part.js'
s = read(p)
s = replace_once(
    s,
    '人物背景关联只记录持续的团体/组织/社交关系，不复制地点或事件；现场群体与环境变化写在势力地区，由地点关系形成身边发展。人物、势力地区、传播仍只用事件名称建立关联；不得为玩家建立后台人物记录。关系只更新关系列表中已经存在的对象；HP=0 只用于剧情已确认或场外已确认的死亡，不替正文进行常规战斗结算。\n主神任务、晋升试炼、任务状态、副本成就、奖励、击杀计数、世界时间、玩家属性、玩家持币余额和资产账簿均不属于 WorldResult。',
    '人物背景关联只记录持续的团体/组织/社交关系，不复制地点或事件；现场群体与环境变化写在势力地区，由地点关系形成身边发展。人物、势力地区、传播仍只用事件名称建立关联；不得为玩家建立后台人物记录。关系只更新关系列表中已经存在的对象；HP=0 只用于剧情已确认或场外已确认的死亡，不替正文进行常规战斗结算。\n资产使用顶层资产作为唯一账簿；所属对象写实际个人或势力，<user>统一写<user>。世界引擎可按已确认场外事件新增、更新、转移或移除资产；当前场景已经结算的变化只同步，不重复计算。\n主神任务、晋升试炼、任务状态、副本成就、奖励、击杀计数、世界时间、玩家属性和玩家持币余额均不属于 WorldResult。',
    'protocol asset writeback')
write(p, s)

# ---------------------------------------------------------------------------
# 40 runtime: describe writable ledger and classify asset changes correctly
# ---------------------------------------------------------------------------
p = 'script/world-engine-src/40-engine-runtime.part.js'
s = read(p)
s = replace_once(
    s,
    "                    当前变量:'世界推进专用热数据投影；仅含世界、人物能力、资产、活跃传播、近期历史与近期因果偏移。旧历史/旧偏移仍可留在MVU冷存档，但默认不进入本轮上下文。未提供的任务/商城/纯结算数据不属于本引擎职责。',",
    "                    当前变量:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期历史与近期因果偏移。资产通过WorldResult.资产与同一顶层账簿双向同步；旧历史/旧偏移仍可留在MVU冷存档但默认不进入本轮上下文。未提供的任务/商城/纯结算数据不属于本引擎职责。',",
    'runtime asset semantic')
old_change = """                        const changes=committedPatches.map(p=>{
                            const parts=tokens(p.path),back=parts[1]===PATH;
                            return {时间:base.stat.世界.时间,类别:back?parts[2]:parts[1],名称:back?parts[3]:parts[2],字段:parts.at(-1),操作:p.op==='add'?'新增':p.op==='remove'?'移除':'更新',内容:typeof p.value==='string'?p.value:plain(p.value)?(p.value.描述||p.value.行动||p.value.事实||p.value.目标||p.value.内容||'记录已更新'):''};
                        });"""
new_change = """                        const changes=committedPatches.map(p=>{
                            const parts=tokens(p.path),back=parts[1]===PATH,asset=parts[0]==='资产';
                            return {时间:base.stat.世界.时间,类别:asset?'资产':back?parts[2]:parts[1],名称:asset?parts[1]:back?parts[3]:parts[2],字段:asset?'资产':parts.at(-1),操作:p.op==='add'?'新增':p.op==='remove'?'移除':'更新',内容:typeof p.value==='string'?p.value:plain(p.value)?(p.value.描述||p.value.行动||p.value.事实||p.value.目标||p.value.状态||p.value.内容||'记录已更新'):''};
                        });"""
s = replace_once(s, old_change, new_change, 'runtime asset change log')
write(p, s)

# ---------------------------------------------------------------------------
# Prompt test: v12 + writable ledger semantics
# ---------------------------------------------------------------------------
p = 'tests/world-engine-prompt-pipeline.cjs'
s = read(p)
s = replace_once(s, 'version:11,\\n        builtin:true,\\n        name:\'默认设置\'', 'version:12,\\n        builtin:true,\\n        name:\'默认设置\'', 'prompt test version')
s = replace_once(
    s,
    "assert(core.includes('现有资产账簿') && core.includes('驻扎人员') && core.includes('待办事件'), 'core should make existing asset ledger relevant to offscreen world actions');",
    "assert(core.includes('唯一资产账簿') && core.includes('驻扎人员') && core.includes('待办事件'), 'core should define the shared writable asset ledger');\nassert(protocol.includes('资产使用顶层资产作为唯一账簿') && protocol.includes('新增、更新、转移或移除资产'), 'protocol should expose asset writeback semantics');",
    'prompt test asset semantics')
write(p, s)

# ---------------------------------------------------------------------------
# Docs: supersede read-only asset interpretation with shared ownership ledger
# ---------------------------------------------------------------------------
p = 'docs/世界引擎V2审计.md'
s = read(p)
s = replace_once(
    s,
    '- 顶层 `资产` 是唯一资产账簿；世界引擎只读取其状态、驻扎人员、待办事件、建设序列、能源与消耗作为场外推演条件，不另建地区“资源点”副本，也不直接结算资产增减/战损/消费/收益。',
    '- 顶层 `资产` 是个人与势力共用的唯一资产账簿；每项用 `所属对象` 标明当前归属，旧资产缺失时按 `<user>` 兼容。世界引擎读取并可按已确认场外事实写回资产，不另建地区“资源点”副本；正文已结算的当前场景变化不得重复结算。',
    'audit principle assets')
s = regex_once(
    s,
    r'\| 资产账簿联动 \|[^\n]*',
    '| 资产账簿联动 | 顶层 `资产` 已有完整度/能源/消耗单元/建设序列/驻扎人员/待办事件 | 应成为个人与势力共用的唯一账簿 | 新增 `所属对象`；世界引擎通过 `WorldResult.资产` 新增/更新/转移/移除场外资产，程序负责局部合并与隐藏调度字段保护 | 语义纠正 | NPC外派、势力商队、据点易主、战损和资源消耗均可直接落同一账簿 |',
    'audit asset linkage')
s = regex_once(
    s,
    r'\| 玩家资产 \|[^\n]*',
    '| 玩家资产 | 与其他个人/势力资产共用顶层账簿 | 通过 `所属对象` 区分消费边界 | `<user>` 资产继续供正文/普通变量AI与自动收菜使用；非玩家资产不进入玩家收益/加值视野，但世界引擎可持续维护 | 语义纠正 | 不把敌方据点收成玩家收益，不借用无关资产加成 |',
    'audit player assets')
s = replace_once(s, 'v8 → v9 → v10 → v11', 'v8 → v9 → v10 → v11 → v12', 'audit prompt version history')
s = replace_once(s, '保留 v11', '保留 v12', 'audit prompt version current')
write(p, s)

p = 'script/世界引擎接入说明.md'
s = read(p)
s = replace_once(
    s,
    '- 顶层 `资产` 是唯一资产账簿。世界引擎已经通过 `projectAssetsForWorld` 读取现有资产，可依据完整度、状态、驻扎人员、待办事件、建设序列、能源与消耗单元推进相关后台人物/势力/地区行动；WorldResult 不直接修改资产账簿，资产增减、战损、消费和收益仍由正文/MVU资产流程结算。早期误加的地区 `资源点` 仅兼容旧存档，模型、正文投影与 UI 均忽略，不再生成。',
    '- 顶层 `资产` 是个人与势力共用的唯一资产账簿，每项新增 `所属对象`；玩家统一写 `<user>`，旧存档缺失时按 `<user>` 兼容。世界引擎通过 `projectAssetsForWorld` 读取完整账簿，并可用 `WorldResult.资产` 新增、更新、转移归属或移除已彻底消失的资产；完整度、能源、消耗单元、建设序列、驻扎人员与待办事件均可随场外事实变化。程序按单资产原子合并，保留模型不可见的收菜调度字段。正文/普通变量AI与自动收菜默认只消费 `<user>` 所属资产，其他个人/势力资产不会混成玩家收益；正文已经结算的当前场景变化只同步，不重复扣算。早期误加的地区 `资源点` 仅兼容旧存档，模型、正文投影与 UI 均忽略，不再生成。',
    'guide writable assets')
s = replace_once(
    s,
    '- 默认提示词当前为 v11：继续保持“先更新当前区间内确实变化的地区现场，再决定人物行动”，并纠正资产语义为“只读现有资产账簿，不建立地区资源点副本”。自定义提示词文档仍不被内置版本强制覆盖。',
    '- 默认提示词当前为 v12：继续保持“先更新当前区间内确实变化的地区现场，再决定人物行动”，并把顶层资产明确为可读写的唯一共享账簿；`所属对象` 负责个人/势力归属，世界引擎维护场外变化，正文/MVU维护当前场景直接变化且禁止重复结算。自定义提示词文档仍不被内置版本强制覆盖。',
    'guide prompt v12')
write(p, s)

print('asset ownership/writeback refactor applied')
