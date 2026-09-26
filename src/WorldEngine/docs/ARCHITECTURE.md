# 世界推进类化架构

> 这是世界推进后续开发的架构基准。运行时仍只交付 `script/世界推进系统.js`；开发源码继续由 `tools/build-world-engine.py` 拼接。

## 目标

世界推进不再通过“一个巨型类 + 多层继承补丁”承载全部职责。主类 `SamsaraWorldEngine` 只负责编排、生命周期和一次推进事务；业务能力由独立类组合。

## 组合根

`WorldEngineServiceContainer` 是唯一服务组合根：

- `WorldEngineViewRegistry`：页面/业务视图路由。
- `WorldMutationService`：世界推进变量的手动修正事务、MVU 单次写回、same-floor replay 合并。
- `WorldEventEditor`：事件编辑、重命名、删除、引用修复与编辑 UI。
- `WorldPersonEditor`：只编辑 `世界.后台.人物` 活动记录；正式人物资料仍由状态栏维护。
- `WorldPromptRegistry`：所有实际发送给 AI 的可编辑提示词注册表。

主类允许保留兼容 facade（例如 `setWorldEventRecord`），但 facade 只能委托服务，不再复制业务实现。

## UI 类

业务页通过 `WorldEngineViewRegistry` 管理。每个业务域对应独立 view class；主 UI 文件只保留 shell、导航、共享小工具和事件分发。

## 禁止事项

- 不再新增 `SamsaraWorldEngine=class ... extends ...` 的多层业务补丁作为默认扩展方式。
- 不在视图类直接写 MVU。
- 不从世界推进修改正式人物档案。
- 不把新的 AI 指令字符串直接散落进业务文件而不登记到 Prompt Registry。
- 不把 Prompt、Schema、CSS 塞进构建脚本。

## 迁移策略

采用纵向切片：先建立公共接口与测试，再搬一个业务域；每一步保持 `script/世界推进系统.js` 的外部安装方式不变。