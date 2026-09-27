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
    WorldEngineLifecycleController
    WorldEngineFeatureRegistry
  domains/
    WorldStateModel
    WorldStateProjector
    WorldResultCompiler
    WorldValidationService
    WorldCommitService
    WorldMutationService
    WorldEventService
    WorldPersonActivityService
    WorldTaskAwarenessService
    WorldChronologyPolicy
    WorldTimePolicy
    WorldNpcAuditService
    WorldSoftMaintenancePolicy
    WorldHistoryService
    WorldCausalService
    WorldExplorationService
    WorldRumorService
    WorldRequestService
    WorldRetryGuidanceService
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


## Phase 12 · 探索领域策略类化

探索域不再把真实规则散在 WorldResult kernel、Materializer 与 `59-soft-maintenance` 三处。`WorldExplorationService` 现在统一拥有整体地标粒度判定、探索度不可无因回退、当前地点最低 10% 自动投影，以及旧版“主区域-子区域”记录合并。公共兼容 seam `repairExplorationGranularity` 继续存在，但底层委托 active exploration service；`WorldResultMaterializer` 组合同一 service 实例。

因此 `59-soft-maintenance.part.js` 不再重写 `compileWorldResult`。探索属于结果编译的正式领域步骤，而不是后置 monkey patch。


## Phase 13 · 时间线策略类化

`WorldTimelinePolicy` 接管原本位于 `10-world-state.part.js` 的事件时间线纯领域规则：故事线阶段解析、事件时间锚点/显示标签、陈旧进行中事件检测、未来时间异常、写入时间校验以及事件排序。外部兼容函数名保持不变，底层统一委托 container-owned active policy。

`WorldValidationPolicy` 组合 `WorldTimelinePolicy`，只负责验收编排；Materializer、UI 和软维护仍通过原公共 seam 使用时间线规则。这样时间线规则不再同时散落在状态大文件和验收层。


## Phase 14 · 事件生命周期类化

`WorldLifecycleService` 首先接管结束事件的引用收集、软引用解绑、历史归档、冷事件回收与传播过期判定；Phase 15 继续把人物临时活动、死亡异端后台清理和顶层 `compactWorldLifecycle` 编排收进同一个 service。兼容函数仅负责转发到 container-owned active service。


### Lifecycle ownership

`WorldLifecycleService` 现在同时负责事件归档、传播过期、人物临时活动回收、死亡异端的后台人物清理，以及整轮 `compactWorldLifecycle` 编排。世界推进只清理 `世界.后台.人物` 的活动记录，不删除 `关系列表` 正式人物档案；正式档案继续由状态栏/辅助生命周期负责。

`世界.探索` 是长期玩家台账，不属于 lifecycle 回收对象。旧 `pruneColdExploration` 路径已经移除，`compactWorldLifecycle` 为兼容仍返回 `回收探索` 字段，但固定为空。


### State normalization ownership

`WorldStateNormalizer` owns persisted backend migration and event structural repair: legacy summary migration, backend record normalization, dead-alien activity cleanup, event layer correction, explicit person↔event linking, and macro predecessor completion. `WorldResultMaterializer` composes the container-owned normalizer directly; compatibility functions remain only for UI/runtime callers that have not yet moved to injected services.

Causal projection is intentionally not part of this class. `repairCausalProjection` remains a separate seam until it is migrated into the causal domain.


### Timeline snapshot ownership

`WorldTimelinePolicy` now owns `timelineState()` in addition to story-stage parsing, event time labels, temporal anomaly checks and event ordering. Recovery orchestration calls the container-owned policy directly; the compatibility `timelineState` function only exists for remaining legacy callers.


## Phase 19 · 人物活动领域

\`WorldPersonActivityService\` 是世界后台人物活动的 canonical domain service。除编辑 CRUD 外，它现在还拥有热人物筛选、人物所在场景上下文、异端活动复核条件、缺失异端活动补种和复核验收。调用方可以继续使用 \`derivePersonWorldContext / projectHotWorldPeople / activeAlienActivityRequirements / ensureActiveAlienActivity\` 兼容函数，但这些函数只转发到 container-owned service，不再保存业务实现。


## Phase 20 · Patch policy

`WorldPatchPolicy` 是世界推进写入契约的 canonical policy：它负责路径解析与 canonicalize、upsert/白名单、后台记录规范化与结构校验、模型 patch 清洗和兼容展开。`WorldResultMaterializer` 与 `WorldResultCompiler` 直接组合该实例；遗留全局 helper 仅用于迁移期兼容。


## Phase 21 · 请求纠错协议

`WorldRequestService` 是主推进纠错协议的 canonical service：它负责判断模型/业务失败是否可重试，并构造携带失败原因、已接受结果与补充清单的纠错输入。纠错要求文本不在 service 内另建隐藏副本，而是读取 `WorldPromptRegistry` 的 `retryAcceptedWithPlan / retryAccepted / retryFresh`。

`WorldRunOrchestrator` 只负责 attempt 生命周期和调用该 service；旧全局函数仅用于尚未迁移调用方的兼容转发。


## Phase 22 · State factory

`WorldStateFactory` owns creation of a fresh `世界.后台` record. The exported `emptyState()` remains a compatibility seam and returns a fresh factory product on every call. Legacy story seeding is still consumed by `WorldRequestBuilder` for old saves, so its implementation lives in `WorldTimelinePolicy.importStory()`; the global `importStory()` name remains only as a compatibility seam.


## Phase 23 · World context projection

`WorldStateProjector` owns the canonical world-context projection: character capability stripping, equipped/carried/form views, shared assets, propagation tails, causal-orbit projection, read-only task projection, hierarchical history-memory projection, and the final base world payload. The public compatibility functions, including `projectWorldContext()`, now live in the same src module and forward to the active projector. No legacy context-protocol module remains.

`WorldStateProjector.world()` is identical to the canonical `baseWorld()` path.


## Phase 24 · Worldbook activation

Worldbook activation is owned by `WorldKnowledgeService`: constant/selective entry handling, primary/secondary keyword matching, force-selected reads, disabled entries, and empty-content rejection are evaluated in the same service that discovers and reads worldbooks. The context-protocol legacy file no longer owns this policy.


## Phase 25 · NPC audit domain

`WorldNpcAuditService` owns NPC audit projection, narrative-weight classification, hot-audit selection, gap calculation and progress validation. Audit level is private world-engine state and remains independent from character power tier. The feature-toggle/worldbook/UI concerns stay in `WorldNpcAuditPolicy`; materialization and validation compose the canonical audit service directly.


## Phase 26 · Contract and time seams

`WorldResultContract` owns both the editable WorldResult output instruction and the immutable Canonical Schema assembly. `WorldPromptRegistry.outputProtocol` reads the contract instruction directly, while the public `protocol()` name is only a compatibility forwarder.

`WorldTimelinePolicy` owns world-time anchor equivalence through `sameTimeAnchor()`. The legacy `sameWorldTimeAnchor()` function forwards to the active policy so lifecycle/person/rumor callers retain behavior during migration.


## Phase 27 · Person compile preprocessing

Alien activity timestamp normalization is no longer a global `compileWorldResult` decorator. The canonical `WorldResultMaterializer` composes the container-owned `WorldPersonActivityService` and normalizes alien activity immediately inside `compileWorldResult()`. Because the public global compile seam, `WorldResultCompiler`, and `WorldResultStagingService` all eventually compile through the same materializer boundary, direct compatibility calls and class-based flows preserve identical timestamp behavior without duplicate preprocessing.


## Phase 28 · Task awareness domain

`WorldTaskAwarenessService` owns the read-only formal task ledger projection and validation of event `关联任务` references. `WorldStateProjector` and `WorldResultMaterializer` compose the same container-owned `taskLedger`; the request-facing `WorldTaskAwarenessFeature` shares that service but remains responsible only for worldbook-selection migration and request manifest decoration. The legacy 57 module no longer wraps `projectWorldContext` or `compileWorldResult`.


## Phase 29 · Chronology policy

`WorldChronologyPolicy` owns the request-scoped chronology evidence guard, exact-day evidence lookup, causal-shift exceptions, compile-time macro-date validation and chronology-specific retry guidance. `WorldChronologyFeature` only gathers worldbook evidence and writes it into the shared policy; `WorldResultMaterializer` and `WorldResultStagingService` consume the same policy. The legacy chronology module retains prompt/preset migration text only and no longer decorates compile or retry globals.


## Phase 30 · Causal compile domain

`WorldCausalService` owns world-scale causal filtering, soft impact normalization, same-root coalescing, per-actor impact budgets and stale local-offset cleanup. `WorldResultMaterializer` invokes those methods at the canonical compile boundary, so direct `compileWorldResult`, Compiler and Staging share identical behavior.

Controlled removal of stale causal offsets is now part of `WorldPatchPolicy` rather than an `applyPatches` monkey patch. The causal-stability legacy module has been deleted; the integrity legacy module retains only temporal-integrity compatibility behavior.


## Phase 31 · NPC equipment compile preprocessing

`WorldNpcAuditService.normalizeNewEquipment()` owns the rule that newly introduced equipment for an existing audited NPC defaults to equipped state `1`, while existing equipment keeps its submitted/current state. `WorldResultMaterializer` applies this at the canonical compile boundary. The legacy narrative-audit module now contains prompt compatibility text only and no longer decorates `compileWorldResult`.


## Phase 32 · World time result policy

`WorldTimePolicy` owns the result-side world-clock rules: initialization inference from complete current activities, exact-date calendar compatibility, no-backwards enforcement, the candidate-time validation snapshot, and the final `/世界/时间` patch. `WorldPersonActivityService`, `WorldResultMaterializer` and `WorldTimeOwnershipFeature` compose the same container-owned policy.

World time is now part of the canonical `WorldResultContract` and `WorldResultNormalizer`; `WorldResultStagingService` splits and merges it directly through canonical classes. `WorldPatchPolicy` already owns the `/世界/时间` write permission, and replay scope declares world time at its source. The legacy 59 time module contains only the editable `WORLD_TIME_RULES` prompt text and no longer rewrites normalizer, merge, fragments, patch permission or compile functions.

With this phase, `WorldResultCompiler.compile()` and staged fragment compilation call `WorldResultMaterializer` directly. The exported global `compileWorldResult()` remains only as an external compatibility seam; there are no remaining `compileWorldResult=function...` decorators in runtime source.


## Phase 33 · Retry guidance pipeline

`WorldRetryGuidanceService` is the canonical business-failure-to-retry-plan mapper. It owns the matching and ordering previously layered by `WorldResultStagingService` plus four runtime monkey patches: event predecessor / Schema guidance, rumor guidance, temporal-integrity guidance, and world-activity guidance.

All 20 static retry templates are registered in `WorldPromptRegistry` under the `纠错重试` group. The service reads the active registry value at execution time and formats placeholders such as `{name}`, `{details}`, and macro-node counts, so edits in “提示词预设 → 全部实际提示词” affect the next retry instead of only changing display text.

`WorldResultStagingService.retryPlanForFailure()` delegates directly to the container-owned guidance service, and `makeRetryFailure()` owns the concrete-reason/retry-feedback normalization that previously lived in `55-policy-compat.part.js`. The policy/rumor/integrity/world-activity legacy modules no longer assign `retryPlanForFailure=function...` or `makeRetryFailure=function...`; chronology compatibility guidance also sources the shared retry-template defaults instead of carrying a hidden duplicate string.


## Phase 34 · History context projection

`WorldHistoryService.project()` is injected into `WorldStateProjector`. The projector emits `世界.后台.历史记忆` directly and no longer emits a raw history tail that must be deleted by a later wrapper. The legacy history-memory module no longer assigns `projectWorldContext`; the public compatibility function is a simple early forwarder to the active projector.


## Phase 35 · History memory algorithms

`WorldHistoryMemoryPolicy` is the canonical owner of the hierarchical history forest: L0 leaf identity/order, collected-child tracking, ancestor invalidation, root selection, compression batching, summary IDs, summary reply parsing, compression payload construction, projection, and change digests.

`WorldHistoryService` and `WorldHistoryLifecycle` share the container-owned policy. `WorldStateProjector` depends on the history service and no longer calls the global history helper. The former `script/world-engine-src/59-history-memory.part.js` has been deleted; compatibility helper names now forward from the src policy only.


## Phase 36 · Canonical time parsing

`WorldTimePolicy` is the sole owner of comparable world-time parsing: calendar dates, canonical and alias dayparts, traditional branch hours, and exact HH:mm[:ss] clocks. The public `worldDateKey()` function is compatibility-only and forwards to `ACTIVE_WORLD_TIME_POLICY`.

`WorldTimelinePolicy` composes the same container-owned time policy and owns the final integrity precision rules: non-person current facts are rejected only when they cross a natural-day boundary, while person activity uses minute-level ordering only when both timestamps provide exact clocks. The legacy integrity module retains prompt text only; the separate daypart wrapper module has been deleted.


## Phase 37 · Due-event policy

`WorldDueEventPolicy` is the canonical owner of due-event review timing and soft-reminder semantics. It composes `WorldTimePolicy`, produces the request review list, and explicitly defines due-event validation as non-blocking. `WorldDueEventFeature` and `WorldValidationPolicy` share the same container-owned policy instance.

The legacy `59-due-event-relaxation.part.js` module has been deleted; no runtime assignment to `ensureDueHandled` remains.


## Phase 38 · Event predecessor validation

Event predecessor validation is now part of the canonical `WorldResultMaterializer.validateBaseState()` contract. Self references are rejected explicitly, missing predecessor names are reported with actionable details, and graph cycles remain validated in the same materializer state-validation pass.

The legacy `55-policy-compat.part.js` module has been deleted. No runtime reassignment of `validateState` is used for predecessor validation.


## Phase 39 · World activity policy

`WorldActivityPolicy` owns the canonical non-alien world-activity contract: semantic baselines, scene/faction/event bootstrap counts, meaningful-change detection and final delivery validation. `WorldActivityRequestFeature` and `WorldValidationPolicy` share the same container-owned policy instance.

The macro-backbone requirement remains independently configurable, but world-activity delivery is always validated after the optional macro check. The legacy `59-world-activity-delivery.part.js` module has been deleted. Its system prompt default moved with the policy into `src/WorldEngine` and remains editable through `WorldPromptRegistry`.


## Phase 40 · Soft maintenance policy

`WorldSoftMaintenancePolicy` owns the non-blocking event-schedule maintenance contract. It treats a concrete time, meaningful condition, or explicit predecessor as a usable schedule anchor and returns unresolved maintenance items without turning them into whole-run hard failures.

`WorldValidationPolicy` composes the container-owned soft-maintenance policy. The former `59-soft-maintenance.part.js` module has been deleted; its maintenance prompt default moved with the policy, while the exploration prompt default moved into `WorldExplorationService`. Both remain registry-backed editable prompts.


## Phase 41 · Rumor domain defaults

`WorldRumorService` now owns both rumor maintenance behavior and the legacy/default prompt material required by the editable prompt registry. It also owns the built-in preset migration through `upgradePreset()`. `WorldRumorRequestFeature` remains a request/UI feature and delegates preset migration to the same container-owned rumor service.

The former rumor legacy modules (`56-rumor-liveliness`, `59-rumor-throttle`, `59-rumor-world-source`, `59-rumor-world-request`, `59-rumor-world-system`) are deleted. No rumor business or prompt-default implementation remains in `script/world-engine-src`.


## Phase 42 · Prompt defaults and legacy shell cleanup

Static model-facing defaults are now centralized under `src/WorldEngine/prompts/WorldPromptDefaults.part.js`. It owns the compact built-in preset, module-prompt definitions, and the legacy/default text for task awareness, chronology, NPC audit, integrity and world-time prompts. `WorldPromptRegistry` remains the runtime/editing registry; this file is only the canonical source of defaults and preset migrations.

Replay version/scope constants now live with `WorldReplayService`. Eleven legacy prompt/stateful placeholder files were deleted instead of retained as empty compatibility parts. Build declarations, CI path tracking and regression tests reference the src owners directly. No new model prompt default or stateful feature may be added back under `script/world-engine-src`.


## Phase 43 · Editor and causal UI ownership

Manual causal-offset persistence now belongs to `WorldCausalService`; history edit parsing/replay synchronization belongs to `WorldHistoryService`; inline edit rendering belongs to `WorldEditorController`; causal summary/archive rendering belongs to `WorldCausalOverviewController`.

The former `59-causal-overview-ui`, `59-causal-offset-editor`, and `59-history-memory-editor` files are deleted. Compatibility function names required by the delivery/test surface are defined only in the relevant src controller, not under the legacy source tree.


## Phase 44 · Legacy editor directory removed

Manual world-engine editing no longer depends on the legacy `editor/` directory. Shared mutation parsing/replay behavior belongs to `WorldMutationService`; event reference/graph rules belong to `WorldEventService`; person-activity validation belongs to `WorldPersonActivityService`; form/presentation helpers belong to `WorldEditorController`.

The former `editor/00-world-mutations`, `editor/10-event-editor`, and `editor/20-person-editor` modules are deleted from both the source tree and build pipeline.


## Phase 45 · Numbered compatibility slots removed

The obsolete `20-world-result.part.js` and `30-context-protocol.part.js` files are deleted. WorldResult compatibility surfaces are owned by the src WorldResult domain modules. Projection compatibility surfaces are owned by `WorldStateProjector.part.js`. The legacy NPC audit prompt migration constant lives in `WorldPromptDefaults.part.js`; no prompt or projection implementation remains under the removed numbered slots.


## Phase 46 · State model primitives

The obsolete numbered state slot is gone. `WorldStateModel.part.js` is the canonical foundation for shared world record shapes and entity identity semantics. `WorldRecordCatalog` owns record/detail/model-view definitions and NPC audit levels; `WorldEntityIdentityPolicy` owns normalized entity keys, stable bucket lookup and location-related matching. Legacy constant/function names are compatibility forwards defined in the src module, not a separate runtime implementation.


## Phase 47 · Application/UI shell migrated to src

The two physical halves of the base engine class are no longer stored as numbered legacy fragments. Former `40-engine-runtime.part.js` opened `class SamsaraWorldEngine`, and former `50-engine-ui.part.js` continued the same class body and closed it; they are now merged, without behavior changes, into `src/WorldEngine/core/SamsaraWorldEngine.part.js`.

The src shell owns only application/facade state, compatibility methods, panel lifecycle, navigation and interaction dispatch. Runtime context, transport, request construction, run orchestration, prompt documents, editor mutations and business-tab rendering remain delegated to their existing services/controllers/views. New domain logic must not be added to the shell. Both legacy 40/50 files are deleted and architecture tests prevent them from returning.


## Phase 48 · Configuration initialization

`WorldEngineConfigService` is the canonical owner of application configuration defaults, localStorage hydration, legacy prompt-document migration, built-in default version application, retry/font/history normalization, dedicated-API normalization, and configuration persistence during construction.

The base `SamsaraWorldEngine` shell creates exactly one configuration service before the service container, delegates constructor migration through `initialize()`, and exposes the same instance as `engine.services.configuration`. Configuration migration markers must not be reintroduced into the application shell.


## Phase 49 · Panel interaction controller

`WorldPanelController` owns creation of the world-engine Shadow DOM mount and all base panel click/input/change routing. `SamsaraWorldEngine.createPanel()` is now a facade seam that delegates to the container-owned controller. The ClassBridge continues to attach editor, feature, and prompt-workspace behavior after base panel creation.

The panel mount contract is explicit again: `#sam-world-engine-host` owns an open ShadowRoot containing the base style element and `#sam-world-engine`. Application-shell source must not own DOM action routing.


## Phase 50 · Panel renderer

`WorldPanelRenderer` owns shared render orchestration around the already-independent business View classes: snapshot/state preparation, navigation, common formatting helpers, calendar/person/event context assembly, View Registry dispatch, run-button state, and jump finalization.

The public `SamsaraWorldEngine.render(force)` method is now a facade seam. The ClassBridge still wraps that seam with feature hooks, prompt-workspace synchronization, and editor post-render behavior. The application shell must not directly render business Views or rebuild navigation.


## Phase 51 · Application lifecycle

`WorldEngineLifecycleController` owns host lifecycle integration: MVU/tavern subscriptions, context-switch cleanup, Escape handling, panel open/close/toggle, terminal suspend/restore, and final disposal of subscriptions and DOM mounts.

The public `SamsaraWorldEngine.init / isOpen / open / close / toggle / dispose` methods are compatibility facade seams only. Run scheduling and cancellation intentionally remain outside this controller so application lifecycle does not absorb auto-progress or run-orchestration responsibilities.


## Phase 52 · Prompt settings and workspace

Prompt configuration is split along existing domain/UI boundaries instead of adding another wrapper class. `WorldPromptDocumentService` owns preset mutation and base prompt-setting validation/application; `WorldPromptWorkspaceController` owns reads from the prompt editing DOM.

`SamsaraWorldEngine.setPreset / readPromptEditor / applyPromptSettings` are compatibility facades only. `WorldEngineClassBridge` still wraps these seams to synchronize `WorldPromptRegistry`, so the all-prompts registry remains the single editable source for static AI instructions.


## Phase 53 · Configuration availability

`WorldEngineConfigService` owns the public configured/available/effective-enabled state and the `setEnabled` transition in addition to config initialization and persistence. Disabling still cancels work and closes the panel through engine seams; enabling the normal terminal path still requests terminal API activation.

The application shell retains only `isConfigured / isAvailable / isEnabled / setEnabled` facade methods. Run cancellation and scheduling remain separate runtime concerns.


## Phase 54 · Base run scheduler

`WorldRunScheduler` owns the base cancellation and fallback scheduling mechanics: generation invalidation, pending reset, timer cancellation, AbortController interruption and the 900ms fallback run delay. `SamsaraWorldEngine.cancel / schedule` are facade-only.

Automatic progression remains owned by `WorldAutoProgressController`, whose ClassBridge override keeps precedence over the base scheduler. The service container also constructs `WorldTimelinePolicy` before `WorldSoftMaintenancePolicy`, so soft maintenance and validation share the same timeline policy instance.


## Phase 55 · Remaining shell helper ownership

The application shell no longer owns built-in worldbook exclusion migration, run-inspection reset, failure toast routing, or status-theme persistence logic.

- `WorldKnowledgeService` owns default worldbook exclusion migration.
- `WorldRunOrchestrator` owns inspection reset and failure notification.
- `WorldPanelRenderer` owns status tone lookup and panel synchronization.

Public engine methods remain compatibility facades so external integrations and existing controllers keep the same surface.


## Phase 56 · Canonical source tree

`src/WorldEngine/` is now the only development source tree for the world engine. The migration-only `script/world-engine-src/` tree is removed.

The IIFE foundation, UI style resource, and bootstrap remain ordered build fragments because they define the single-file runtime boundary; their canonical locations are now `core/WorldEngineFoundation.part.js`, `ui/WorldEngineStyles.part.js`, and `core/WorldEngineBootstrap.part.js`. `tools/build-world-engine.py` rejects non-`@src` parts.

This is a physical source-boundary migration, not a behavioral rewrite. Further decomposition of the foundation happens separately so source ownership changes are not mixed with runtime semantics.


## Phase 57 · Base prompt defaults

Editable base prompt defaults no longer live in `WorldEngineFoundation`. `WorldBasePromptDefaults.part.js` owns `DEFAULT_PRESET`, `CORE_WORLD_RULES`, macro/stability defaults, the built-in prompt document and preset-editing helpers, and loads before configuration initialization consumes them.

The split preserves the original concatenated byte order. A small worldbook-selection helper group remains in this module only because it was inside the same contiguous legacy tail; it is an explicit Phase 58 migration target rather than a new ownership decision.


### Phase 58 · Host Adapter 与后台状态读取归域

已完成：新增 `WorldHostAdapter`，统一负责从 `env / host / TavernHelper` 解析并绑定酒馆宿主函数。公开 `engine.fn(name)` 继续保留，但只作为兼容 facade；Service Container 暴露同一个 `hostAdapter` 实例，后续宿主适配逻辑不得重新写回 application shell。

`WorldRuntimeContextService.backendState()` 接管 `engine.getState()` 的后台状态提取：仍从当前 MVU snapshot 读取，并与空后台结构合并后返回副本。公开 `getState()` 只委托 Runtime Context。与此同时 `saveConfig()` 收口为直接调用 `WorldEngineConfigService.save()`，删除 shell 内已经不可达的 localStorage fallback 实现。

本阶段刻意保留构造器中的 busy / committing / status / lastRequest 等 application 瞬时状态；这些属于 facade 自身运行态，不为缩短文件机械拆 class。


### Phase 59 · 世界书选择匹配归入 Knowledge Policy

已完成：新增 `WorldKnowledgeSelectionPolicy`，统一拥有世界书条目选择引用解析、世界书身份去版本归一、条目标题去齿轮前缀以及 selectedEntries 匹配。原先随 Foundation Prompt 连续块迁入 `WorldBasePromptDefaults.part.js` 的四个 helper 已全部移出，Prompt 默认文件重新只保存 Prompt/预设职责。

`WorldKnowledgeService`、`WorldTaskAwarenessFeature` 与 `WorldNpcAuditPolicy` 现在共享 Service Container 中同一个 `knowledgeSelection` 实例，因此默认世界书跨版本匹配、任务世界书恢复和 NPC 审计世界书开关使用完全相同的匹配规则。原 `parseSelectedEntryKey / normalizeWorldbookIdentity / normalizeWorldbookEntryTitle / selectedEntryMatches` 名称仍保留为 compatibility forwarder，不再保存第二套算法。


### Phase 60 · 正文抽取算法归入 Prose Extractor

已完成：新增 `WorldProseExtractor`，把原先位于 `WorldEngineFoundation.part.js` 的完整 `extractWorldProse` 算法原样迁出。隐藏思考/变量更新/技术面板过滤、assistant prefill 孤立结束标签兼容、代码围栏判定、JSON 技术楼层抑制以及 `<user>` 标签保留语义均不改变。

`WorldRequestBuilder` 现在显式组合 container-owned `proseExtractor`，正文楼层构造直接调用 `proseExtractor.extract()`；公开 `extractWorldProse(value)` 仍作为 CommonJS/旧调用 compatibility seam，但只转发到 active extractor。现有 `world-engine-prose` 与主引擎正文清洗回归继续作为公开行为验收。


## Phase 61 · Token telemetry

`WorldTokenTelemetry` is the canonical owner of local token estimation, token-count formatting, provider usage normalization and request-segment telemetry. `WorldRequestBuilder` and `WorldApiTransportService` compose the same container-owned telemetry instance. Compatibility functions keep the existing exported surface but delegate to the active telemetry service; `WorldEngineFoundation` no longer owns observability algorithms.


## Phase 62 · Calendar and time capacity

`WorldTimePolicy` now owns world-time keys, elapsed-capacity classification and calendar-date parsing as one domain. The application Foundation no longer implements `worldDateKey`, `worldTimeCapacity` or `calendarDate`. Existing global names remain compatibility forwards to the active time policy so UI, validation and exported test surfaces preserve behavior without duplicating algorithms.


## Phase 63 · Knowledge classification

`WorldKnowledgeSelectionPolicy` now owns both selection identity matching and worldbook classification: technical entries are isolated through `isTechnical()`, while chronology/backbone references are identified through `isTimelineBackbone()`. `WorldKnowledgeService` and `WorldChronologyFeature` compose the same container-owned policy. Foundation no longer carries knowledge-boundary regex algorithms.


## Phase 64 · Relation sync policy

`WorldRelationSyncPolicy` owns the formal-character synchronization contract: component shape validation, scalar bounds, derived-attribute reset, incremental component merge and component-count limits. `WorldResultMaterializer` composes the container-owned policy and only turns validated relation changes into patches; patch application reuses the same policy.


## Phase 65 · Asset materialization policy

`WorldAssetMaterializationPolicy` owns the shared-asset write contract: supported asset classes, item-like name rejection, owner normalization, safe defaults, partial energy merge, named unit/build merge with hidden harvest scheduling preserved, garrison updates and pending-event replacement. The canonical `WorldResultMaterializer` only resolves the target asset and emits add/replace/remove patches through the container-owned policy.


## Phase 66 · State integrity policy

`WorldStateIntegrityPolicy` owns persisted world-state invariants: backend record structure, event predecessor integrity/cycles, calendar validity, faction/exploration/causal/relation ranges, task/achievement states, public rumor credibility and event-reference integrity. It composes the canonical patch, time and rumor policies. `WorldResultMaterializer.validateBaseState()` remains only as the compatibility/application seam and delegates to the policy.


## Phase 67 · Patch application service

`WorldPatchApplicationService` owns mutation execution after WorldResult compilation: canonical paths, write permission, upsert/remove contracts, record merging, relation/task/economy constraints, temporal validation, persisted-state integrity, per-round reputation bounds and rumor rolling. `WorldResultMaterializer.applyPatches()` is now a thin facade to the container-owned service; final materialization remains responsible only for seed/model sequencing and domain repair passes.


## Phase 68 · Result patch compilation service

`WorldResultPatchCompilationService` owns the full WorldResult-to-patch compilation transaction. It composes the canonical normalizer, time, person, NPC audit, chronology, task, exploration, causal, relation-sync, asset-materialization and patch policies.

`WorldResultMaterializer.compileWorldResult()` is now a compatibility/application facade only. The materializer itself owns final state materialization and repair orchestration, while generic patch execution remains in `WorldPatchApplicationService`.


## Phase 69 · State materialization service

`WorldStateMaterializationService` owns final persisted-state assembly after patch compilation: backend default hydration, normalization, lifecycle compaction, seed/model patch ordering, exploration/event/causal/reference repair passes and final integrity validation.

It composes `WorldStateFactory` and `WorldLifecycleService` directly instead of routing through global compatibility helpers. `WorldResultMaterializer` is now a compatibility facade over `WorldResultPatchCompilationService` and `WorldStateMaterializationService`.


## Phase 70 · Prompt integration service

`WorldPromptIntegrationService` owns the application-layer integration between `WorldPromptRegistry`, prompt documents, request decoration, token telemetry and `WorldPromptWorkspaceController`. It does not own prompt defaults or persistence schemas; those remain in the registry/document services.

`WorldEngineClassBridge` now preserves only public compatibility seams and super-call ordering for prompt methods. Concrete registry merging, request rewriting, manifest telemetry and prompt-panel synchronization must not grow back into the bridge.


## Phase 71 · Result vocabulary

The former `WorldResultKernel` no longer exists as an algorithmic kernel. After patch compilation and final materialization were extracted, the file contained only shared WorldResult enums, record templates and field sets, so it has been renamed to `WorldResultVocabulary.part.js` without changing runtime values or load order.

Pure shared constants remain plain data instead of being wrapped in an empty service class. Domain behavior continues to live in the existing Contract, Normalizer, PatchCompilation, StateMaterialization, RelationSync, AssetMaterialization and Integrity services.
