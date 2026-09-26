# 世界推进类化架构

## 对外兼容边界

外部入口保持不变：

```js
Samsara.worldEngine
Samsara.WorldEngine
```

`SamsaraWorldEngine` 仍是 Facade / Coordinator，但不再直接承载所有领域实现。

## 目标类

```text
SamsaraWorldEngine
├─ WorldEnginePromptService
├─ WorldEngineRequestTextService
├─ WorldEngineMutationService
├─ WorldEventService
├─ WorldPersonActivityService
├─ WorldHistoryMemoryService
└─ WorldEngineUI / 各业务视图 renderer
```

### WorldEnginePromptService

负责：
- 默认提示词注册表
- 配置归一化
- 预设保存/导入/导出时的提示词快照
- “提示词预设”页面展示全部可编辑提示词

不负责：
- JSON Schema
- MVU 校验
- 业务状态机

### WorldEngineRequestTextService

负责所有会进入 AI 请求、但不属于固定数据值的说明文字，例如：
- user payload 的“输入语义”
- 宏观骨架说明
- 到期事件复核说明
- 正文可见投影说明
- 重试指导文字
- 历史压缩 system / user 指令

### WorldEngineMutationService

统一进行世界推进手动编辑事务：
- 克隆当前 MVU
- 修改世界推进拥有的变量
- 更新同楼 replay
- 使用 `__samsaraUIMutation` 防止误触发自动推进
- 单次写回

### WorldEventService

只负责 `世界.后台.事件`：
- 读取
- 修改
- 重命名
- 删除
- 引用修复
- 因果图校验

### WorldPersonActivityService

只负责 `世界.后台.人物`。
即使同名角色存在于 `关系列表`，也不得修改正式人物资料。

## 迁移策略

采用兼容式类化，不做一次性重写：

1. 先建立领域类。
2. 原 `SamsaraWorldEngine` 同名公开方法改为委托领域类。
3. 回归测试继续通过 `SamsaraWorldEngine` 公开接口验证行为。
4. 确认稳定后，再逐步移除旧继承补丁和重复函数。
5. 最终 `SamsaraWorldEngine` 只保留生命周期、调度和各服务协调。

这样避免“重构同时改业务行为”造成难以定位的回归。
