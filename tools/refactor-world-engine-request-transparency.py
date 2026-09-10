from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
runtime = ROOT / 'script/world-engine-src/40-engine-runtime.part.js'
ui = ROOT / 'script/world-engine-src/50-engine-ui.part.js'
audit = ROOT / 'docs/世界引擎V2审计.md'
guide = ROOT / 'script/世界引擎接入说明.md'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, got {text.count(old)}')
    return text.replace(old, new, 1)


text = runtime.read_text(encoding='utf-8')
text = replace_once(
    text,
    '                世界书:books,',
    "                世界书:books.map(b=>String(b.内容||'')).filter(Boolean),",
    'content-only worldbook payload',
)
start = text.find("+'\\n\\n【本轮执行顺序】\\n1. 读事实：")
if start < 0:
    raise SystemExit('fixed execution-order tail start not found')
end_marker = "程序负责名称匹配、路径转义、增量补丁、因果投影、引用修复和最终 Schema 校验。';"
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit('fixed execution-order tail end not found')
end += len(end_marker)
text = text[:start] + ';' + text[end:]
runtime.write_text(text, encoding='utf-8')

text = ui.read_text(encoding='utf-8')
fixed_section = """                html+=section('固定系统注入','<div class=\"we-notice\">最终 system 拼装顺序：可编辑分段 → 世界引擎核心约束 → 按需 NPC 构筑审计 → WorldResult 业务输出协议 → Canonical Schema。这里展示的是程序强制层，不会另生成第二套执行流程。</div><details class=\"we-segment\"><summary>世界引擎核心约束 · 固定只读</summary><textarea readonly>'+text(CORE_WORLD_RULES)+'</textarea></details><details class=\"we-segment\"><summary>角色管理 · NPC构筑审计 · 条件注入</summary><textarea readonly>'+text(NPC_BUILD_AUDIT_RULES)+'</textarea><p class=\"we-muted\">只有本轮存在 NPC 构筑审计对象时才实际加入 system；没有审计对象时不会发送。</p></details>','不可编辑 · 与实际 system 共用同一常量');
                html+=section('WorldResult 输出协议',"""
text = replace_once(text, "                html+=section('结构提示词',", fixed_section, 'fixed system injection UI')
text = replace_once(
    text,
    '协议说明使用上方编辑开关。保存后用于实际 system 请求；Schema 与核心约束仍由程序注入，修改说明不会改变变量结构。',
    '协议说明使用上方编辑开关。保存后用于实际 system 请求；Schema 固定只读，核心约束与条件审计见上方“固定系统注入”，修改说明不会改变变量结构。',
    'protocol UI note',
)
manifest_anchor = "                    const m=r.manifest||{},books=m.世界书条目||[],floors=m.正文楼层||[],obs=m.观测||requestTokenTelemetry(r.system,r.input,r.schema||WORLD_RESULT_SCHEMA);"
text = replace_once(
    text,
    manifest_anchor,
    manifest_anchor + "\n                    const readChecks=(m.读取判定||[]).filter(item=>item.读取===true);",
    'actual-read inspection filter',
)
old_inspection = "                    body+=fold('资料清单与命中判定（点击展开）',readable('条目',m.读取判定||[])+fold('实际读取世界书',fields({条目:books.map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))}))+fold('实际正文楼层',fields({楼层:floors.map(f=>'第 '+f.楼层+' 层 · '+f.角色+' · '+tokenLabel(f.估算Tokens,true))}))+fold('时间容量',fields(m.本轮时间容量||{})));"
new_inspection = "                    body+=fold('本轮实际读取资料（点击展开）',(readChecks.length?readable('条目',readChecks):empty('本轮未读取世界书','没有勾选命中或强制读取的世界书条目。'))+fold('实际读取世界书',fields({条目:books.map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))}))+fold('实际正文楼层',fields({楼层:floors.map(f=>'第 '+f.楼层+' 层 · '+f.角色+' · '+tokenLabel(f.估算Tokens,true))}))+fold('时间容量',fields(m.本轮时间容量||{})));"
text = replace_once(text, old_inspection, new_inspection, 'request inspection read-only list')
text = replace_once(text, "+raw('system · 完整原文',r.system);", "+raw('system · 实际发送原文',r.system);", 'system raw label')
text = replace_once(text, "+raw('user · 完整原文',r.input);", "+raw('user · 实际发送原文',r.input);", 'user raw label')
ui.write_text(text, encoding='utf-8')

text = audit.read_text(encoding='utf-8')
append = """

## P2 后请求透明度修复（2026-09-10）

- 删除固定尾部 `【本轮执行顺序】`；执行流程只由可编辑工作层的 `【执行流程】` 提供，避免第二套 Step 1~7 与默认 Pipeline 重复。
- `世界引擎核心约束` 继续作为不可绕过的固定业务边界；`NPC构筑审计` 继续按本轮是否存在审计对象条件注入。提示词工作台现在把两者直接以只读方式展示，不再只靠一句说明暗示存在。
- 请求检查的资料区只展示本轮真正读取的世界书；未勾选、技术隔离、未命中的候选仍可供程序内部判定和“资料读取范围”配置使用，但不再混在“实际发送”视图中。
- AI 的 `user` 输入中，世界书改为内容字符串数组；世界书名称、条目 ID、来源书名等程序元数据只保留在本地 manifest/UI，不再占用模型上下文。
- `system/user · 实际发送原文` 明确表示对应文本就是请求发送给模型的两条消息内容。
"""
if '## P2 后请求透明度修复（2026-09-10）' not in text:
    text += append
audit.write_text(text, encoding='utf-8')

text = guide.read_text(encoding='utf-8')
append = """

### 请求透明度与世界书发送边界（2026-09-10）

提示词工作台把最终 system 分成两层展示：可编辑工作分段，以及程序固定/条件注入的核心约束与 NPC 构筑审计。默认工作层已经有 `【执行流程】`，因此不再追加第二份 `【本轮执行顺序】`。WorldResult 协议说明仍可编辑，Canonical Schema 固定只读。

请求检查中的“本轮实际读取资料”只列真正进入请求的世界书；未勾选或未命中的候选不会显示在实际发送清单。世界书经过激活判定和 EJS 处理后，发送给 AI 的 `user.世界书` 只保留内容字符串，书名、条目 ID 和来源信息只用于本地目录/检查界面。`system · 实际发送原文` 与 `user · 实际发送原文` 分别对应最终提交给模型的 system/user 消息内容。
"""
if '### 请求透明度与世界书发送边界（2026-09-10）' not in text:
    text += append
guide.write_text(text, encoding='utf-8')

print('request transparency refactor applied')
