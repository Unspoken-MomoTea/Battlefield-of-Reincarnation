# 世界推进提示词注册表

## 原则

凡是**实际会作为 system 或 user 请求中的指令性文字发送给 AI**，都必须满足：

1. 在统一提示词注册表中有稳定 key。
2. “提示词预设”页面可见。
3. 开启编辑模式后可修改。
4. 保存预设、个人默认、导入和导出时完整保留。
5. 请求检查页能够看到最终实际发送内容。

程序字段 Schema、枚举值、路径、验证器、重放协议不属于提示词，不提供任意编辑。

## 分类

### 主 system

- mainPreset
- core
- macro
- stability
- npcAudit
- worldResultProtocol

### 运行模块 system

- task
- chronology
- maintenance
- exploration
- integrity
- worldTime
- rumor

### user 请求说明

- inputSemantic.worldbook
- inputSemantic.currentState
- inputSemantic.prose
- inputSemantic.structuralFix
- inputSemantic.timeline
- inputSemantic.worldResult
- inputSemantic.personAudit
- inputSemantic.taskList
- macro.planning
- macro.acceptance
- dueEvent.review
- stage.knowledgePriority
- proseProjection.requirement
- request.finalNote
- worldTime.initialization
- rumor.sourceBoundary
- worldActivity.requirement

### 二次请求 / 重试

- history.system
- history.inputInstruction
- retry.header
- retry.keepAccepted
- retry.fixOnlyRejected

## 不应隐藏的文字

以后新增 AI 指令时，不允许直接在 `buildRequest()`、重试函数或领域补丁中写长字符串。必须先注册，再由服务按 key 读取。
