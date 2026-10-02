# 世界推进架构

本文只描述当前架构，不记录历史 Phase 或施工日志。

## 1. 所有权边界

世界推进直接维护：`世界.后台`、`世界.因果轨道`、`世界.势力`、`世界.探索`、世界历史与传播、世界推进运行配置和提示词配置。正式人物资料仍由状态栏/MVU 正式人物体系负责；世界推进只维护对应人物的场外活动与世界关系投影。

运行时持久状态仍以 MVU 为唯一事实来源。世界推进不建立第二份长期数据库；本地 `localStorage` 只保存世界推进自身的界面/API 配置、Prompt 文档与手动快照等客户端状态。

## 2. 运行结构

### Core / Application

- `WorldEngineServiceContainer`：唯一组合根，创建并共享领域 service / policy / controller。
- `SamsaraWorldEngine`：Application Facade，保留少量运行态与公开 API。
- `WorldEngineClassBridge`：唯一允许继承 `SamsaraWorldEngine` 的兼容桥，维持历史外部 seam 与 `super` 调用顺序。
- `WorldEngineLifecycleController`：面板与引擎生命周期。
- `WorldEngineFeatureRegistry`：横切 Feature 的统一挂载点。
- `WorldEngineConfigService`、`WorldHostAdapter`：配置和宿主能力适配。

### 请求与运行编排

- `WorldRuntimeContextService` 读取当前聊天、楼层、MVU 与基础阻塞状态。
- `WorldKnowledgeService` / `WorldKnowledgeSelectionPolicy` 负责世界书目录、激活、技术条目隔离与选择匹配。
- `WorldProseExtractor` 负责发送给世界模型的正文清洗。
- `WorldRequestBuilder` 构造基础请求；任务、原著时间轴、传闻、世界活动等通过 Feature Registry 装饰请求。
- `WorldApiTransportService` 负责专属 API / 主神终端传输、结构化模式降级和 usage。
- `WorldRunOrchestrator` 编排一次推进的请求、重试、编译、验收与提交。
- `WorldRequestService` / `WorldRetryGuidanceService` 负责可重试判断与纠错输入。

### WorldResult 管线

`WorldResultContract` 定义结构；`WorldResultNormalizer` 归一回复；`WorldResultReplyParser` 解析模型输出；`WorldResultStagingService` 进行分片验收；`WorldResultPatchCompilationService` 把结果编译为 patch；`WorldPatchApplicationService` 执行 patch 事务；`WorldStateMaterializationService` 完成最终状态 repair/物化；`WorldValidationService` 与相关 policy 做统一业务验收；`WorldCommitService` 负责最终单次 MVU 提交。

生产路径必须通过这些 container-owned service 组合，不重新在 Facade 或 Feature 中复制一套编译、写入、校验算法。

## 3. 主要领域

- 时间：`WorldTimePolicy`、`WorldTimelinePolicy`、`WorldChronologyFeature`。
- 因果：`WorldCausalService`。
- 事件与生命周期：`WorldEventService`、`WorldLifecycleService`。
- 人物活动：`WorldPersonActivityService`；正式人物字段同步由 `WorldRelationSyncPolicy` 限定。
- 探索与现场：`WorldExplorationService`。
- 传闻：`WorldRumorService` / `WorldRumorRequestFeature`。
- 资产：共享顶层 `资产`，写入规则由资产物化 policy 管理。
- 历史：`WorldHistoryService`、历史记忆 policy / lifecycle。
- 世界状态：Factory、Normalizer、Projector、Integrity/Patch policy 分别负责创建、迁移/repair、热上下文投影与持久状态约束。

## 4. Prompt 管线

`WorldPromptRegistry` 是静态 AI 指令的唯一注册表。system、user payload、辅助模型与纠错重试中的固定指令都必须登记，并通过 `WorldPromptIntegrationService` 装配。

JSON Schema、MVU 路径白名单、运行时实体名/计数/错误事实、时间和引用校验算法不是可编辑 Prompt。详细规则见 [`PROMPT-REGISTRY.md`](./PROMPT-REGISTRY.md)。

## 5. UI

`WorldPanelController` 管理面板交互，`WorldPanelRenderer` 负责共享渲染框架，`WorldEngineViewRegistry` 路由各业务 View。事件/人物/因果/历史编辑统一经 `WorldEditorController` 和对应领域 service 写回；提示词编辑由 `WorldPromptWorkspaceController` 管理。

业务页面只进入 `src/WorldEngine/ui/views/`；不要在 Application Shell 重新建立函数式 renderer 影子层。主题色值由 `WorldThemeCatalog` 单一维护。

## 6. 扩展约束

1. 新功能先确定领域 owner，再通过 Service Container 组合。
2. 不新增第二套状态、第二套 Prompt、第二套 Schema 或第二套 UI 业务实现。
3. `WorldEngineClassBridge` 之外不得新增 `extends SamsaraWorldEngine`。
4. 不通过运行时覆写核心 seam 注入行为；需要横切请求/生命周期时使用显式 Feature hook。
5. 兼容函数只能是转发 seam，不重新承载领域算法。
6. `script/世界推进系统.js` 始终由构建器生成，最终运行时仍保持单文件交付。

## 7. 相关文档

- [`README.md`](./README.md)：开发入口、构建、测试与长期规则。
- [`CHRONOLOGY.md`](./CHRONOLOGY.md)：原著剧情、权威时间轴与因果偏移约束。
- [`PROMPT-REGISTRY.md`](./PROMPT-REGISTRY.md)：静态 Prompt 的唯一来源规则。
- [`RC-CHECKLIST.md`](./RC-CHECKLIST.md)：发布候选验收清单。
