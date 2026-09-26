# 世界推进类化重构

## 1. 边界

正式人物资料由状态栏负责。世界推进只拥有：

- `世界.后台`
- `世界.因果轨道`
- `世界.势力`
- `世界.探索`
- 世界推进自己的历史、传播、运行配置与提示词配置

世界推进不得通过自己的人物编辑器修改 `关系列表` 中的正式人物档案。

## 2. 目标结构

```text
src/WorldEngine/
  core/
    WorldEngineServiceContainer
    WorldEngineFeatureRegistry
  domains/
    WorldMutationService
    WorldEventService
    WorldPersonActivityService
    WorldHistoryService
    WorldCausalService
    WorldExplorationService
    WorldRumorService
    WorldRequestService
  prompts/
    WorldPromptRegistry
  ui/
    WorldEngineViewRegistry
    WorldEditorController
    WorldPromptWorkspaceController
    WorldApiPresetController
    WorldCausalOverviewController
```

`SamsaraWorldEngine` 作为 Application Facade，只持有 `engine.services` 并负责初始化、运行、面板生命周期。Phase 3 起，横切功能通过 `WorldEngineFeatureRegistry` 的 `initialize / bindPanel / beforeRender / afterRender / afterBuildRequest / dispose` 生命周期挂载，不再为 UI/配置类功能新增一层 `extends SamsaraWorldEngine`。

## 3. Prompt Registry 规则

任何最终作为静态 AI 指令进入 `system`、`user payload`、辅助模型或纠错重试的文字都必须有注册项。注册项至少包含：

- key
- title
- group
- source
- defaultValue
- condition / scope

提示词预设保存的是完整 registry 值。旧字段 `corePrompt / macroPrompt / stabilityPromptTemplate / npcAuditPrompt / structurePrompt / modulePrompts` 在迁移期继续同步，确保旧预设可用。

程序 JSON Schema、字段白名单、校验器不是提示词，不允许通过 UI 修改。

## 4. 重构策略

采用 strangler migration：

1. 先建立 class，旧入口委托给 class。
2. 回归测试通过后，把原业务逻辑搬入 class。
3. 删除旧继承补丁。
4. 最后把 `script/world-engine-src` 中剩余 legacy source 迁到 `src/WorldEngine`。

每一步都必须保持 `script/世界推进系统.js` 的外部接口兼容。


## 请求 Feature 管线

`WorldEngineClassBridge.buildRequest()` 先调用 legacy 核心请求，再由 `WorldEngineFeatureRegistry.afterBuildRequest()` 按注册顺序装饰 payload / timeline / manifest，最后交给 `WorldPromptRegistry` 统一装配所有静态提示词。软维护、完整性、世界活动交付、到期事件复核，以及任务感知、原著时间轴、传闻请求管线都已迁入独立 class，不再通过 `extends SamsaraWorldEngine` 叠请求层。`catalogue()` 与 `run()` 也通过 Feature Registry 的 `afterCatalogue / aroundRun` seam 组合。


## Phase 5 · 状态型生命周期

自动推进、正文结束触发、replay 恢复、变量重处理即时重推、世界时间所有权、NPC 审计策略和历史压缩生命周期已迁到独立 class。`script/world-engine-src` 不再允许新增 `SamsaraWorldEngine = class ... extends ...`；运行时只保留 `src/WorldEngine/core/WorldEngineClassBridge.part.js` 这一层 Application Facade 继承用于兼容外部 API。
