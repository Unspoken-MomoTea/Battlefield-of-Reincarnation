from pathlib import Path

AUDIT = Path('docs/世界引擎V2审计.md')
GUIDE = Path('script/世界引擎接入说明.md')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


audit = AUDIT.read_text(encoding='utf-8')
audit = replace_once(
    audit,
    '| 默认 Prompt 版本 | v8 → v9 | P0 已迁移 | 保留 v9 | P0 | 只刷新首次/内置默认 |',
    '| 默认 Prompt 版本 | v8 → v9 → v10 | P0/P1-A 已迁移 | 保留 v10 | P1-A | 只刷新首次/内置默认 |',
    'audit prompt version row',
)
audit = replace_once(
    audit,
    '## P1-A：世界现场与人物背景关联',
    '## P1-A：世界现场与人物背景关联（已完成）',
    'audit P1-A heading',
)
audit = replace_once(
    audit,
    '- 旧后台记录经 `normalizeBackendState` 自动补新字段，不要求存档迁移脚本。',
    '- `背景关联 / 现场群体 / 资源点` 都是可选明细；旧后台记录不补空数组也仍然合法，不需要存档迁移脚本。',
    'audit migration wording',
)
audit = replace_once(
    audit,
    'P1-A 世界现场数据语义 → P1-B 角色管理/UI 视觉重构 → P1-C Prompt 可观测性 → P2 单文件拆分。',
    'P1-A 世界现场数据语义（已完成） → P1-B 角色管理/UI 视觉重构 → P1-C Prompt 可观测性 → P2 单文件拆分。',
    'audit roadmap status',
)
AUDIT.write_text(audit, encoding='utf-8')

guide = GUIDE.read_text(encoding='utf-8')
guide = replace_once(
    guide,
    '势力地区继续维护控制权、资源、内部派系及近期变化。',
    '势力地区继续维护控制权、资源、内部派系及近期变化，并作为共享“世界现场”容器维护 `现场群体` 与 `资源点`。人物后台新增可选 `背景关联`，只记录持续的团体、组织、社交圈或阵营关系，不替代 MVU 的 `背景故事`，也不复制地点与事件。',
    'guide background/scene ownership',
)
guide = replace_once(
    guide,
    '`世界.场外人物动态` 从后台人物提取名称及非空的地点、目标、行动、状态、更新时间、公开动态和当前事件关联；',
    '`世界.场外人物动态` 从真正热人物提取名称及非空的地点、目标、行动、状态、更新时间、公开动态、背景关联和当前事件关联，并按人物地点临时派生 `身边发展`；身边发展组合匹配地区的现场群体、资源点、环境状态、地区动态与最多4名同地区人物，不写回后台人物；',
    'guide prose projection description',
)
guide = replace_once(
    guide,
    '人物动态中的 `目标 / 行动` 同样是给正文保持人物连续性的规划信息，并不意味着玩家或其他角色已经知道；',
    '人物动态中的 `目标 / 行动 / 背景关联 / 身边发展` 都是给正文保持人物与世界连续性的规划信息，并不意味着玩家或其他角色已经知道；',
    'guide knowledge boundary',
)
anchor = '`node tests/world-engine-ui.cjs` 使用虚构灰港数据运行本地无头 Edge，检查桌面/手机、日期筛选、人物明细、标签页、空状态及返回行为。截图位于 `tests/artifacts`，只用于验收，不会将示例剧情写入角色卡。'
section = '''### 世界现场与人物背景关联（2026-09-10）

世界引擎的角色管理从“人物各自追逐目标”扩展为“共享现场先推进，人物再在现场中行动”。持久状态仍只保存事实本身，不为每个 NPC 复制同一批周边资料：

- `世界.后台.人物.<名称>.背景关联` 是可选明细，元素为 `类型 / 名称 / 关系`；用于组织、团体、社交圈、阵营等持续关系。MVU `关系列表.<名称>.背景故事` 仍是人物履历，两者职责不同。
- `世界.后台.势力地区.<名称>.现场群体` 保存共享群体，元素为 `名称 / 规模 / 身份 / 动态`；例如守军、难民、商队、工人等。
- `世界.后台.势力地区.<名称>.资源点` 保存可争夺、利用、耗尽、破坏或控制的世界地点/设施，元素为 `名称 / 类型 / 状态 / 控制方 / 动态`。它不是玩家 `资产`；只有剧情明确取得长期所有权/控制后，才由正常 MVU 流程转成资产。
- `身边发展` 与 `身边人物` 不属于 WorldResult Schema，也不持久化。正文投影按人物地点匹配最具体地区，临时组合地区动态、现场群体、资源点、环境状态及同地区人物；人物移动后视图自然变化，不需要模型清理复制数据。
- 默认提示词从 v9 升到 v10，执行顺序明确为“先更新当前区间内确实变化的地区现场，再决定人物行动”。自定义提示词文档仍不被内置版本强制覆盖。

专项验证：`node tests/world-engine-scene-context.cjs` 与 `node tests/world-engine-prompt-pipeline.cjs`。

'''
if section.strip() not in guide:
    guide = replace_once(guide, anchor, section + anchor, 'guide P1-A section anchor')
GUIDE.write_text(guide, encoding='utf-8')

for path, markers in {
    AUDIT: ['v8 → v9 → v10', 'P1-A：世界现场与人物背景关联（已完成）', '可选明细'],
    GUIDE: ['### 世界现场与人物背景关联（2026-09-10）', '`身边发展`', '`资源点`', 'v9 升到 v10'],
}.items():
    text = path.read_text(encoding='utf-8')
    for marker in markers:
        if marker not in text:
            raise SystemExit(f'{path}: missing marker {marker}')

print('P1 documentation synchronized')
