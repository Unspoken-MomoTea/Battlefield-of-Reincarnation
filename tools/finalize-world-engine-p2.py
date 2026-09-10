from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label} anchor missing')
    return text.replace(old, new, 1)


audit = Path('docs/世界引擎V2审计.md')
text = audit.read_text(encoding='utf-8')
text = replace_once(
    text,
    '| 单文件承载推演+Prompt+UI | `世界推进系统.js` 体积大 | 维护边界差，但直接拆分风险高 | 后续拆分 | P2 | P0/P1 不改变加载方式 |',
    '| 单文件承载推演+Prompt+UI | 运行时仍为单文件，开发源码已拆为 7 个连续职责片段 | 兼顾维护边界与酒馆兼容性 | 源码片段 + 固定顺序构建单文件（已完成） | P2（已完成） | 构建结果与交付文件逐字节一致 |',
    'audit matrix P2 row',
)
marker = '## 后续顺序\n\nP1-A 世界现场数据语义（已完成） → P1-B 角色关系 UI 与视觉系统（已完成） → P1-C Prompt 可观测性（已完成） → P2 单文件拆分。'
p2 = '''## P2：开发源码模块化、单文件交付（已完成）

- 运行时和酒馆安装方式不变：仍只加载 `script/世界推进系统.js`，不引入浏览器 `import/export`，不要求多脚本加载。
- 开发源改为 `script/world-engine-src/` 下 7 个连续职责片段：foundation/prompt、world-state、WorldResult、context/protocol、engine-runtime、engine-ui、bootstrap。
- `tools/build-world-engine.py` 是唯一构建入口，只按固定顺序拼接，不压缩、不改写、不注入业务文本。以后修改世界引擎业务源码后运行 `python tools/build-world-engine.py` 同步交付文件。
- `python tools/build-world-engine.py --check` 与 `node tests/world-engine-modules.cjs` 固定验证“7 个源码片段拼接 = 单文件交付”、职责锚点、IIFE 边界以及无运行时 ES Module。
- P2 首次拆分生成的 `script/世界推进系统.js` 与 P1-C 的 main 版本逐字节一致，因此本阶段没有改变 Prompt、Schema、MVU、生命周期、API、UI 或推演行为。
- P0/P1 永久测试全部通过；旧 `lifecycle / prose / world-engine` 测试保持与 main 完全相同的基线结果。
- P2 施工用 audit/split workflow 与一次性拆分脚本在验收后删除，仓库只保留开发源码片段、永久构建器、永久模块测试和设计文档。

## 后续顺序

P0（已完成） → P1-A（已完成） → P1-B（已完成） → P1-C（已完成） → P2（已完成）。世界引擎 V2 本轮架构改造收束；后续新增功能直接在对应源码片段开发，不再回到单文件直接堆叠。'''
text = replace_once(text, marker, p2, 'audit P2 sequence')
audit.write_text(text, encoding='utf-8')

guide = Path('script/世界引擎接入说明.md')
text = guide.read_text(encoding='utf-8')
old_intro = '把 `世界推进系统.js` 作为独立酒馆脚本加载，并更新 `悬浮球状态栏.js`、`ZOD脚本.js`、`辅助计算脚本.js`、结算任务美化，以及世界书的 `[variables]当前变量`、`[mvu_update]变量更新规则` 两个条目。没有构建产物自动发布步骤；本目录源码不会自动同步到已导入酒馆的角色卡。'
new_intro = '把 `世界推进系统.js` 作为独立酒馆脚本加载，并更新 `悬浮球状态栏.js`、`ZOD脚本.js`、`辅助计算脚本.js`、结算任务美化，以及世界书的 `[variables]当前变量`、`[mvu_update]变量更新规则` 两个条目。酒馆仍只加载这一份单文件；仓库中的开发源码位于 `script/world-engine-src/`，修改后运行 `python tools/build-world-engine.py` 生成 `世界推进系统.js`。构建不会自动同步到已导入酒馆的角色卡。'
text = replace_once(text, old_intro, new_intro, 'integration guide intro')
insertion = '''

## 开发源码与单文件交付（P2）

世界引擎采用“开发源码分片、运行时单文件”的方式。业务修改应落在 `script/world-engine-src/*.part.js`，不要把 `script/世界推进系统.js` 当作独立第二份源码维护。修改完成后执行 `python tools/build-world-engine.py`；提交前执行 `python tools/build-world-engine.py --check` 与 `node tests/world-engine-modules.cjs`。构建器只做固定顺序拼接，不引入 npm、浏览器模块或额外运行时依赖，因此现有酒馆安装/加载方式不变。
'''
anchor = '\n\n## 2026-09-08 世界引擎界面重构'
text = replace_once(text, anchor, insertion + anchor, 'integration guide section')
guide.write_text(text, encoding='utf-8')

design = Path('docs/世界引擎V2-P2模块化设计.md')
text = design.read_text(encoding='utf-8')
text = replace_once(text, '## P2 首次拆分验收\n', '## P2 首次拆分验收（已完成）\n', 'P2 design acceptance heading')
if 'P2 完成状态：' not in text:
    text += '\nP2 完成状态：7 个源码片段已纳入版本控制；永久构建/契约测试通过；最终单文件与 P1-C main 版本逐字节一致；酒馆加载方式未改变。\n'
design.write_text(text, encoding='utf-8')
