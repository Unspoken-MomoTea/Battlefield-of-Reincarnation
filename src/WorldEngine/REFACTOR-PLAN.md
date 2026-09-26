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


### Phase 13 · WorldResult 归一化类化

已新增 `WorldResultNormalizer`，把传闻可信度、结构化字段、命名列表、资产、关系、完整 WorldResult 归一化以及 staged result merge 的内部 helper 收进独立类。兼容层只保留 `normalizeWorldResult / mergeWorldResults` 两个函数 seam，供尚未迁移的 legacy feature 调用。

`WorldEngineServiceContainer` 现在显式暴露 `resultNormalizer`，并把同一实例注入 `WorldResultCompiler`；Compiler 的 `normalize()` 不再直接依赖全局 helper。下一步继续把 Schema/Contract 与 materialize/patch compiler 从 Kernel 拆成独立类。


### Phase 14 · WorldResult Schema Contract 类化

已新增 `WorldResultContract`，集中构造 WorldResult 主 Schema、关系组件 Schema、资产 Schema、事件/人物/传闻 Schema。对旧代码继续提供 `WORLD_RESULT_SCHEMA`，但它现在只是 `WORLD_RESULT_CONTRACT.schema` 的兼容别名，Schema 构造 helper 不再留在 Kernel。

`WorldEngineServiceContainer.resultContract` 指向同一个 canonical contract，后续新代码应优先通过 service/contract 访问 Schema。下一步继续拆 `WorldResultMaterializer` 与 patch compiler，让 Kernel 只剩少量阶段编排和兼容函数。


### Phase 15 · WorldResult Materializer 类化

已新增 `WorldResultMaterializer`，接管 WorldResult 到 MVU patch 的编译、关系组件与资产物化、patch 应用、基础状态校验及最终世界更新 materialize。原 Kernel 只保留阶段分片/重试诊断和少量兼容编排，体积继续从约45KB降到约18KB。

为兼容仍会动态装饰校验器的旧 feature，对外继续保留 `compileWorldResult / validateState / applyPatches / materializeWorldUpdate` 函数 seam；其中 Materializer 内部应用 patch 后仍调用全局 `validateState`，保证 policy/rumor 的包装链不会被类化绕过。

`WorldEngineServiceContainer` 现在显式组合 `resultContract / resultNormalizer / resultMaterializer / compiler`，并把 container-owned Materializer 绑定为全局兼容 seam 的底层实现。由于任务、时间、完整性、异端等旧 feature 仍会包装 `compileWorldResult`，Compiler 的 `compile()` 暂时继续经过这个可装饰 seam；`materialize()` 已直接使用同一 Materializer。等这些 compile decorator 完成类化后再移除兼容路由。下一步继续拆 Kernel 中的 staged acceptance / retry diagnostics / reply parser。

### Phase 13 · WorldResult 分片验收类化

已新增 `WorldResultStagingService`，接管 WorldResult 的业务分片、逐片编译/物化验收、Schema 差异定位以及纠错重试反馈。外部仍保留 `stageWorldResult / retryFeedback / makeRetryFailure` 等兼容 seam，已有 policy/runtime 装饰器无需改变；`WorldResultCompiler.stage()` 与 service container 则改为组合容器拥有的 staging service。

这样 `WorldResultKernel.part.js` 继续收缩，只保留仍待迁移的共享常量、探索修复、时间/宏观验收 helper 与回复解析。下一批优先拆 Reply Parser，并把已由 `WorldValidationService` 使用的时间/宏观验收函数迁成独立 policy/service，避免 Kernel 继续承担运行期验收职责。

### Phase 14 · WorldResult 回复解析类化

已新增 `WorldResultReplyParser`，接管 `<world_update>`/Markdown fence/裸 JSON 的提取、首个完整 JSON 对象兜底、legacy patches 识别以及 WorldResult 归一化。运行编排器优先通过 `services.resultParser.parse()` 处理模型回复；全局 `parseReply` 继续作为 CommonJS 离线测试与兼容入口，并由 service container 的 active parser 驱动。

`WorldResultKernel.part.js` 因此进一步缩小，只剩共享常量、探索粒度修复以及时间/宏观验收 helper。下一步应迁移这批验收 helper 到 `WorldValidationService` 背后的独立 policy/class，并继续减少 Kernel 的跨域职责。

### Phase 16 · WorldValidation Policy 类化

已新增 `WorldValidationPolicy`，把到期事件、未排期事件、超期活动、时间越界、宏观骨架和推进锚点判断的基础实现从 `WorldResultKernel.part.js` 移出。Service Container 持有 `validationPolicy`，`WorldValidationService` 组合该实例；其中没有 legacy 装饰器的推进锚点检查已经直接委托 policy。

迁移期仍保留 `ensureDueHandled / unscheduledEvents / ensureEventTimeAnchors / ensureStaleActiveHandled / ensureTemporalAnomaliesResolved / ensureMacroBackbone` 等可重写的全局 seam，因为软维护、传闻活性、世界活动交付和到期事件放宽仍会在加载阶段装饰这些入口。全局 seam 的基础实现现在统一由 `ACTIVE_WORLD_VALIDATION_POLICY` 提供，等对应 legacy decorator 继续类化后再逐项删除。

至此 `WorldResultKernel.part.js` 已缩到只剩共享 WorldResult 常量和探索粒度修复。下一步优先把探索粒度迁入探索领域，并继续处理仍在 `script/world-engine-src` 中包装 compile/validation seam 的兼容模块。


### Phase 12 · 探索领域策略类化

已完成：`WorldExplorationService` 接管探索粒度判定、探索度回退保护、当前地点自动投影和旧版子区域合并。`WorldResultKernel` 删除探索 helper，`WorldResultMaterializer` 直接组合 exploration service；`59-soft-maintenance` 删除对 `compileWorldResult` 的探索包装，只保留“不回收长期探索台账”的兼容行为。

下一批继续从仍偏重的 legacy helper 中选择独立领域：优先处理世界状态迁移/投影与时间、因果校验，逐步压缩 `10-world-state.part.js` 和 `30-context-protocol.part.js`。


### Phase 13 · 时间线策略类化

已完成：新增 `WorldTimelinePolicy`，迁出 `storyStages / eventTimeAnchor / eventScheduleLabel / staleActiveEvents / temporalAnomalies / validateTemporalWrites / sortWorldEvents` 等时间线规则；`WorldValidationPolicy` 改为组合 timeline policy，兼容全局函数继续转发到 active policy。

这一步继续缩小 `10-world-state.part.js`，下一批优先拆事件生命周期/归档与状态规范化，再处理因果投影 helper。


### Phase 14 · 事件生命周期类化

已完成：新增 `WorldLifecycleService`，迁出冷结束事件归档、事件软引用解绑、传播过期判定与结束事件容量回收；`10-world-state.part.js` 不再实现这些规则。

`compactWorldLifecycle` 暂留 legacy 状态层作为兼容编排器，避免绕过 `59-soft-maintenance` 对长期探索台账“不离场回收”的动态 seam。下一批优先迁人物临时活动回收/异端死亡清理，再把顶层 lifecycle orchestration 收口。


### Phase 15 · 人物与总生命周期类化

已完成：`WorldLifecycleService` 接管 `personActivityMeta / pruneColdTemporaryPeople / pruneDeadAlienPeople / compactWorldLifecycle`。冷临时人物、死亡异端后台活动、过期传播与冷结束事件现在由同一 lifecycle service 统一编排；正式人物档案不由世界推进删除。

同时删除 legacy `pruneColdExploration`：探索已定义为长期玩家台账，离开地区不会再被生命周期回收。兼容报告保留 `回收探索: []`，避免调用方结构变化。

CI 的历史记忆补丁也改为识别 `WorldLifecycleService` 新归属，不再因为 `10-world-state.part.js` 中旧归档锚点已迁走而误报失败。下一批继续拆 `10-world-state.part.js` 中的状态规范化/事件层级修复与因果投影 helper。


### Phase 16 · 状态规范化类化

已完成：新增 `WorldStateNormalizer`，迁出 `normalizeBackendState / normalizeEventLayers / repairExplicitEventLinks / repairMacroPredecessors` 及内部事件分类 helper。旧 `10-world-state.part.js` 不再承载存档迁移和事件结构修复实现；兼容函数统一转发到 container-owned active normalizer。

`WorldResultMaterializer` 已直接组合 `stateNormalizer`。因果投影刻意留到下一阶段单独迁入 causal domain，避免 normalizer 再次变成混合职责大类。


### Phase 17 · 因果投影归域

已完成：`repairCausalProjection` 的真实实现迁入现有 `WorldCausalService.repairProjection()`；`WorldResultMaterializer` 直接组合 container-owned causal service，旧全局函数只保留兼容转发给尚未注入 service 的 UI 调用。

因此因果偏移手动维护、稳定值相关操作与宏观因果轨道投影开始统一收口到 causal domain。下一步继续拆 `10-world-state.part.js` 中仍残留的 `timelineState / emptyState / model patch policy` 等底层职责，优先按领域边界拆而不是继续扩大单类。


### Phase 18 · 时间线状态归域

已完成：`timelineState` 从 `10-world-state.part.js` 迁入 `WorldTimelinePolicy`，与故事线解析、事件时间锚点、陈旧活动判定、时间异常检测统一归域。变量重处理后的恢复流程已直接调用 `services.timelinePolicy.timelineState()`。

下一批将继续处理人物热投影/异端活动补种，优先归入 `WorldPersonActivityService` / projector，而不是让 `10-world-state` 继续承担人物领域逻辑。


### Phase 19 · 人物活动领域归域

已完成：\`WorldPersonActivityService\` 不再只负责手动编辑，而是接管人物热投影、单人物场景上下文、异端名单匹配、活跃异端复核条件、缺失异端人物补种与复核验收。原先分散在 \`10-world-state.part.js\` 与 \`59-alien-activity-normalization.part.js\` 的真实人物领域规则已经迁入同一个 class。

活跃异端仍采用事件驱动复核：只有活动缺失、下次检查到期、关联事件/所在地区变化或超过24小时未复核时才要求新活动；未触发者沿用既有目标/行动。旧 \`59-alien-activity-normalization\` 现在只保留 \`compileWorldResult\` 时间戳装饰兼容 seam，纠错文案直接由 \`WorldResultStagingService\` 负责，不再二次 monkey patch。

下一批继续处理 \`10-world-state.part.js\` 剩余的 \`emptyState / patch path policy / generic patch normalization\`，以及 \`30-context-protocol.part.js\` 的世界上下文投影装饰链；优先把“领域规则”与“协议/兼容层”彻底分开。


### Phase 20 · Patch 写入策略类化

已完成：新增 `WorldPatchPolicy`，接管 JSON Pointer 解析/编码、实体名称 canonicalize、缺失后台父记录补种、upsert 判定、后台记录结构校验、稀疏记录规范化、模型 patch 清洗/展开以及最终写入白名单。原 `10-world-state.part.js` 不再保存这些 patch 契约实现，只保留少量基础状态常量、名称/地点通用 helper 与重试输入兼容逻辑。

`WorldResultMaterializer` 与 `WorldResultCompiler` 已直接组合 container-owned `patchPolicy`：结果物化、状态校验和 legacy patch 清洗不再依赖全局函数作为主实现。全局 `tokens / pointer / allowed / normalizeBackendRecord / sanitizeModelPatches` 等仅作为尚未迁移调用方的兼容转发 seam。

下一批优先把 `retryableModelFailure / retryInput` 收进请求/运行编排领域，并评估 `emptyState / importStory` 的最终归属；随后转向 `30-context-protocol.part.js` 的投影装饰链。
