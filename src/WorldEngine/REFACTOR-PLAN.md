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

## 下一批

仍需继续迁移的 legacy 继承功能主要是：

- 自动推进 / 变量重处理触发；
- replay 恢复；
- 时间所有权与时间轴保护；
- 传闻请求管线；
- NPC 审计开关；
- API 预设状态；
- 因果概览 UI。

这些后续都应变成独立 service/controller，并由单一 ClassBridge 调用；不得新增新的业务继承链。