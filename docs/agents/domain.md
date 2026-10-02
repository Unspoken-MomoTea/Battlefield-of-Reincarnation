# Domain Docs

本仓库采用 single-context：领域文档位于仓库根目录，架构决策位于 `docs/adr/`。

## 探索相关代码前

- 若存在 `GLOSSARY.md`，读取与当前任务相关的术语定义；当前安装的 `domain-modeling` 以此作为术语表。
- 若存在 `CONTEXT.md`，读取项目背景及相关约束。初始化 Skill 的旧模板使用这个名称；它不能替代当前 `domain-modeling` 使用的 `GLOSSARY.md`。
- 若存在 `docs/adr/`，读取与当前改动相关的架构决策。
- 同时读取 `docs/` 中与当前任务相关的现有设计和审计文档。

缺少术语表、背景文档或 ADR 目录时，继续工作，不把缺失视为错误，不提前创建空文件。若未来引入 `GLOSSARY-MAP.md` 或 `CONTEXT-MAP.md`，先按地图定位相关上下文，并更新本配置。

## 按需创建

- 术语得到明确确认后，由 `domain-modeling` 按其 `GLOSSARY-FORMAT.md` 创建或更新 `GLOSSARY.md`。
- 术语表只记录领域语言，不混入实现细节、需求规格或临时笔记。
- 仅在决策难以撤销、缺少背景会令人困惑、且确有取舍时，按 `ADR-FORMAT.md` 在 `docs/adr/` 创建 ADR。
- 项目背景与约束需要独立记录时，再创建或更新 `CONTEXT.md`。

## 使用与冲突处理

输出中的领域概念沿用现有术语表。需求描述与代码或现有文档不一致时，明确指出差异，不自行修改规则定义。若方案与现有 ADR 冲突，指出对应决策及需要重新讨论的原因。
