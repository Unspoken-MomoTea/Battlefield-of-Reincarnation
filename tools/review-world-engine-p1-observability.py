from pathlib import Path


def replace_once(path, old, new, label):
    text=path.read_text(encoding='utf-8')
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    path.write_text(text.replace(old,new,1),encoding='utf-8')

source=Path('script/世界推进系统.js')
replace_once(
    source,
    "value=(n/1000).toFixed(digits).replace(/\\.0+$|(?<=\\.[0-9])0+$/,'')+'k';",
    "value=(n/1000).toFixed(digits).replace(/(\\.\\d*?[1-9])0+$|\\.0+$/,'$1')+'k';",
    'remove token formatter lookbehind'
)

audit=Path('docs/世界引擎V2审计.md')
replace_once(
    audit,
    '| Prompt 可观测性 | 有 lastRequest，缺长度/来源指标 | 可改善 | 后续加轻量指标 | P1-C | 比较 Prompt 长度/失败率 |',
    '| Prompt 可观测性 | 已有请求预览/原文，但过去只显示字符数且缺少实际模式/重试成本 | 字符数不等于模型上下文成本 | 请求检查统一显示 tk；记录分段构成、资料来源、接口/模型、结构化降级、耗时与每次重试 | P1-C（已完成） | 估算明确标 `≈`；专属 API 有 usage 时显示实际 token |',
    'audit observability matrix'
)
old_tail='''## 后续顺序

P1-A 世界现场数据语义（已完成） → P1-B 角色关系 UI 与视觉系统（已完成） → P1-C Prompt 可观测性 → P2 单文件拆分。'''
new_tail='''## P1-C：Prompt 可观测性（已完成）

- “请求检查”和提示词分段的容量展示统一使用 `tk`，不再把字符数当模型上下文成本。无法取得模型原生 tokenizer 时显示 `≈x tk`；`≈` 明确表示本地估算，不伪装成精确 token。
- 专属 API 返回 `usage` 时，总输入/输出优先显示服务端实际 token；世界书、正文楼层、system/user 分段仍显示估算，因为服务端通常只返回请求总量而不提供分项 token。
- 每次请求记录 system / user / Schema 子项、世界书、正文楼层的 token 构成，以及接口来源、模型、实际结构化模式、`json_schema → json_object → plain` 尝试链和耗时。
- 自动纠错按尝试单独记录输入/输出 token、接受/拒绝/请求失败状态与失败原因，因此可以区分“Prompt 太大”“提供方结构化不兼容”和“业务验收失败”。
- 主神终端路径无法从世界引擎可靠取得提供方 usage/最终结构化模式时，只显示估算值与“auto（由主神终端协商）”，不伪造精确数据。
- Schema 已包含在 system 请求中；诊断页将其标为 system 的子项，不与总输入重复相加。
- 观测数据仅保存在当前页面内存；聊天切换、swipe、删除消息和 `resetInspection()` 会一起清空，不写入 MVU，不写入 localStorage。
- P1-C 不修改 DEFAULT_PRESET、CORE_WORLD_RULES、WorldResult Schema、世界变量、生命周期或推演语义，只增加诊断信息。
- `tests/world-engine-observability.cjs` 固定验证 tk 格式、估算/实际 usage 区分、专属 API 结构化降级观测、内存清理及原有 24 万字符内部安全上限不变。

## 后续顺序

P1-A 世界现场数据语义（已完成） → P1-B 角色关系 UI 与视觉系统（已完成） → P1-C Prompt 可观测性（已完成） → P2 单文件拆分。'''
replace_once(audit,old_tail,new_tail,'audit P1-C section')

integration=Path('script/世界引擎接入说明.md')
replace_once(
    integration,
    '现代 WorldResult 回复发生业务验收失败时，采用**分片暂存 + 最终原子提交**。回复会先拆成公开摘要、货币字段、历法字段，以及事件/人物/势力/探索/传播/传闻等单个业务实体；每个片段先独立编译并在当前存档上试运行。',
    '现代 WorldResult 回复发生业务验收失败时，采用**分片暂存 + 最终原子提交**。回复会先拆成摘要、货币字段、历法字段，以及事件/人物/势力/探索/传播/传闻等单个业务实体；每个片段先独立编译并在当前存档上试运行。',
    'remove stale public summary wording'
)
replace_once(
    integration,
    '“请求检查”只显示当前聊天/存档上下文的运行资料。CHAT_CHANGED / MESSAGE_SWIPED / MESSAGE_DELETED 会取消旧请求并清空 lastRequest、previewRequest、lastReply、lastWorldResult、编译补丁、失败记录与重试计数；这些检查资料从不写入 MVU 或 localStorage。纠错重试字段结构由程序生成，但其中的上次回复、已接受业务结果和补充清单只存在当前运行内存中。',
    '“请求检查”只显示当前聊天/存档上下文的运行资料，并以 token 为主要容量单位：带 `≈` 的 `tk` 是本地估算；专属 API 返回 `usage` 时，请求总输入/输出改用服务端实际 token。页面同时显示 system/user/Schema 子项、世界书与正文楼层构成、接口来源、模型、实际结构化模式/降级链、耗时和逐次纠错结果。Schema 是 system 的子项，不与总输入重复相加。CHAT_CHANGED / MESSAGE_SWIPED / MESSAGE_DELETED 会取消旧请求并清空 lastRequest、previewRequest、lastReply、lastWorldResult、编译补丁、失败记录、重试计数与观测记录；这些检查资料从不写入 MVU 或 localStorage。',
    'integration token inspection'
)
replace_once(
    integration,
    '- 请求检查默认仅展示数量，清单和 system/user 分段阅读均折叠；完整原文单独保留，长内容在固定高度内滚动。user 原文发送时也有 JSON 缩进，分段阅读按世界书、变量、正文楼层、到期事件展开。',
    '- 请求检查首屏展示本轮输入/输出 `tk`、接口和结构化模式；容量细分、世界书/正文清单、system/user 分段阅读仍按需折叠，完整原文单独保留并在固定高度内滚动。带 `≈` 的 tk 为本地估算，专属 API 有 `usage` 时请求总量显示实际 token。',
    'integration request inspection bullet'
)

print('P1-C final review changes staged')
