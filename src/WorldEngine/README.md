# WorldEngine

`src/WorldEngine/` 是世界推进的唯一开发源码与架构文档目录。

运行时仍由 `tools/build-world-engine.py` 按固定顺序拼接这里的 `.part.js`，生成单文件 `script/世界推进系统.js`；酒馆安装方式不变。`script/world-engine-src/` 已在 Phase 56 删除，禁止重新建立第二套源码树。

## 目标

- `SamsaraWorldEngine` 最终只负责生命周期与模块编排，不再继续承载事件、人物、提示词等业务实现。
- `WorldStateModel` 提供共享记录目录与实体身份匹配基础策略；旧 `10-world-state.part.js` 已删除。
- `src/WorldEngine/core/SamsaraWorldEngine.part.js` 是完整 Application/UI Shell；旧 `40-engine-runtime.part.js` / `50-engine-ui.part.js` 已删除，领域算法与业务页面不得回流到 shell。
- 每个业务域通过独立 class 暴露稳定接口。
- 所有实际发送给 AI 的 system 提示词必须登记在 `WorldPromptRegistry`，并在“提示词预设”页面可见、可编辑、可保存到预设文档。
- UI、领域逻辑、MVU 写回、提示词配置分离。
- 保持单文件交付和现有存档兼容；生成文件不作为第二份手工源码维护。

## 当前类

- `WorldEngineServiceContainer`：服务组合根。
- `WorldRuntimeContextService`：当前楼层/MVU/chat 指纹读取与基础阻塞判断。\n- `WorldKnowledgeService`：角色/聊天/全局世界书目录与蓝绿灯读取。\n- `WorldRequestBuilder`：主推进的基础请求构造；Feature Registry 与 Prompt Registry 在其后继续装饰。\n- `WorldApiTransportService`：专属 API/主神终端传输、结构化降级、模型目录与 API 预设。\n- `WorldPromptDocumentService`：提示词文档保存、导入、导出与删除。\n- `WorldRunOrchestrator`：一次世界推进的请求→重试→编译→验收→提交 Application Flow；统一处理请求错误、空回、局部业务失败、按模型重试与 fallback 切换。\n- `WorldStateProjector`：世界状态 → 世界推进热上下文的唯一投影入口。
- `WorldTimelinePolicy`：事件时间锚点、时间线显示/排序、陈旧活动检测与未来时间异常规则。
- `WorldTimePolicy`：世界时间候选解析、日历兼容、禁止回退、编译事务快照与最终时间 patch。
- `WorldLifecycleService`：冷结束事件归档、事件软引用解绑与传播过期判定。
- `WorldResultCompiler`：WorldResult 标准化、分片验收、补丁编译与 materialize 入口。
- `WorldRetryGuidanceService`：业务失败 → 纠错补充清单；所有静态纠错动作模板从 Prompt Registry 读取。
- `WorldValidationService`：编译后统一执行到期事件、时间锚点、超期事件、时间异常、异端、NPC 审计与宏观骨架验收。
- `WorldCommitService`：稳定值重算、最近变化、历史/replay 提交装饰、Schema 二次确认与单次 MVU 写入。
- `WorldMutationService`：世界推进变量的原子写回与 replay 合并入口。
- `WorldSnapshotService`：当前聊天的手动世界快照保存/恢复；只回滚世界侧状态，不回滚玩家角色与任务系统。
- `WorldEventService`：事件修正、重命名、删除。
- `WorldPersonActivityService`：只管理 `世界.后台.人物` 活动记录。
- `WorldHistoryService`：历史记忆读取、压缩入口与手动修正。
- `WorldCausalService`：因果偏移编辑、删除与稳定值重算。
- `WorldExplorationService`：探索快照、整体地标粒度校验、当前地点最低探索投影与旧版子区域合并；`WorldRumorService` / `WorldRequestService`：传播与请求领域入口。
- `WorldEngineViewRegistry`：业务视图注册。
- `WorldEditorController`：事件、世界人物、因果偏移、历史记忆的统一编辑控制器。
- `WorldPromptWorkspaceController`：提示词预设 UI 控制器。
- `WorldBasePromptDefaults`：默认预设、核心约束、内置默认 Prompt 文档与基础预设编辑 helper 的物理源码归属。
- `WorldPromptRegistry`：system、user payload、辅助模型与重试静态指令的唯一注册表。
- `WorldEngineFeatureRegistry`：统一挂载不值得继续继承主类的 feature/controller 生命周期。
- `WorldApiPresetController`：专属 API 预设选择态。
- `WorldCausalOverviewController`：因果摘要/因果档案 UI。
- `WorldNpcAuditPromptFeature`：NPC 审计默认提示词迁移。
- `WorldRequestFeature`：所有请求装饰 feature 的公共 seam。
- `WorldSoftMaintenanceFeature`：软维护验收 payload/manifest。
- `WorldIntegrityRequestFeature`：因果与时间约束 manifest。
- `WorldActivityRequestFeature`：世界活动交付 payload/timeline/manifest。
- `WorldDueEventFeature`：到期事件软复核清单。
- `WorldTaskAwarenessFeature`：任务只读投影与任务世界书选择恢复。
- `WorldChronologyFeature`：原著/数据库时间线资料读取与时间线基准请求装饰。
- `WorldRumorRequestFeature`：传闻维护 payload、世界侧取材边界、运行时复核与传闻 UI 收口。

## 后续开发硬规则

- `src/WorldEngine/` 是唯一源码树；禁止恢复 `script/world-engine-src/` 或直接手改生成文件承载业务实现。
- `WorldEngineClassBridge` 是唯一允许的 `extends SamsaraWorldEngine` 兼容层；新功能必须进入 service / policy / controller / feature / view，不得新增主类继承补丁。
- 禁止通过重新赋值 `compileWorldResult / retryPlanForFailure / projectWorldContext / applyPatches / validateState / materializeWorldUpdate` 追加行为；需要扩展时显式组合对应领域服务。
- 纯常量放 vocabulary/catalog/constants，纯工具放 utilities；不要为了“类化”机械创建空 class，也不要仅因为文件较大就拆散职责完整的领域类。
- 所有实际发送给 AI 的静态指令继续必须登记 `WorldPromptRegistry` 并通过提示词源码审计；程序 Schema、白名单和校验规则保持不可编辑。
- 每次迁移保持公开 seam 与单文件交付兼容，先用现有回归锁行为，再移动实现。

详细迁移边界见 `ARCHITECTURE.md` 与 `REFACTOR-PLAN.md`；提示词清单规则见 `PROMPT-REGISTRY.md`。
