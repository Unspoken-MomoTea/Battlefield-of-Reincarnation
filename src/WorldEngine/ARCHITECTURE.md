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
  domains/
    WorldMutationService
    WorldEventService
    WorldPersonActivityService
    HistoryMemoryService        (后续)
    ExplorationService          (后续)
    RumorService                (后续)
  prompts/
    WorldPromptRegistry
  ui/
    ...                         (后续把现有 ui/*.part.js 类化)
```

`SamsaraWorldEngine` 作为 Application Facade，只持有 `engine.services` 并负责初始化、运行、面板生命周期。

## 3. Prompt Registry 规则

任何最终进入 AI `system` 的文字都必须有注册项。注册项至少包含：

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
