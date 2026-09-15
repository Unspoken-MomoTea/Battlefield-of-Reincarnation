from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'script/world-engine-src/10-world-state.part.js'
text = path.read_text(encoding='utf-8')
old = "return { 版本:5, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 历史总结:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{} };"
new = "return { 版本:5, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 历史总结:{}, 传播:{}, 最近变化:[], 资产墓碑:{} };"
if old in text:
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
elif new not in text:
    raise RuntimeError('history empty-state anchor missing')
print('[history-core] done')
