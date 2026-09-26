# 世界推进全面类化计划

## 当前结构

`SamsaraWorldEngine` 是 Application Facade。新的业务代码优先进入 `src/WorldEngine/`：

- `core/WorldEngineServiceContainer`：组合根；
- `domains/WorldMutationService`：手动写回事务与 replay；
- `domains/WorldEventService`：事件数据编辑；
- `domains/WorldPersonActivityService`：世界人物活动编辑；
- `domains/WorldHistoryService`：历史读取、压缩入口与手动修正；
- `domains/WorldCausalService`：因果偏移维护与稳定值重算；
- `domains/WorldExplorationService`：探索/势力领域入口；
- `domains/WorldRumorService`：传闻领域入口；
- `domains/WorldRequestService`：请求与纠错输入入口；
- `prompts/WorldPromptRegistry`：全部静态 AI 指令；
- `ui/WorldEngineViewRegistry`：业务页视图注册；
- `ui/WorldEditorController`：事件、人物、因果、历史四类手动编辑器；
- `ui/WorldPromptWorkspaceController`：统一提示词编辑界面。

## 迁移原则

采用 strangler migration，不一次重写整个运行时：

1. 先建立 class 与公开 seam；
2. 让旧入口委托 class；
3. 测试通过后删除该域的旧 `SamsaraWorldEngine extends ...` 层；
4. 最后把仍属于 legacy 的 helper 搬进 `src/WorldEngine`。

手动编辑域已经进入第 3 步：事件、世界人物、因果偏移、历史记忆不再各自制造新的主类继承层。

Phase 3 第一批又移除了 API 预设、因果概览、NPC 审计默认提示迁移、旧提示词工作台 4 个继承层；这些能力分别由 feature/controller class 或统一 Prompt Registry 接管。

## 下一批

仍需继续迁移的 legacy 继承功能主要是：

- 自动推进 / 变量重处理触发；
- replay 恢复；
- 时间所有权与时间轴保护；
- 传闻请求管线；
- NPC 审计开关与 policy compat；
- 软维护 / 世界完整性 / 世界活动交付等请求 feature。

这些后续都应变成独立 service/controller，并由单一 ClassBridge 调用；不得新增新的业务继承链。

### Phase 3 · 请求装饰类化

软维护、探索提示注入、世界完整性、世界活动交付、到期事件复核已经退出主类继承链。请求侧现在通过 `WorldRequestFeature` + `WorldEngineFeatureRegistry.afterBuildRequest()` 组合；Prompt Registry 仍是所有静态 AI 指令的最终唯一装配器。

### Phase 4 · 任务 / 时间轴 / 传闻请求类化

`WorldTaskAwarenessFeature`、`WorldChronologyFeature`、`WorldRumorRequestFeature` 已接管原先 57/58/56/59-rumor 系列中的主类请求包装。任务世界书选择恢复走 `afterCatalogue`，传闻运行期复核走 `aroundRun`，请求 payload/manifest 统一走 `afterBuildRequest`。这批对应的隐藏静态文本（任务列表只读语义、无时间轴资料说明、传闻取材边界）也已进入 Prompt Registry。

### Phase 5 · 状态型生命周期类化

已完成：`WorldAutoProgressController`、`WorldReplayService`、`WorldTimeOwnershipFeature`、`WorldNpcAuditPolicy`、`WorldHistoryLifecycle` 接管 auto-progress / auto-trigger / replay / reprocess / time-ownership / policy-compat / history-memory 中原先依赖主类继承的行为。旧分片仅保留常量、纯函数、编译器补丁或兼容模块名，不再创建新的 `SamsaraWorldEngine` 子类。

### Phase 6 · 核心编译与状态投影

已建立 `WorldStateProjector` 与 `WorldResultCompiler`，主 runtime 已通过 service container 调用它们，不再直接绑定 `projectWorldContext / stageWorldResult / compileWorldResult / materializeWorldUpdate`。底层纯函数仍暂留 legacy source 作为兼容实现。

下一阶段继续把这些 service 背后的纯领域 helper/monkey patch 真正搬入 `src/WorldEngine`，重点是 WorldResult 字段编译器、世界状态投影/迁移与剩余时间/因果校验函数；Application Facade 只保留兼容入口。


### Phase 7 · 统一结果验收

已新增 `WorldValidationService`。主世界结果的到期事件、事件时间锚点、超期活动、时间越界、异端活动、NPC 审计和宏观骨架校验统一通过一个 class seam 完成；并发状态重编译也复用同一服务。主 runtime 继续向“请求 → 编译 → 验收 → 提交”的 Application Flow 收缩。


### Phase 8 · 提交事务

已新增 `WorldCommitService`，把结果接受后的稳定值、最近变化、历史/replay 派生数据、Schema 二次确认和最终 MVU 单次写回从主运行循环拆出。主 runtime 进一步接近纯 Application Flow。


### Phase 9 · UI 业务页类化

已把世界概览、人物、探索、资产、事件、传闻、历史、设置、提示词和请求检查注册成独立 View class。资产与传闻已经从 `50-engine-ui.part.js` 移出；主 UI 只通过 `WorldEngineViewRegistry.render()` 路由页面。

已完成：原 `script/world-engine-src/ui/10~70-*.part.js` 的业务 renderer 已搬入对应 View class 并删除。Legacy UI 目录只保留共享基础样式资源 `ui/00-styles.part.js`；后续页面业务只能写入 `src/WorldEngine/ui/views/`。

### Phase 10 · Runtime 核心读取类化

已迁移当前楼层/MVU 上下文读取、基础阻塞判断、世界书目录/蓝绿灯读取与基础请求构造。主 runtime 对这些能力只保留兼容 facade，实际实现位于 `WorldRuntimeContextService / WorldKnowledgeService / WorldRequestBuilder`。

下一步继续拆专属 API 传输、Prompt 文档持久化与主 `run()` 的 attempt/compile/commit orchestration，使 `SamsaraWorldEngine` 最终只保留 Application Flow。


### Phase 11 · Runtime 传输与主流程编排

已新增 `WorldApiTransportService / WorldPromptDocumentService / WorldRunOrchestrator`。专属 API 请求与结构化降级、提示词文档 CRUD，以及主推进 retry/compile/validate/commit 循环均不再由 runtime 直接实现。

下一步继续拆：引擎启停与面板生命周期、Prompt Editor 基础字段读写、剩余 legacy helper/monkey patch；同时继续把 `script/world-engine-src/ui/*.part.js` 的 legacy renderer 内部实现迁入 `src/WorldEngine/ui/views`。


### Phase 12 · WorldResult 内核迁出 legacy

已把原 `script/world-engine-src/20-world-result.part.js` 的完整 WorldResult Schema、归一化、分片、编译、物化、patch 应用与回复解析实现原样迁入 `src/WorldEngine/domains/WorldResultKernel.part.js`，并把构建顺序放回原 20 号槽位。旧 `20-world-result.part.js` 现在只保留兼容边界说明，不再承载业务实现。

这一阶段刻意保持零行为变化，先完成“源码归属”迁移；下一步在 `src/WorldEngine/domains/` 内继续把 Kernel 拆为 Normalizer / Contract / Materializer / Reply Parser 等类，并逐步让 `WorldResultCompiler` 直接组合这些类，最终删除全局 helper seam。
