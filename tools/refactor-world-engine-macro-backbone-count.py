from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
state = ROOT / 'script/world-engine-src/10-world-state.part.js'
result = ROOT / 'script/world-engine-src/20-world-result.part.js'
guide = ROOT / 'script/世界引擎接入说明.md'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, got {count}')
    return text.replace(old, new, 1)


text = state.read_text(encoding='utf-8')
text = replace_once(
    text,
    "        const macro=events.filter(([,e])=>e.分类==='宏观节点');\n        const macroFuture=macro.filter(([,e])=>e.状态==='待发生');",
    "        const macro=events.filter(([,e])=>e.分类==='宏观节点');\n        const macroFuture=macro.filter(([,e])=>e.状态==='待发生');\n        const macroOpen=macro.filter(([,e])=>['进行中','待发生'].includes(e.状态));",
    'timeline macroOpen declaration'
)
text = replace_once(
    text,
    "            需要补充远期:macroFuture.length<3,",
    "            需要补充远期:macroOpen.length<3,",
    'timeline backbone threshold'
)
state.write_text(text, encoding='utf-8')

text = result.read_text(encoding='utf-8')
text = replace_once(
    text,
    "        let match=message.match(/宏观事件不足：需要至少3个待发生宏观节点，当前仅(\\d+)个/);\n        if(match){\n            const current=Math.max(0,Number(match[1])||0),missing=Math.max(0,3-current);\n            plan.push('宏观骨架：当前仅'+current+'个待发生宏观节点，还需补充至少'+missing+'个待发生宏观节点；新增事件必须使用 分类=宏观节点、状态=待发生，并给出可执行的时间/条件/前因。');\n            plan.push('因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序，使用最终3~5个已建立宏观节点名称形成顺序。');",
    "        let match=message.match(/宏观事件不足：需要至少3个可推进宏观节点（进行中\\+待发生），当前仅(\\d+)个（进行中(\\d+)个，待发生(\\d+)个）/);\n        if(match){\n            const current=Math.max(0,Number(match[1])||0),active=Math.max(0,Number(match[2])||0),future=Math.max(0,Number(match[3])||0),missing=Math.max(0,3-current);\n            plan.push('宏观骨架：当前可推进宏观节点'+current+'个（进行中'+active+'、待发生'+future+'），还需补充至少'+missing+'个真正的待发生宏观节点；会合、撤离、赶路、局部争夺/突破等近期节点不计入宏观骨架，不要反复把它们改标为宏观节点。新增宏观事件必须给出可执行的时间/条件/前因。');\n            plan.push('因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序，使用最终3~5个仍可推进的宏观节点名称形成顺序。');",
    'retry macro diagnostics'
)
text = replace_once(
    text,
    "        const allMacro=Object.entries(next?.世界?.[PATH]?.事件||{}).filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消');\n        const futureMacro=allMacro.filter(([,e])=>e.状态==='待发生');\n        if(futureMacro.length<3)throw new Error('宏观事件不足：需要至少3个待发生宏观节点，当前仅'+futureMacro.length+'个');",
    "        const allMacro=Object.entries(next?.世界?.[PATH]?.事件||{}).filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消');\n        const activeMacro=allMacro.filter(([,e])=>e.状态==='进行中');\n        const futureMacro=allMacro.filter(([,e])=>e.状态==='待发生');\n        const openMacro=allMacro.filter(([,e])=>['进行中','待发生'].includes(e.状态));\n        if(openMacro.length<3)throw new Error('宏观事件不足：需要至少3个可推进宏观节点（进行中+待发生），当前仅'+openMacro.length+'个（进行中'+activeMacro.length+'个，待发生'+futureMacro.length+'个）');",
    'ensure macro backbone threshold'
)
result.write_text(text, encoding='utf-8')

text = guide.read_text(encoding='utf-8')
text = replace_once(
    text,
    "当请求开始时本就缺少宏观骨架，而累计 WorldResult 仍没有至少 3 个 `分类=宏观节点 && 状态=待发生` 的事件，本轮会以“宏观事件不足”进入纠错重试；下一次请求只需要补足或修正缺失的宏观业务片段。已经被旧版本标记为“本楼层已处理”的存档，如果仍检测到宏观节点不足或因果轨道不是有效宏观投影，新版本允许在同一楼层执行一次修复。",
    "当请求开始时本就缺少宏观骨架，而累计 WorldResult 经事件层级规范化后仍没有至少 3 个可推进宏观节点（`分类=宏观节点` 且状态为 `进行中/待发生`），本轮会以“宏观事件不足”进入纠错重试；正在进行的阶段级宏观事件本身计入骨架，不再额外强迫再造 3 个未来节点。明显属于会合、撤离、赶路、局部争夺/突破的事件即使模型标成宏观节点，也会先降为当前事件/近期节点后再计数。已经被旧版本标记为“本楼层已处理”的存档，如果仍检测到宏观节点不足或因果轨道不是有效宏观投影，新版本允许在同一楼层执行一次修复。",
    'guide macro retry contract'
)
guide.write_text(text, encoding='utf-8')
