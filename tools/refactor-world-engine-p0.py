from pathlib import Path
import re

path = Path('script/世界推进系统.js')
source = path.read_text(encoding='utf-8')

default_preset = '''    const DEFAULT_PRESET = `你是轮回战场的世界引擎。只维护正文场景之外仍会继续运行的世界事实，并把同一轮的事件、场外人物、势力地区、传播、探索/势力结算与因果轨道保持一致。
【执行流程】
Step 1 · 读取事实：以当前变量与本轮已确认剧情为最高事实；明确世界书用于补充或校正设定；资料缺失时可使用模型已有的原著/世界知识，但不得覆盖已确认差异。主神任务、晋升试炼、任务状态、副本成就不属于输入依据。
Step 2 · 校准宏观骨架：维护3~5个真正会改变篇章、地区、社会、战争、基础设施、势力格局或关键人物命运的宏观节点，并确定当前局势与下一个宏观边界。撤离、赶路、会合、调查、单次战斗、通过局部障碍等只属于当前事件或近期节点。
Step 3 · 推进当前区间：只展开“当前世界时间 → 下一宏观节点”之间需要发生的事实。严格服从请求给出的本轮时间容量；先处理已经到期或正在进行的事项，再让未完事项向前推进合理一步。时间未推进时只能同步即时事实；未来计划不得写成已发生事实，下一个宏观边界之后不要提前拆成琐碎行动。
Step 4 · 推演场外实体：场外人物、势力与地区按自身职责、利益、资源、路程、能力和认知行动，不围绕<user>空转。人物只有通过在场、既有认知或传播链获得信息后才能据此行动；同场人物以正文为准，即将与<user>相遇时停在交互前一步。活跃异端始终视为热人物并复核地点、目标、行动与更新时间；死亡异端不可恢复活动。
Step 5 · 维护因果与玩家结算台账：只有关键人物命运、重大事件结果、势力格局或主线可行性被实质改变时才写偏移；若原宏观轨道因此失效，同轮重构宏观顺序。探索只记录<user>实际到达、调查或可靠获知的整体区域成果，后台NPC的发现不转成玩家探索度；势力声望只因<user>对该势力造成的真实帮助、损害、背叛等结果变化。
Step 6 · 维护世界传播与基础状态：只在事件确实产生新传播时维护传闻、情报或公告，并区分事实、猜测和谣言；已结束/过期传播不得复活。货币与历法只在世界事实确有变化或可靠设定明确时维护；任务世界不得把空间币当作本地货币。
Step 7 · 输出差分：只提交本轮新确认或真实变化的 WorldResult 业务事实；没有业务变化时只写摘要。因果.当前阶段是一段可直接阅读的当前世界局势；正在发生且可能被正文感知的当前事件，把已经成为现实的公开征兆/可见影响写入公开字段，隐藏计划、内幕和未来结局继续留在后台字段。
【执行检查】结果必须同时满足：时间与路程可实现；人物知识有来源；同一人物不在同一时段出现在两处；不复述正文已演出的对白与琐碎同步动作；不替<user>行动或裁决正文未结束冲突；不把局部桥接动作冒充宏观节点；不捏造无依据的精确日期；世界不会因为<user>没有行动而暂停。`;'''

core_rules = '''    const CORE_WORLD_RULES = `【世界引擎核心约束】
1. 事实优先级：当前变量与已确认剧情 > 明确世界书 > 模型一般知识；过去事实约束未来，计划不等于事实。
2. 宏观与区间：因果轨道只投影3~5个阶段级宏观节点；细节只展开到下一个宏观边界，局部行动不得升级为宏观节点。
3. 时间与认知：严格服从本轮时间容量、路程、资源和信息来源；无法确认跨度时只推进一步，不得全知反应或虚构耗时成果。
4. 职责隔离：世界引擎维护场外世界；当前场景直接事实与即时消费由正文/MVU负责。不得替<user>建立后台人物行动；主神任务、晋升试炼、任务状态、副本成就不读取、不更新、不据此驱动世界。
5. 人物连续性：活跃异端始终保持场外活动并按当前世界时间复核；死亡异端不可恢复。普通人物只维护与当前地点、事件、关系或近期活动有关的热记录。
6. 玩家台账：探索只结算<user>实际到达/调查/可靠获知的整体区域；后台NPC发现不计玩家探索。势力声望只因<user>造成的真实关系结果变化，同一结果不得重复结算。
7. 因果偏移：只有关键人物命运、重大事件结果、势力格局或主线可行性被实质改变时记录偏移；重大偏移使旧轨道失效时必须同轮重构宏观顺序。
8. 输出分层：只提交 WorldResult 业务事实，不生成补丁路径。因果.当前阶段是唯一持久世界局势摘要；故事线/下一节点由宏观顺序投影。当前事件公开字段只写已经成为现实且可被合理感知的信息，不泄露后台秘密或未来结局。
9. 基础世界状态：货币只随真实流通体系变化，任务世界不用空间币作本地货币；历法只在可靠设定明确时维护，日期有效性由程序校验。`'''

protocol_fn = r'''    function protocol() {
        const schemaText=JSON.stringify(WORLD_RESULT_SCHEMA,null,2);
        return `只输出一个 WorldResult JSON 对象，不输出 Markdown、解释、思考过程、<thinking> 或 JSON Pointer。
省略某业务字段表示本轮没有该类变化；已有实体只写真实变化字段，新增实体写足够确定它的事实。实体始终用“名称”关联，程序负责名称归一、增量合并、补丁编译、引用同步和最终校验。
“操作”默认“更新”；移除只用于 Schema 允许移除的传播/传闻记录；“撤销本轮”只用于纠错重试，不代表删除存档中的既有实体。
事件分类只使用当前事件/近期节点/宏观节点。进行中的当前事件若可能被正文感知，公开征兆/可见影响只能写已经成为现实的公开信息，不得包含隐藏条件、默认走向或未来计划。
因果只提交当前阶段、宏观顺序和偏移记录。当前阶段必须是可直接阅读的当前世界局势；宏观顺序只列3~5个宏观事件名称；输入中的偏移摘要是只读统计，不得据此重建已经隐藏的旧偏移。
人物、势力地区、传播只用事件名称建立关联；不得为玩家建立后台人物记录。关系只更新关系列表中已经存在的对象；HP=0 只用于剧情已确认或场外已确认的死亡，不替正文进行常规战斗结算。
主神任务、晋升试炼、任务状态、副本成就、奖励、击杀计数、世界时间、玩家属性和玩家持币余额均不属于 WorldResult。不要输出已废弃的“公开摘要”或“正文承接”。

【Canonical WorldResult JSON Schema】
以下 Schema 是唯一字段结构定义；即使 API 降级到 json_object 或 plain，也必须严格遵守。文字业务约束与 Schema 冲突时以 Schema 的字段结构和值域为准：
${schemaText}

兼容解析只用于旧存档和故障兜底，新回复不要主动使用旧 map 简写或 summary+patches 格式。`;
    }
'''


def sub_once(text, pattern, replacement, label):
    out, count = re.subn(pattern, lambda _m: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return out


source = sub_once(
    source,
    r"    const DEFAULT_PRESET = `.*?`;\n    const BUILTIN_DEFAULT_SELECTED_ENTRIES =",
    default_preset + "\n    const BUILTIN_DEFAULT_SELECTED_ENTRIES =",
    'DEFAULT_PRESET',
)
source = sub_once(
    source,
    r"    const CORE_WORLD_RULES = `.*?`;?\n    function splitPresetSegments",
    core_rules + "\n    function splitPresetSegments",
    'CORE_WORLD_RULES',
)
source = sub_once(
    source,
    r"    function protocol\(\) \{\n        const schemaText=JSON\.stringify\(WORLD_RESULT_SCHEMA,null,2\);\n        return `.*?`;\n    \}\n    const NPC_BUILD_AUDIT_RULES=",
    protocol_fn + "    const NPC_BUILD_AUDIT_RULES=",
    'protocol()',
)

old_version = "        version:8,\n        builtin:true,\n        name:'默认设置',"
new_version = "        version:9,\n        builtin:true,\n        name:'默认设置',"
if source.count(old_version) != 1:
    raise SystemExit(f'builtin prompt version marker: expected one match, got {source.count(old_version)}')
source = source.replace(old_version, new_version, 1)

required = [
    'const WORLD_RESULT_SCHEMA',
    "['json_schema','json_object','plain']",
    'NPC_BUILD_AUDIT_RULES',
    'function compactWorldLifecycle',
    'function projectWorldContext',
    'builtinDefaultPromptVersionApplied',
    'version:9',
]
for marker in required:
    if marker not in source:
        raise SystemExit(f'missing required architecture marker: {marker}')

preset_match = re.search(r"const DEFAULT_PRESET = `(.*?)`;\n    const BUILTIN_DEFAULT_SELECTED_ENTRIES", source, re.S)
core_match = re.search(r"const CORE_WORLD_RULES = `(.*?)`;?\n    function splitPresetSegments", source, re.S)
proto_match = re.search(r"function protocol\(\).*?return `(.*?)`;\n    \}", source, re.S)
if not (preset_match and core_match and proto_match):
    raise SystemExit('post-refactor prompt sections are not readable')
preset, core, proto = preset_match.group(1), core_match.group(1), proto_match.group(1)
if '【WorldResult 标准字段结构】' in proto:
    raise SystemExit('protocol still contains duplicated field-manual section')
if '风险只能是 F/E/D/C/B/A/S/SS/SSS' in preset or 'WorldResult.探索必须是数组' in core:
    raise SystemExit('prompt still contains duplicated schema-level exploration rules')
if '【执行流程】' not in preset or 'Step 7 · 输出差分' not in preset:
    raise SystemExit('pipeline prompt was not installed')

path.write_text(source, encoding='utf-8')
print('DEFAULT_PRESET chars:', len(preset))
print('CORE_WORLD_RULES chars:', len(core))
print('protocol semantic template chars:', len(proto))
