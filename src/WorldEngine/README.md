# WorldEngine

`src/WorldEngine/` 是世界推进的长期开发源码与架构文档目录。

运行时仍由 `tools/build-world-engine.py` 生成单文件 `script/世界推进系统.js`，酒馆安装方式不变。旧的 `script/world-engine-src/` 在迁移期间作为 legacy source 保留；新代码优先进入这里，并通过构建器按固定顺序拼接。

## 目标

- `SamsaraWorldEngine` 最终只负责生命周期与模块编排，不再继续承载事件、人物、提示词等业务实现。
- 每个业务域通过独立 class 暴露稳定接口。
- 所有实际发送给 AI 的 system 提示词必须登记在 `WorldPromptRegistry`，并在“提示词预设”页面可见、可编辑、可保存到预设文档。
- UI、领域逻辑、MVU 写回、提示词配置分离。
- 迁移期间保持单文件交付和现有存档兼容。

## 当前类

- `WorldEngineServiceContainer`：服务组合根。
- `WorldRuntimeContextService`：当前楼层/MVU/chat 指纹读取与基础阻塞判断。\n- `WorldKnowledgeService`：角色/聊天/全局世界书目录与蓝绿灯读取。\n- `WorldRequestBuilder`：主推进的基础请求构造；Feature Registry 与 Prompt Registry 在其后继续装饰。\n- `WorldStateProjector`：世界状态 → 世界推进热上下文的唯一投影入口。
- `WorldResultCompiler`：WorldResult 标准化、分片验收、补丁编译与 materialize 入口。
- `WorldValidationService`：编译后统一执行到期事件、时间锚点、超期事件、时间异常、异端、NPC 审计与宏观骨架验收。
- `WorldCommitService`：稳定值重算、最近变化、历史/replay 提交装饰、Schema 二次确认与单次 MVU 写入。
- `WorldMutationService`：世界推进变量的原子写回与 replay 合并入口。
- `WorldEventService`：事件修正、重命名、删除。
- `WorldPersonActivityService`：只管理 `世界.后台.人物` 活动记录。
- `WorldHistoryService`：历史记忆读取、压缩入口与手动修正。
- `WorldCausalService`：因果偏移编辑、删除与稳定值重算。
- `WorldExplorationService` / `WorldRumorService` / `WorldRequestService`：探索、传播与请求领域入口。
- `WorldEngineViewRegistry`：业务视图注册。
- `WorldEditorController`：事件、世界人物、因果偏移、历史记忆的统一编辑控制器。
- `WorldPromptWorkspaceController`：提示词预设 UI 控制器。
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

详细迁移边界见 `ARCHITECTURE.md` 与 `REFACTOR-PLAN.md`；提示词清单规则见 `PROMPT-REGISTRY.md`。
