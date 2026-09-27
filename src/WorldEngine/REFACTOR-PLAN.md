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


### Phase 21 · 请求纠错协议归域

已完成：`WorldRequestService` 接管 `retryableModelFailure / retryInput` 的真实实现，统一负责模型失败是否允许重试、纠错 payload、已接受业务结果与补充清单的携带。运行编排通过 container-owned `requests` service 判断可重试错误，不再由 `10-world-state.part.js` 保存请求协议逻辑。

纠错“要求”仍由 `WorldPromptRegistry.retryRequirement()` 提供，因此三种纠错提示词继续在“提示词预设 → 全部实际提示词”中可见、可编辑。全局 `retryableModelFailure / retryInput` 仅保留兼容转发 seam。

下一批评估 `emptyState / importStory` 的最终归属，然后进入 `30-context-protocol.part.js` 的上下文投影装饰链迁移。


### Phase 22 · 后台状态工厂归域

已完成：新增 `WorldStateFactory`，接管世界后台空状态的 canonical 创建逻辑；公开 `emptyState()` 保持原接口，仅转发到 factory，现有运行时与离线测试无需改调用方式。Service Container 暴露 `stateFactory`，后续需要创建后台状态的 class 可以逐步改为显式组合。

`importStory()` 仍由 `WorldRequestBuilder` 用于旧故事线存档的宏观种子兼容，因此没有删除其行为；真实实现迁入 `WorldTimelinePolicy.importStory()`，全局函数只保留兼容转发。这样旧存档兼容属于时间线领域，不再回到状态大文件。

至此 `10-world-state.part.js` 只剩世界后台 Schema/模型常量与少量名称/地点通用 helper。下一阶段进入 `30-context-protocol.part.js`，优先把角色/资产/因果的正文投影 helper 收进 projector/policy class。


### Phase 23 · 世界上下文投影归域

已完成：`WorldStateProjector` 接管角色能力清洗、装备/道具/形态投影、资产账簿清洗、历史/传播热尾部、因果轨道热偏移以及基础 `projectWorldContext` 构造。原 `30-context-protocol.part.js` 不再保存这些投影算法，只保留一个在早期加载的兼容 base seam。

任务感知与分层历史仍会在加载期装饰全局 `projectWorldContext`；`WorldStateProjector.world()` 暂时经过这个公共 seam，因此本次迁移不会绕过已有任务只读投影或历史记忆投影。真正的基础实现已经在 class 内，等对应 decorator 后续迁成 feature 后即可删除早期兼容层。

下一刀处理 `activation()`：它只服务世界书读取，应该进入 `WorldKnowledgeService`；随后再拆 NPC 构筑审计投影/验收。


### Phase 24 · 世界书激活策略归域

已完成：`activation()` 从 `30-context-protocol.part.js` 迁入 `WorldKnowledgeService.activation()`。蓝灯常驻、绿灯主关键词、次要关键词逻辑、强制读取与禁用/空内容判定现在和世界书 catalogue/read 管线属于同一个 class；`worldbook()` 直接调用 service method，不再依赖全局 helper。

`30-context-protocol.part.js` 继续缩小，当前剩余重点是 NPC 构筑审计投影/验收、协议文本兼容以及极少量早期 seam。


### Phase 25 · NPC 构筑审计领域归域

已完成：新增 `WorldNpcAuditService`，把 NPC 审计投影、剧情份量定级、热对象筛选、构筑缺口计算与验收反馈从 `30-context-protocol.part.js` / `55-npc-narrative-audit.part.js` / `55-policy-compat.part.js` 收口到一个 canonical domain service。

最终有效规则保持不变：审计级别与生命层级解耦；世界后台已有合法私有审计级别时优先沿用；活跃异端无私有定级时默认首领/Boss级；队友不参与审计；最低构筑按杂兵 1/2/1、精英 1/4/2、Boss 1/6/4 计算，装备只统计状态=1。未补真实缺口时仍返回逐 NPC 的未解决缺口、建议字段和本轮实际提交。

`WorldResultMaterializer` 与 `WorldValidationService` 现在显式组合 container-owned `npcAudit`，不再通过全局审计函数作为主实现。全局 `npcBuildAssessment / npcBuildAudit / ensureNpcBuildAuditProgress` 仅保留 UI、旧 feature 与离线测试兼容转发；`WorldNpcAuditPolicy` 只负责启停、世界书同步和 UI，不再承担审计算法。


### Phase 26 · 输出协议与时间锚点归域

已完成：`protocol()` 的真实实现迁入 `WorldResultContract`。Contract 现在同时拥有可编辑的输出协议说明 `instruction()` 与“说明 + Canonical WorldResult JSON Schema”的完整 `protocol()`；旧全局 `protocol()` 只保留兼容转发。Prompt Registry 的 `outputProtocol` 默认值直接读取 `WORLD_RESULT_CONTRACT.instruction()`，因此提示词仍在“全部实际提示词”中统一可编辑，而 Schema 继续保持程序只读契约。

`sameWorldTimeAnchor()` 的真实实现迁入 `WorldTimelinePolicy.sameTimeAnchor()`，人物活动、生命周期与传闻等旧调用继续通过兼容函数获得同一语义。`30-context-protocol.part.js` 不再保存输出协议或时间比较算法，进一步收缩为早期 projector seam 与旧 NPC 默认提示兼容层。

下一批优先处理剩余 `compileWorldResult` decorator；按领域逐条迁移，不一次拆掉整个装饰链。


### Phase 27 · 异端时间戳 compile wrapper 移除

已完成：删除 `script/world-engine-src/59-alien-activity-normalization.part.js`。第一次迁移尝试把预处理放到 `WorldResultCompiler / WorldResultStagingService`，但公开兼容入口仍允许测试与旧调用方直接调用全局 `compileWorldResult()`，会绕过这两层。最终实现因此下沉到 canonical `WorldResultMaterializer.compileWorldResult()`：Materializer 显式组合 container-owned `WorldPersonActivityService`，在任何编译入口真正生成 patch 之前统一调用 `normalizeAlienActivityTimestamps()`。

这样三条路径——直接 `compileWorldResult()`、Compiler 最终编译、Staging 分片验收——都会进入同一个 Materializer 编译边界，不再需要重复预处理。空世界时间仍可从本轮结果解析时间锚点，完整异端活动仍由程序统一写最终世界时间；原有 `Active alien activity normalization` 集成回归继续作为公开行为 seam。

剩余 `compileWorldResult` legacy decorator 继续按领域逐条迁移。


### Phase 28 · 任务感知领域归域

已完成：新增 `WorldTaskAwarenessService`，统一拥有正式任务账簿的只读投影与事件 `关联任务` 合法性校验。世界推进继续只读取 `任务.列表` 中的委托方、目标、隐藏真相、难度、交付与状态；奖励、惩罚、副本成就、击杀等结算数据不进入世界上下文。

`WorldStateProjector` 现在直接组合 container-owned `taskLedger` 生成 `当前变量.任务.列表`；`WorldResultMaterializer` 在 canonical `compileWorldResult()` 边界通过同一 service 校验事件只能引用现有任务。因此直接调用兼容 `projectWorldContext / compileWorldResult`、Compiler 与 Staging 路径保持同一行为。

`57-task-awareness.part.js` 删除 `projectWorldContext=function...` 与 `compileWorldResult=function...` 两个 monkey patch，只保留任务只读提示、任务世界书标题与旧排除标记迁移；`WorldTaskAwarenessFeature` 继续只负责世界书选择恢复和请求 manifest，并与 Projector/Materializer 共用同一 `taskLedger`。


### Phase 29 · 原著 / 数据库时间轴策略归域

已完成：新增 `WorldChronologyPolicy`，把明确到日的原著/数据库时间证据提取、节点改期豁免、宏观节点日期硬校验以及对应纠错动作从 `58-chronology-guard.part.js` 收口到一个 stateful policy。

`WorldChronologyFeature` 继续负责读取时间线/年表世界书与请求 payload/manifest，但不再写全局 `ACTIVE_CHRONOLOGY_GUARD`，而是把本轮世界时间与最终读取资料写入 container-owned `chronologyPolicy`。Canonical `WorldResultMaterializer.compileWorldResult()` 在真正编译 patch 前调用同一 policy 做硬校验，因此直接兼容入口、Compiler 与 Staging 都保持一致。

`WorldResultStagingService` 组合相同 policy，通过 `retryGuidance()` 继续生成原有“宏观时间轴”纠错动作；后续 legacy retry wrapper 仍可在其外层追加各自领域说明。`58-chronology-guard.part.js` 现在只保留可编辑的时间轴提示词、默认预设升级常量与迁移逻辑，不再重写 `compileWorldResult` 或 `retryPlanForFailure`。


### Phase 30 · 因果编译策略统一归域

已完成：`WorldCausalService` 现在统一拥有两套旧 59 因果编译规则：新偏移的世界尺度证据过滤，以及影响幅度/未实现后果/预测描述/世界排异反应/同根因拆分/同引发者预算的软归一化。Materializer 保持原执行顺序：先 `filterNewOffsetsByWorldScale`，再 `softNormalizeOffsets`，随后编译业务 patch，最后追加历史局部脏偏移清理与诊断警告。

`59-causal-stability-gate.part.js` 已整文件删除；`59-world-integrity-guard.part.js` 不再保存因果 Schema 修改、软归一化函数或 `compileWorldResult` wrapper，只保留时间完整性规则与对应 retry 逻辑。

因果偏移 `影响程度` 的 JSON Schema 现在在 `WorldResultContract` 中直接定义为 number，不设置硬上下限；-12/+15 等业务范围继续由 CausalService 软处理。历史脏偏移清理不再通过 `applyPatches` monkey patch 绕过安全层，`WorldPatchPolicy` 显式拥有 `removable()` 与按操作类型判定的 `allowed(..., op)`，只开放精确的 `/世界/因果轨道/偏移记录/<名称>` 删除路径。


### Phase 31 · NPC 审计装备默认状态归域

已完成：`55-npc-narrative-audit.part.js` 最后一条 `compileWorldResult` monkey patch 已移除。审计补全关系装备时，“既有 NPC 的新装备默认 `状态=1`、已有装备不强改状态”的真实实现迁入 `WorldNpcAuditService.normalizeNewEquipment()`。

Canonical `WorldResultMaterializer.compileWorldResult()` 在 WorldResult 归一化后调用该方法，因此直接导出的 `compileWorldResult()`、Compiler 与 Staging 都继续得到相同结果。现有装备若明确处于状态0/2则不会被重写；只有本轮首次加入该 NPC 装备表的装备被默认视为已装备，防止用状态0绕过 NPC 构筑数量。

`55-npc-narrative-audit.part.js` 现在只保留剧情份量版 NPC 构筑审计提示词和默认提示词迁移说明，不再参与编译链。


### Phase 32 · 世界时间结果策略彻底归域

已完成：新增 `WorldTimePolicy`，把 `59-world-time-ownership.part.js` 中原先依赖加载顺序的时间结果逻辑全部迁入 canonical domain：世界时间是否未初始化、活动时间锚点归一、当前活动反推初始时间、精确日期日历兼容校验、禁止时间回退、本轮候选时间校验快照以及最终 `/世界/时间` patch。

这次不是只删除最后一层 `compileWorldResult` wrapper。原来同文件对 `normalizeWorldResult / mergeWorldResults / worldResultFragments / allowed` 的四条动态覆盖也一起消失：
- `WorldResultContract` 正式声明顶层 `时间` 与事件时间字段的机器可读格式说明；
- `WorldResultNormalizer` 正式保留/合并顶层时间；
- `WorldResultStagingService` 正式把时间拆成独立验收片段，并直接使用 Normalizer/Materializer；
- `WorldPatchPolicy` 的 canonical `allowed()` 本来已经允许 `/世界/时间`，不再需要后加载补丁；
- `WORLD_REPLAY_SCOPES` 在定义处直接包含 `世界.时间`。

`WorldPersonActivityService` 与 `WorldTimeOwnershipFeature` 都显式组合 container-owned `timePolicy`；Materializer 先用 policy 建立候选世界时间快照，再在该快照上执行人物/事件/因果等整份编译，最后统一提交时间 patch，保持原有事务语义。

至此运行源码中不再存在任何 `compileWorldResult=function...` decorator。全局 `compileWorldResult()` 仅保留外部兼容入口，Compiler 与 Staging 都直接调用 canonical Materializer。下一批转向剩余 `retryPlanForFailure` 文案装饰器和最后的 project/history 兼容 seam。


### Phase 33 · 纠错补充清单类化 + 全量可编辑

已完成：新增 `WorldRetryGuidanceService`，统一接管“业务校验错误 → 纠错补充清单”的匹配、顺序与占位符填充。原本分散在 `WorldResultStagingService`、`55-policy-compat.part.js`、`56-rumor-liveliness.part.js`、`59-world-integrity-guard.part.js`、`59-world-activity-delivery.part.js` 的纠错动作不再依赖后加载 monkey patch。

本阶段同时修掉提示词工作台的遗漏：这些纠错动作会真实发送给模型，因此 20 条静态模板全部以 `retryGuide*` key 进入 Prompt Registry 的“纠错重试”分组。宏观骨架中的因果投影提示与“因果轨道投影无效”后的修复提示保持两条独立模板，避免重构时偷偷改变旧纠错语义。模板支持 `{name}`、`{details}`、`{current}`、`{active}`、`{future}`、`{missing}` 等运行时占位符；用户编辑后，下一次纠错直接读取当前预设值。

`WorldResultStagingService.retryPlanForFailure()` 现在只委托 canonical guidance service；`makeRetryFailure()` 也直接在 Staging 内完成具体原因去重与 actions 生成，删除 `55-policy-compat` 的二次包装。四个 legacy 文件已不存在 `retryPlanForFailure=function...`。

下一批继续清理仍依赖全局 decorator 的 validation / temporal / projector / history seam，优先迁移实际算法，不为了“类数量”机械拆文件。


### Phase 34 · 历史记忆上下文投影归域

已完成：移除 `59-history-memory.part.js` 对 `projectWorldContext` 的最后一层后加载装饰。现有 `WorldHistoryService.project()` 成为历史记忆投影的正式 service seam；构建顺序把 HistoryService 放到 StateProjector 之前，Service Container 先构造 container-owned `history`，再注入 `WorldStateProjector`。

`WorldStateProjector.baseWorld()` 现在直接输出 `世界.后台.历史记忆`，不再先发送旧 `历史` 热尾巴再由 wrapper 删除；`world()` 直接返回 `baseWorld()`。因此 `projectWorldContext()` 只剩外部兼容入口，不再存在 task/history 加载期 decorator。

本阶段只迁调用边界，不重写分层历史树的纯算法：`projectWorldHistoryMemory / historyMemoryRootsAtLevel / historyMemoryBatchForLevel` 等仍保留在 history-memory 模块供 HistoryService 与 HistoryLifecycle 共用。下一阶段再评估把这批算法整体搬入 `src/WorldEngine/domains`，避免一边迁 seam 一边改压缩语义。


### Phase 35 · 历史记忆树算法彻底迁出 legacy

已完成：在 Phase 34 只迁走上下文投影 seam 之后，本阶段新增 `WorldHistoryMemoryPolicy`，把原 `59-history-memory.part.js` 中剩余的全部真实算法迁入 `src/WorldEngine/domains/`：L0 叶子编号与排序、已收纳子项计算、祖先总结失效、各层根节点/压缩批次、总结键生成、辅助模型回复解析、压缩输入生成、历史记忆投影以及并发 digest。

`WorldHistoryService` 与 `WorldHistoryLifecycle` 显式组合 container-owned `historyMemory` policy；`WorldStateProjector` 继续只依赖 HistoryService，fallback 也直接调用默认 policy，不再引用全局 `projectWorldHistoryMemory()`。公开 `projectWorldHistoryMemory / historyMemory* helper` 仅由 src policy 提供兼容转发。

`script/world-engine-src/59-history-memory.part.js` 已从构建清单和源码树直接删除；`HISTORY_MEMORY_SYSTEM` 也随 policy 进入 src，Prompt Registry 的 `historyMemory` 注册项保持不变，因此历史压缩提示词仍在“提示词预设 → 全部实际提示词”中可见、可编辑。

下一批继续清 validation / temporal compatibility seam；legacy 目录只允许删薄或删除，不再新增领域实现。


### Phase 36 · 时间解析与完整性时序彻底归域

已完成：`worldDateKey()` 的真实算法从 `00-foundation-prompt.part.js`、`59-world-integrity-guard.part.js`、`59-world-time-daypart-aliases.part.js` 收口到 `WorldTimePolicy`。数字公历日期、作品内时段、地支时辰、HH:mm/秒级精确时钟与“早上/夜晚/黄昏”等同义时段现在由 `WorldTimePolicy.key()` 统一解析；Foundation 只保留外部兼容转发。

`WorldTimelinePolicy` 显式组合 container-owned `timePolicy`，并直接拥有最终有效的时间完整性语义：事件、地区、历史、传播等宏观事实只按自然日越界；人物动态仅在双方都有精确时钟时执行同日分钟级未来检查。原 `59-world-integrity-guard` 删除 `worldDateKey / temporalAnomalies` monkey patch，`59-world-time-daypart-aliases.part.js` 整文件删除。

现有 `world-engine-integrity-guard.cjs` 继续作为公开行为 seam，确保精确人物时钟、同日宏观放行、跨日拒绝、时段前后与世界时间不可回退语义保持不变。

下一批继续清理剩余 validation / rumor / due-event 全局覆写；新实现只进入 `src/WorldEngine`，legacy 文件只允许删除逻辑或保留兼容常量。


### Phase 37 · 到期事件软复核归域

已完成：新增 `WorldDueEventPolicy`，接管到期复核点计算、到期事件软复核清单以及“未处理不作为整轮硬门槛”的最终语义。Policy 显式组合 `WorldTimePolicy`，不再依赖旧文件通过全局 `worldDateKey` 进行运行时覆盖。

`WorldDueEventFeature` 只负责把 policy 生成的软复核清单写入请求；`WorldValidationPolicy.ensureDueHandled()` 只委托同一个 due-event policy，因此请求层与验收层共享一套规则。旧 `59-due-event-relaxation.part.js` 已整文件删除，不再存在 `ensureDueHandled=function...` monkey patch。

现有 `world-engine-due-event-relaxation.cjs` 继续作为公开行为 seam：到期事件会进入软提醒；未来 `下次检查` 到来前不重复催办；模型本轮不处理到期事件不会导致 retry；延期只更新 `下次检查`，不得篡改触发条件。

下一批继续清理 soft-maintenance / rumor / world-activity 对 validation/staging 的全局覆写，仍坚持“新逻辑只进入 `src/WorldEngine`，旧文件只删逻辑”。


### Phase 38 · 事件前因校验兼容层移除

已完成：`55-policy-compat.part.js` 整文件删除。事件前因的最终结构规则现在直接属于 `WorldResultMaterializer.validateBaseState()`：前因不得引用事件自身；每个前因名称必须指向已经存在或本轮成功建立的事件；完整事件图仍执行循环检测。

原兼容层提供的可执行错误反馈保持不变：自引用继续返回 `事件前因非法自引用：<事件名>`，缺失前因继续列出 `事件前因不存在：<事件> <- <缺失名称>`，因此 `WorldResultStagingService` 与 `WorldRetryGuidanceService` 的既有纠错 seam 无需任何 monkey patch。

本阶段通过公开 `applyPatches()` seam 新增回归，锁定自引用与缺失名称两类错误语义；构建与 Phase 5/架构测试也不再读取已删除的兼容模块。

下一批继续处理 `59-soft-maintenance`、传闻相关文件和 `59-world-activity-delivery` 剩余的 validation/staging 全局覆写。新业务逻辑仍只进入 `src/WorldEngine`。


### Phase 39 · 世界活动交付策略归域

已完成：新增 `WorldActivityPolicy`，统一接管世界活动语义快照、数量统计、初始化缺口、非异端实质变化判定、最终交付验收与修复需求判断。原 `59-world-activity-delivery.part.js` 中的算法和 `ensureMacroBackbone=function...` monkey patch 已全部移除，旧文件整文件删除。

`WorldActivityRequestFeature` 只负责把 policy 生成的要求写入 payload / timeline / manifest；`WorldValidationPolicy.ensureMacroBackbone()` 在完成可选宏观骨架校验后，无论 `requireMacroBackbone` 是否关闭，都会调用同一个 container-owned `activityPolicy.ensureDelivery()`。因此保留原行为：关闭宏观骨架不等于允许世界停摆。

`WORLD_ACTIVITY_DELIVERY_RULES` 默认提示文本随 policy 一起迁入 `src/WorldEngine`，Prompt Registry 的 `worldActivity` 仍登记并可编辑；请求内 `worldActivityInputGuidance` 的来源元数据同步改为 `WorldActivityRequestFeature`。现有异端活动集成回归继续守住“只有异端/摘要变化必须 retry，补足现实世界活动后才允许提交”。

下一批继续处理 soft-maintenance 与 rumor 域仍存在的全局 validation/staging 覆写。


### Phase 40 · 软维护验收策略彻底归域

已完成：新增 `WorldSoftMaintenancePolicy`，接管事件可用排期锚点判定、未排期事件扫描与排期补全复核。最终语义保持既有软维护行为：具体时间、有效条件、明确前因任一存在即可作为合法时间锚点；真正仍缺锚点的事件只返回维护缺口，不再因为辅助维护未完成而拒绝整轮已合格结果。

`WorldValidationPolicy` 显式组合 container-owned `softMaintenancePolicy`，公开 `unscheduledEvents / ensureEventTimeAnchors` 兼容 seam 继续经过 active validation policy；`WorldRunOrchestrator` 和 `WorldValidationService` 因而无需任何后加载 monkey patch 即获得同一软维护语义。

`SOFT_MAINTENANCE_RULES` 默认提示文本已随 policy 迁入 `src/WorldEngine`；`EXPLORATION_PROJECTION_RULES` 迁入 `WorldExplorationService`。两者仍由 Prompt Registry / module prompt workspace 展示和编辑。原 `script/world-engine-src/59-soft-maintenance.part.js` 已整文件删除，构建 workflow 与 request-size patch 工具也移除了该旧路径。

下一批继续清理 rumor legacy：优先把仍留在 `56-rumor-liveliness / 59-rumor-throttle / 59-rumor-world-source` 的默认提示与预设升级逻辑迁到 `src/WorldEngine`，然后删除不再需要的旧文件。


### Phase 41 · Rumor legacy 提示与预设迁移

已完成：传闻领域的真实维护算法此前已经集中到 `WorldRumorService`，本阶段继续把最后残留的静态提示默认值与内置 preset 升级逻辑也收进该 service。现在 `RUMOR_LIVELINESS_RULES / RUMOR_THROTTLE_RULES / RUMOR_WORLD_SOURCE_RULES` 由 `src/WorldEngine/domains/WorldRumorService.part.js` 持有，仍通过统一 Module Prompt / Prompt Registry 暴露为可编辑的“传闻与传播”提示。

`WorldRumorService.upgradePreset()` 保留原本实际生效的两步迁移：旧“更新传播”步骤先升级为常驻传闻步骤，再升级为当前“世界侧事实驱动 + 按需刷新 + 软失败”步骤；未接线的旧 `RUMOR_WORLD_SOURCE_PRESET_STEP` 不再保留，避免重构顺手引入新行为。`WorldRumorRequestFeature.initialize()` 直接调用 container-owned rumor service，不再依赖全局升级函数。

原 `56-rumor-liveliness.part.js`、`59-rumor-throttle.part.js`、`59-rumor-world-source.part.js` 以及只剩注释的 `59-rumor-world-request.part.js / 59-rumor-world-system.part.js` 已全部删除。构建清单、自动同步 workflow 与 request-size patch 工具同步移除这些 legacy 路径。


### Phase 42 · Legacy 小壳与提示词默认值清零

已完成：把仍散落在 legacy 55/57/58/59 文件中的静态提示词默认值、Module Prompt 定义与内置 preset 迁移逻辑统一收进 `src/WorldEngine/prompts/WorldPromptDefaults.part.js`。本次是零行为迁移：NPC 构筑审计、任务只读、原著时间轴、因果/事实时间、世界时间、精简默认 preset 与模块提示词文本均保持原文；`WorldPromptRegistry` 继续引用同名常量，因此“提示词预设 → 全部实际提示词”的可见、可编辑、保存/导入/导出行为不变。

Replay 合同常量 `WORLD_REPLAY_VERSION / WORLD_REPLAY_SCOPES` 迁入 `WorldReplayService`，与真正消费它们的恢复服务同域。旧的 auto-progress / auto-trigger / replay-persistence / reprocess / api-preset 注释占位不再保留。

本阶段整文件删除：
- `55-npc-narrative-audit.part.js`
- `57-task-awareness.part.js`
- `58-chronology-guard.part.js`
- `59-world-integrity-guard.part.js`
- `59-world-time-ownership.part.js`
- `59-editable-module-prompts.part.js`
- `59-auto-progress.part.js`
- `59-auto-trigger-rebuild.part.js`
- `59-world-replay-persistence.part.js`
- `59-reprocess-immediate-retry.part.js`
- `59-api-preset-selection.part.js`

自动构建 workflow、历史补丁工具、replay 单写工具和 Phase 3/4/5/架构测试同步切到 `src/WorldEngine`。至此 `script/world-engine-src` 顶层只剩 10 个文件；后续仍执行同一规则：旧目录只能继续删除/变薄，新业务与默认提示不得回流。


### Phase 43 · 编辑与因果 UI 小壳彻底迁出 legacy

已完成：把最后三个 59 系列编辑/UI 小壳迁入已有 src 类并整文件删除。

- `WorldCausalService` 直接拥有手动偏移编辑后的稳定值重算、同路径 replay 比较与 replay 同步；不再反向调用 `59-causal-offset-editor` 全局 helper。
- `WorldCausalOverviewController` 直接拥有因果摘要/档案展示、隐藏玩家重复页、干涉模式展示与 section 查找；同名函数只在该 src 文件中保留外部兼容转发。
- `WorldHistoryService` 直接拥有历史编辑的关联事件解析与 replay 同步；`WorldEditorController` 自己负责 HTML 转义，不再依赖 history editor 全局 helper。

已删除：
- `59-causal-overview-ui.part.js`
- `59-causal-offset-editor.part.js`
- `59-history-memory-editor.part.js`

现有因果摘要、因果偏移编辑、历史记忆编辑三组公开回归继续作为行为 seam。下一批处理 `editor/` 三个旧编辑 helper 与 `20/30` 两个兼容槽，仍坚持 legacy 目录只删不长。


### Phase 44 · editor 目录彻底迁出 legacy

已完成：删除 `script/world-engine-src/editor/` 下全部三个 helper 文件，手动编辑链不再依赖任何 legacy editor 全局函数。

- `WorldMutationService` 拥有世界后台获取、文本列表/JSON 列表规范化、replay 路径冲突判定与编辑 delta 合并。
- `WorldEventService` 拥有事件重命名/删除后的引用重定向，以及事件前因图与关联事件完整性校验。
- `WorldPersonActivityService` 拥有世界人物活动记录的关联事件校验。
- `WorldEditorController` 拥有 HTML 转义、表单 list/JSON 解析与事件 select 渲染。

已删除：
- `editor/00-world-mutations.part.js`
- `editor/10-event-editor.part.js`
- `editor/20-person-editor.part.js`

至此 `script/world-engine-src/editor/` 目录消失。下一批处理 `20-world-result.part.js` 与 `30-context-protocol.part.js` 两个兼容槽，再评估 `10-world-state` 是否可以把 RECORDS/DETAILS 与命名 helper 迁进 src 后整文件删除。


### Phase 45 · 删除 20 / 30 编号兼容槽

已完成：`20-world-result.part.js` 与 `30-context-protocol.part.js` 从 legacy 树和真实构建管线整文件删除。

- WorldResult 的兼容常量/函数早已由 `WorldResultKernel / Contract / Normalizer / Materializer / Staging / ReplyParser` 等 src 模块拥有，原 20 号文件只剩注释，因此直接删除。
- `WorldStateProjector.part.js` 现在同时拥有 active projector seam 与 `projectWorldContext / projectCharacterForWorld / projectAssetsForWorld` 等外部兼容转发，不再需要 30 号前置壳。
- 旧版 `NPC_BUILD_AUDIT_RULES` 仅用于历史预设迁移与默认兼容，现已迁入 `src/WorldEngine/prompts/WorldPromptDefaults.part.js`；当前实际审计提示仍以 `NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT` 为准并由 Prompt Registry 可编辑。

下一批评估 `10-world-state.part.js`：把剩余 RECORDS / DETAILS / NPC_AUDIT_LEVELS 与名称/location helper 迁入 src 后尝试整文件删除。随后再集中处理最后的大壳 `40-engine-runtime` / `50-engine-ui`。


### Phase 46 · 删除 10 号状态兼容槽

已完成：`script/world-engine-src/10-world-state.part.js` 整文件删除。它在前序类化后只剩共享记录字典与名称/location helper，本阶段将这些基础职责收进 `src/WorldEngine/domains/WorldStateModel.part.js`。

- `WorldRecordCatalog` 拥有 `RECORDS / DETAILS / MODEL_RECORDS / MODEL_DETAILS` 与 NPC 审计级别集合；模型视图继续剔除人物的承诺、待决事项、关系变化，保持原 WorldResult 语义。
- `WorldEntityIdentityPolicy` 拥有名称归一、稳定实体名匹配与地点包含关系。
- 原 `RECORDS / DETAILS / MODEL_* / NPC_AUDIT_LEVELS / nameKey / stableNameIn / worldLocationRelated` 名称保留为 src 内兼容 seam，现有领域类和外部测试无需绑定 legacy 文件。

构建器、自动构建 workflow、历史 patch 工具与架构/生命周期/校验测试不再读取或 fallback 到 10 号文件。至此 legacy 顶层只剩 foundation、runtime、UI、bootstrap 与共享样式；下一阶段转向 `40-engine-runtime.part.js`，按“配置/Application Shell → src service/controller，旧文件只删不长”的原则继续。


### Phase 47 · 40 / 50 大壳迁入 src

已完成：原 `40-engine-runtime.part.js` 与 `50-engine-ui.part.js` 实际是同一个 `SamsaraWorldEngine` class 被物理切成前后两段。本阶段不再维持这种依赖拼接顺序的 legacy 结构，而是零行为合并为完整的 `src/WorldEngine/core/SamsaraWorldEngine.part.js`，并从旧目录整文件删除 40 / 50。

新的 src shell 仍只承担 Application Facade / UI Shell：配置状态、兼容方法、面板生命周期、导航与交互分发。当前楼层/阻塞、世界书、API 传输、Prompt 文档、请求构造、运行循环、提交、编辑与业务页面仍分别委托既有 service/controller/view；本阶段没有把领域算法重新塞回大类。

构建器、CI 自同步、历史/replay/request-size 一次性 patch 工具和源码结构测试已统一读取 src shell。下一步继续从这个完整 class 中抽出配置初始化/迁移与 UI 事件分发，但旧 `script/world-engine-src` 不再恢复 40 / 50 占位文件。


### Phase 48 · 配置初始化与迁移服务化

已完成：新增 `WorldEngineConfigService`，把 `SamsaraWorldEngine` 构造函数中的配置默认值、localStorage 读取、旧 tone 清理、preset v2 归一化、旧“保存为默认设置”迁移、内置默认文档版本升级、重试 3→5 迁移、字号/历史正文开关规范化、专属 API 配置规范化与已启用状态下的终端 API 激活收口到独立 service。

`SamsaraWorldEngine` 构造函数现在只初始化 application runtime 状态并委托 `configService.initialize()`；`saveConfig()` 也委托同一 service。Service Container 通过 `configuration` 暴露 constructor-owned 实例，不重复创建第二份配置服务。

新增构造级回归 `tests/world-engine-config-service.cjs`，从公开 `new SamsaraWorldEngine(host)` seam 验证旧配置迁移结果，避免后续继续拆 shell 时改变既有用户配置语义。下一阶段继续从 src shell 中抽离 UI 事件分发/导航和纯展示 helper；领域逻辑仍禁止回流到 shell。


### Phase 49 · 面板交互路由 Controller 化

已完成：新增 `WorldPanelController`，把 `SamsaraWorldEngine.createPanel()` 中约 16.7KB 的面板创建、click/input/change 事件分发、Tab/日期/筛选/Prompt/API 设置交互整体迁出 application shell。Shell 的 `createPanel()` 现在只委托 container-owned `panelController`；ClassBridge 仍在公开 seam 之后挂载 EditorController、Feature Registry 与 Prompt Workspace，不改变扩展顺序。

迁移过程中补回历史版本原本存在、后来被 UI 重构误删的 Shadow DOM mount 初始化：`sam-world-engine-host → attachShadow({mode:'open'}) → style + panel`。这不是新 UI 方案，而是恢复项目既有的 Shadow DOM 隔离设计。

新增 `tests/world-engine-panel-controller.cjs`，从公开 `engine.createPanel()` seam 验证 mount/style/panel 实际挂载、三类事件路由存在以及 Tab 点击继续更新 engine 状态。架构回归同时禁止 click/input/change 路由重新长回 `SamsaraWorldEngine`，并把 src application shell 体积锁在 45KB 以下。

下一阶段继续迁出 `render()` 中的导航/展示编排；业务 View 已经独立，目标是让 shell 最终只保留 panel 生命周期和 application facade。


### Phase 50 · 面板渲染编排 Renderer 化

已完成：新增 `WorldPanelRenderer`，把 `SamsaraWorldEngine.render()` 中约 22.4KB 的快照准备、后台规范化、运行按钮状态、导航生成、公共 UI helper、日历/人物/事件展示上下文组装、View Registry 调度和事件跳转收尾整体迁出 application shell。业务 View class 本身不改，Renderer 只负责公共展示编排与把 context 交给既有 View。

`SamsaraWorldEngine.render(force)` 现在只委托 container-owned `panelRenderer`；ClassBridge 仍按原顺序执行 Feature Registry 的 before/afterRender、Prompt Workspace 同步以及 EditorController.afterRender。迁移后基础 shell 从约 38KB 降到约 15.7KB。

新增 `tests/world-engine-panel-renderer.cjs`，从公开 `engine.render()` seam 验证“总览”兼容别名、导航、运行按钮、主题/字号状态和业务 View 调度。架构回归逐项锁住 10 个业务 View 必须经 `WorldPanelRenderer → WorldEngineViewRegistry` 调度，并把 application shell 体积上限收紧到 20KB。

下一阶段继续审查 shell 剩余约 15KB：优先抽离 init/open/close/dispose 等 panel 生命周期与剩余 Prompt/API 兼容 facade，目标是 `SamsaraWorldEngine` 最终只保留 application lifecycle 与稳定公开 seam。


### Phase 51 · Application 生命周期 Controller 化

已完成：新增 `WorldEngineLifecycleController`，把 `SamsaraWorldEngine` 中的 MVU / Tavern 事件订阅、上下文切换处理、Escape 监听、面板 `open / close / toggle`、主神终端 `suspend / restore` 与 `dispose` 清理整体迁出 application shell。

`SamsaraWorldEngine.init / isOpen / open / close / toggle / dispose` 现在只保留稳定公开 facade seam，并委托 container-owned `applicationLifecycle`。因此 `WorldEngineClassBridge.init()` 的 Feature Registry `afterInit` 包装，以及 `dispose()` 前的 feature 清理顺序保持不变。

本阶段刻意不迁 `schedule / cancel`：它们属于运行调度/中断语义，并与 `WorldAutoProgressController`、`WorldRunOrchestrator` 有直接关系，不能为了缩文件把 application lifecycle 和推进调度重新耦合。迁移后基础 shell 约 13.4KB，架构测试把上限收紧到 14KB。


### Phase 52 · Prompt 设置与编辑职责归域

已完成：`SamsaraWorldEngine` 中剩余最大的 Prompt 实现块继续拆出。为避免重复造新类，本阶段沿用已有边界：

- `WorldPromptDocumentService` 新增 `setPreset / currentSettings / applySettings`，统一负责 Prompt 基础设置的长度校验、默认值、contextTurns / activationMode / selectedEntries 规范化与持久化。
- `WorldPromptWorkspaceController.readSettings()` 负责从「提示词预设」面板读取分段预设、专用 Prompt 字段、上下文楼层、激活模式和世界书勾选状态。
- `SamsaraWorldEngine.setPreset / readPromptEditor / applyPromptSettings` 只保留稳定公开 facade seam；`WorldEngineClassBridge` 继续在这些 seam 外层完成 Prompt Registry 的 prepare/apply 同步，因此全部实际提示词的可编辑行为不变。

迁移后 application shell 从约 13.4KB 降到约 9.4KB，架构上限收紧到 10KB，并禁止 Prompt DOM selector 与设置校验文案重新回流到 shell。


### Phase 53 · 引擎启用/可用性状态归入 Config Service

已完成：`isConfigured / isAvailable / isEnabled / setEnabled` 从 application shell 迁入现有 `WorldEngineConfigService`。配置服务现在不仅负责初始化/迁移/持久化，也负责“用户总开关 + 当前 API 可用性”的有效状态判定。

公开 `SamsaraWorldEngine` 同名方法只保留 facade seam。原行为保持：关闭时取消当前请求并关闭面板；重新开启普通终端 API 时调用 `terminal.enableApi()`；专属 API 的等待状态文案与最终 `isEnabled()` 返回值不变。

迁移后 shell 约 8.6KB，架构上限进一步收紧到 9KB。运行调度 `cancel / schedule` 仍未并入 Config Service，避免配置状态与请求生命周期混为一体。
