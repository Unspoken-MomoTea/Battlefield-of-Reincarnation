# 世界推进重构计划

## 已完成

- UI 样式与主要业务页从巨型 UI 文件拆分。
- 事件与世界人物手动编辑能力。
- 世界推进变量手动修正的 replay 安全写回。
- 开始建立类化服务组合与 Prompt Registry。

## 当前阶段：全面类化

1. 用 `WorldEngineServiceContainer` 组合服务。
2. 编辑器从继承补丁迁移到独立 controller/service class。
3. UI 业务域通过 view class/registry 路由。
4. Prompt 统一由 `WorldPromptRegistry` 管理。
5. 逐步清理遗留 `59-*.part.js` 中纯粹为了覆写主类的继承链。

## 下一阶段

- EventService / PersonService / ExplorationService / HistoryService 分离模型逻辑与 UI。
- Runtime 请求编排拆成 RequestService。
- WorldResult 编译与校验拆成 Compiler/Validator 类。
- 世界状态读取、投影与迁移拆成 Repository/Projector 类。
- 删除已经没有兼容价值的历史 patch 脚本。

## 验收

每次迁移必须满足：

- 原有外部 API 不破坏。
- 世界推进单文件交付不变。
- MVU 写入范围不扩大。
- 现有回归全绿。
- 新模块有清晰 public seam，不测试私有实现细节。
