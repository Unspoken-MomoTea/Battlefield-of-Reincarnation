# WorldEngine

`src/WorldEngine/` 是世界推进的唯一开发源码目录。运行时仍由 `tools/build-world-engine.py` 按固定顺序拼接 `.part.js`，生成酒馆单文件 `script/世界推进系统.js`；生成文件只作为交付物，不作为第二份手工源码维护。

## 当前边界

- 世界推进拥有 `世界.后台`、`世界.因果轨道`、`世界.势力`、`世界.探索`、世界历史/传播、运行配置与提示词配置。
- 正式人物档案仍由状态栏负责；世界推进的人物编辑只修改 `世界.后台.人物` 的场外活动记录，不直接维护 `关系列表` 正式档案。
- 顶层 `资产` 是共享资产账簿；世界推进只按已确认的场外事实维护资产变化，不建立第二套资产数据库。
- `WorldResult` 的 Schema、写入白名单、时间/引用/状态完整性校验属于程序契约，不开放为可编辑 Prompt。
- 手动点击“推进世界”会先接受一次性人工指导；若当前楼层已有本引擎保存的推进前基线，则从该基线重新推演同一轮并以新结果替换旧结果。自动推进不读取这份一次性指导。

## 源码结构

- `core/`：Application Facade、Service Container、生命周期、配置、Feature Registry、宿主适配与 bootstrap。
- `domains/`：世界状态投影、WorldResult 编译/物化/校验、时间线、因果、事件、人物活动、探索、传闻、资产、历史、请求与重试等领域能力。
- `prompts/`：默认提示词、`WorldPromptRegistry` 与 Prompt 集成。
- `ui/`：Panel Controller/Renderer、业务 View、编辑器、提示词工作台、主题与 API 预设控制。

详细职责边界见 [`ARCHITECTURE.md`](./ARCHITECTURE.md)。原著剧情与时间约束见 [`CHRONOLOGY.md`](./CHRONOLOGY.md)。静态提示词规则见 [`PROMPT-REGISTRY.md`](./PROMPT-REGISTRY.md)。发布候选验收见 [`RC-CHECKLIST.md`](./RC-CHECKLIST.md)。

## 开发硬规则

- 只在 `src/WorldEngine/` 修改世界推进业务源码；禁止恢复 `script/world-engine-src/`。
- `WorldEngineClassBridge` 是唯一允许的 `extends SamsaraWorldEngine` 兼容层；新能力进入 service / policy / controller / feature / view。
- 禁止重新通过覆盖 `compileWorldResult / retryPlanForFailure / projectWorldContext / applyPatches / validateState / materializeWorldUpdate` 追加业务行为。
- 纯常量放 vocabulary/catalog/constants，纯工具放 utilities；不要为了文件尺寸机械拆 class。
- 所有实际发送给 AI 的静态指令必须登记 `WorldPromptRegistry`，并能在提示词工作台查看和编辑；Schema、白名单、校验算法仍由程序维护。
- 新改动应保持现有公开 seam、存档兼容与单文件交付契约；先用回归锁住行为，再调整内部职责。

## 构建与验收

修改世界引擎源码后至少执行：

```bash
python tools/build-world-engine.py
python tools/build-world-engine.py --check
node tests/world-engine-modules.cjs
node tests/run-world-engine-suite.cjs
```

`tests/world-engine-class-architecture.cjs` 负责锁定类化边界、唯一继承层、legacy source tree 不回流和核心 seam 不被重新 monkey patch。Prompt 源码审计继续保证静态 AI 指令不会重新藏回业务文件。

## 运行与热更新

世界推进运行时公开 `WORLD_ENGINE_VERSION` 与 `Samsara.WorldEngineInfo`。测试维护通道跟踪 `main` 中的生成交付；正式世界推进使用独立、不可覆盖的 `world-engine-vX.Y.Z` Git Tag。

创意工坊“修复”页负责把旧式内联世界推进脚本迁移为受维护的版本 loader。世界推进发布与创意工坊版本相互独立：发布世界推进只校验世界引擎源码/交付、运行回归并创建世界推进正式 Tag，不修改创意工坊正式发布指针。

## 文档维护

这里的文档只描述**当前事实和长期约束**。已经完成的 Phase、一次性迁移步骤和历史实施矩阵不再作为长期文档保留；真正难以逆转且需要解释取舍的决定应进入 `docs/adr/`。
