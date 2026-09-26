from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def patch(rel, old, new, label):
    path = ROOT / rel
    text = path.read_text(encoding='utf-8')
    if new:
        if new in text:
            print('[history-core] already', label)
            return
    elif old not in text:
        print('[history-core] already removed', label)
        return
    if text.count(old) != 1:
        raise RuntimeError(f'{label}: expected 1 anchor, got {text.count(old)}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('[history-core] patched', label)

def patch_any(rels, old, new, label):
    paths = [(rel, ROOT / rel) for rel in rels]
    for rel, path in paths:
        if not path.is_file():
            continue
        text = path.read_text(encoding='utf-8')
        if new and new in text:
            print('[history-core] already', label, 'in', rel)
            return
        if not new and old not in text:
            print('[history-core] already removed', label, 'in', rel)
            return
    for rel, path in paths:
        if not path.is_file():
            continue
        text = path.read_text(encoding='utf-8')
        if text.count(old) != 1:
            continue
        path.write_text(text.replace(old, new, 1), encoding='utf-8')
        print('[history-core] patched', label, 'in', rel)
        return
    raise RuntimeError(f'{label}: anchor not found in candidates: {", ".join(rels)}')

state_factory = ROOT / 'src/WorldEngine/domains/WorldStateFactory.part.js'
if state_factory.is_file() and 'emptyBackend()' in state_factory.read_text(encoding='utf-8') and '运行记录' not in state_factory.read_text(encoding='utf-8'):
    print('[history-core] already empty state in classized state factory')
else:
    patch_any(
        [
            'src/WorldEngine/domains/WorldStateFactory.part.js',
            'script/world-engine-src/10-world-state.part.js',
        ],
        "return { 版本:5, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 历史总结:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{} };",
        "return { 版本:5, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 历史总结:{}, 传播:{}, 最近变化:[], 资产墓碑:{} };",
        'empty state',
    )
cleanup_candidates = [
    'src/WorldEngine/domains/WorldStateNormalizer.part.js',
    'script/world-engine-src/10-world-state.part.js',
]
if any(
    (ROOT / rel).is_file() and 'delete state.运行记录;' in (ROOT / rel).read_text(encoding='utf-8')
    for rel in cleanup_candidates
):
    print('[history-core] already legacy cleanup in classized state normalizer')
else:
    patch_any(
        cleanup_candidates,
        "        delete state.公开摘要;\n        delete state.正文承接;\n        state.版本=Math.max(5,Number(state.版本)||0);",
        "        delete state.公开摘要;\n        delete state.正文承接;\n        delete state.运行记录;\n        state.版本=Math.max(5,Number(state.版本)||0);",
        'legacy cleanup',
    )
runtime_path = ROOT / 'script/world-engine-src/40-engine-runtime.part.js'
runtime_text = runtime_path.read_text(encoding='utf-8')
runtime_old = "                        next.世界[PATH].最近变化=changes.slice(-100);\n                        const sourceOld=Object.assign(emptyState(),sourceStat.世界[PATH]||{});\n                        next.世界[PATH].运行记录=sourceOld.运行记录.concat([{时间:base.stat.世界.时间,摘要:reply.summary,补丁数:committedPatches.length,尝试次数:attempt+1}]).slice(-20);\n                        // 可选提交装饰钩子：用于把本轮派生元数据与主世界结果原子落库，避免额外 MVU 写回。"
runtime_new = "                        next.世界[PATH].最近变化=changes.slice(-100);\n                        // 推演记录已由历史锚点取代，不再持久化。\n                        // 可选提交装饰钩子：用于把本轮派生元数据与主世界结果原子落库，避免额外 MVU 写回。"
if runtime_new in runtime_text:
    print('[history-core] already runtime persistence')
elif runtime_old in runtime_text:
    patch('script/world-engine-src/40-engine-runtime.part.js', runtime_old, runtime_new, 'runtime persistence')
elif '运行记录=' not in runtime_text and (ROOT / 'src/WorldEngine/domains/WorldCommitService.part.js').is_file():
    print('[history-core] already runtime persistence in classized commit service')
else:
    raise RuntimeError('runtime persistence: legacy anchor missing without classized replacement')
patch_any(
    [
        'src/WorldEngine/domains/WorldAutoProgressController.part.js',
        'script/world-engine-src/59-auto-progress.part.js',
    ],
    "return ['最近变化','运行记录'].some(key=>Array.isArray(backend[key])&&backend[key].length>0);",
    "return Array.isArray(backend.最近变化)&&backend.最近变化.length>0;",
    'auto progress signal',
)
patch(
    'script/ZOD脚本.js',
    "            运行记录: z.array(z.any()).prefault([]),\n",
    "",
    'ZOD run record',
)
print('[history-core] done')
