from pathlib import Path
import re

path = Path('script/世界推进系统.js')
source = path.read_text(encoding='utf-8')

revised_core = '''    const CORE_WORLD_RULES = `【世界引擎核心约束】
1. 事实优先级：当前变量与已确认剧情 > 明确世界书 > 模型一般知识；过去事实约束未来，计划不等于事实。
2. 宏观与区间：因果轨道只投影3~5个阶段级宏观节点；细节只展开到下一个宏观边界，局部行动不得升级为宏观节点。没有重大因果变化时保持宏观顺序稳定。
3. 时间与事件：只用世界.时间计算本世界进展，严格服从本轮时间容量、路程和资源；无法确认跨度时只推进一步。待发生/进行中事件必须有可排序的具体时间或明确因果时间，不得只写“近期/稍后/未来/待定/未知”；受正文未决互动影响而尚无结果的事件保持进行中。
4. 认知与职责：人物只有通过在场、既有认知或传播链获得信息后才能行动，不得全知反应。世界引擎负责场外世界，资产只作为世界推演条件读取；当前场景直接事实与即时消费由正文/MVU负责。不得替<user>建立后台行动；主神任务、晋升试炼、任务状态、副本成就不读取、不更新、不据此驱动世界。普通副本返回主神空间后停止本世界推演；单一世界的局部结算不得重置世界。
5. 人物连续性：活跃异端始终保持场外活动并按当前世界时间复核地点、目标、行动与更新时间；死亡异端不可恢复。普通人物只维护与当前地点、事件、关系或近期活动有关的热记录。
6. 玩家台账：探索只结算<user>实际到达/调查/可靠获知的整体区域，后台NPC发现不计玩家探索；探索度以0/10/30/60/90/100作为无知/浅尝/熟悉/深入/掌控/核心锚点，已确认进度不得无因降低。势力仅在<user>首次接触或可靠获知后投影；声望只因<user>造成的真实关系结果变化，同一结果只结算一次，单轮绝对变化≤1000，超过500仅限重大核心事件。
7. 因果偏移：只有关键人物命运、重大事件结果、势力格局或主线可行性被实质改变时记录偏移；影响程度负值表示偏离原轨道，正值表示修复/强化。世界超稳时不新增偏移；重大偏移使旧轨道失效时必须同轮重构宏观顺序。
8. 输出分层：只提交 WorldResult 业务事实，不生成补丁路径。因果.当前阶段是唯一持久世界局势摘要；故事线/下一节点由宏观顺序投影。当前事件公开字段只写已经成为现实且可被合理感知的信息，不泄露后台秘密或未来结局。
9. 基础世界状态：货币只随真实流通体系变化，任务世界不用空间币作本地货币；历法只在可靠设定明确时维护，日期有效性由程序校验。`'''

pattern = r"    const CORE_WORLD_RULES = `.*?`;?\n    function splitPresetSegments"
replacement = revised_core + "\n    function splitPresetSegments"
source, count = re.subn(pattern, lambda _m: replacement, source, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'CORE_WORLD_RULES review patch: expected one match, got {count}')

required_business = [
    '只用世界.时间计算本世界进展',
    '待发生/进行中事件必须有可排序',
    '探索度以0/10/30/60/90/100',
    '单轮绝对变化≤1000',
    '影响程度负值表示偏离原轨道',
    '世界超稳时不新增偏移',
    '死亡异端不可恢复',
    '普通副本返回主神空间后停止本世界推演',
]
for marker in required_business:
    if marker not in source:
        raise SystemExit(f'missing reviewed business invariant: {marker}')

for removed_schema_manual in [
    'WorldResult.探索必须是数组',
    '风险:"F"|"E"|"D"|"C"|"B"|"A"|"S"|"SS"|"SSS"',
    '【WorldResult 标准字段结构】',
]:
    core = re.search(r"const CORE_WORLD_RULES = `(.*?)`;?\n    function splitPresetSegments", source, re.S).group(1)
    if removed_schema_manual in core:
        raise SystemExit(f'schema-level duplication returned to core rules: {removed_schema_manual}')

path.write_text(source, encoding='utf-8')
print('reviewed core chars:', len(re.search(r"const CORE_WORLD_RULES = `(.*?)`;?\n    function splitPresetSegments", source, re.S).group(1)))
