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
    WorldStateProjector
    WorldResultCompiler
    WorldValidationService
    WorldCommitService
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

## Phase 6 · 核心状态与编译 seam

`WorldStateProjector` 已成为 runtime 构造“当前变量”热上下文时的 class seam；`WorldResultCompiler` 已成为 runtime 的 WorldResult 分片验收、正式编译、legacy patch 清洗和 materialize seam。旧的纯函数暂时作为底层兼容实现保留，后续可以逐块迁入 class，而 runtime 不再直接绑定这些全局函数。

这一步的目的不是为了“套一层类”，而是先固定调用边界：以后移动 `projectWorldContext / stageWorldResult / compileWorldResult / materializeWorldUpdate` 的内部实现时，不需要再次改动主运行循环。

## Phase 7 · 统一结果验收 seam

`WorldValidationService` 已接管 runtime 中编译完成后的统一业务验收入口：到期事件、事件时间锚点、超期活动事件、时间越界、活跃异端、NPC 审计与宏观骨架不再由主运行循环逐条调用。主 runtime 只负责调用 `validation.validate(...)` 并处理错误结果。

当运行期间 MVU 发生并发变化、需要对最新状态重新 materialize 时，仍复用同一个 service，但通过 `includeNpcAudit:false` 保持旧行为，避免重构顺手改变二次校验语义。

## Phase 8 · 提交事务 seam

`WorldCommitService` 已接管主推进结果验收后的提交准备和最终 MVU 写入：稳定值重算、已处理楼层/时间、最近变化、`beforeWorldCommit` 派生元数据、Schema 二次确认、replay 包以及单次 `replaceMvuData` 都通过一个 service seam 完成。

因此主 runtime 的核心职责已经收缩为：**构造请求 → 获取回复 → 编译 → 统一验收 → 提交**。领域细节由 service 负责，Application Facade 只编排。


## Phase 9 · 业务页面类化

玩家可见业务页不再由 `50-engine-ui.part.js` 直接拼接。每个页签对应一个独立 View class：

- `WorldOverviewView`
- `WorldPeopleView`
- `WorldExplorationView`
- `WorldAssetView`
- `WorldEventArchiveView`
- `WorldRumorView`
- `WorldHistoryView`
- `WorldSettingsView`
- `WorldPromptView`
- `WorldRequestInspectorView`

`WorldEngineViewRegistry` 只负责 class 注册与路由。Application Shell 只准备共享 view context，不再实现资产/传闻等业务 HTML。2026-09-27 已完成 legacy renderer 内部实现迁移：世界概览、人物、探索、事件归档、历史、设置、提示词与请求检查均由对应 View class 直接实现；旧 `script/world-engine-src/ui/10~70-*.part.js` 已删除。新的业务页面只能进入 `src/WorldEngine/ui/views/`，不得重新建立函数式 renderer 影子层。

## Phase 10 · Runtime 上下文 / 资料 / 基础请求

`40-engine-runtime.part.js` 不再直接实现当前楼层读取、阻塞判定、世界书目录扫描或基础请求 JSON/system 拼装。

- `WorldRuntimeContextService`：负责 snapshot 与基础 blocked 语义。
- `WorldKnowledgeService`：负责世界书来源发现、蓝绿灯/技术条目隔离、EJS 展开与读取报告。
- `WorldRequestBuilder`：负责把当前世界、正文楼层、世界书、时间容量与调度数据组装成基础 WorldResult 请求。

`WorldEngineClassBridge` 仍在基础请求之后执行 Feature Registry 与 Prompt Registry，因此本阶段只移动职责，不改变最终请求管线。


## Phase 11 · 传输 / 提示词文档 / 主推进编排

专属 API 传输已经迁入 `WorldApiTransportService`；提示词文档持久化迁入 `WorldPromptDocumentService`；原先位于 `40-engine-runtime.part.js` 的主 `run()` 重试、编译、验收、提交循环迁入 `WorldRunOrchestrator`。Runtime 只保留兼容 facade，Application Facade 继续通过 Feature Registry 包裹一次完整运行。

因此 runtime 核心进一步收缩为配置/面板生命周期和少量兼容入口。新的网络传输、预设文档行为或推进步骤不得再直接塞回 `40-engine-runtime.part.js`。

### WorldResult 分片验收

`WorldResultStagingService` 负责结果分片、逐片编译/物化验收、Schema 差异定位与纠错反馈；`WorldResultCompiler` 只组合 Normalizer / Materializer / Staging 三个领域服务，并保留仍被 legacy decorator 使用的全局兼容 seam。

### WorldResult 回复解析

`WorldResultReplyParser` 负责模型回复的 JSON 提取、兼容包装识别与 WorldResult 归一化；`WorldRunOrchestrator` 通过 service container 使用它，`parseReply` 仅保留为兼容 seam。

### WorldValidation Policy

`WorldValidationPolicy` 持有到期事件、排期完整性、超期活动、时间越界、宏观骨架与推进锚点的基础领域规则；`WorldValidationService` 负责一次完整结果验收的应用编排。迁移期被 legacy feature 动态包装的校验仍通过可重写全局 seam 调用，这些 seam 的底层实现统一指向 container-owned `ACTIVE_WORLD_VALIDATION_POLICY`，避免类化绕过已有运行期扩展。

### 探索粒度领域归属

`WorldExplorationService` 除探索/势力快照外，同时拥有探索记录粒度判定与旧子区域合并修复。构建阶段提供默认 service-backed 兼容 seam，运行期由 Service Container 切换到 container-owned 实例；WorldResult Kernel 不再实现探索领域逻辑。
