# 轮回战场：Agent 工作指引

## Agent skills

根据当前任务，优先读取并遵循 `.agents/skills/` 中适用的已安装 Skill；不强制套用无关流程，不假定未安装的 Skill 已存在。用户的明确要求优先于 Skill 的默认流程。

### 已安装 Skill

| Skill | 适用任务 |
| --- | --- |
| `setup-matt-pocock-skills` | 项目工程流程初始化或重新配置 |
| `grill-me`、`grilling` | 澄清计划、需求和设计 |
| `grill-with-docs` | 设计讨论，并同步领域术语和决策 |
| `domain-modeling` | 维护领域术语及架构决策 |
| `codebase-design` | 模块接口、职责和可测试性设计 |
| `to-spec` | 将已讨论的需求整理为规格并发布到任务管理系统 |
| `diagnosing-bugs` | 建立复现与验证闭环，排查错误 |
| `tdd` | 适用开发任务的红—绿—重构循环 |
| `code-review` | 按项目标准及需求规格审查改动 |

带有 `disable-model-invocation: true` 的 Skill 由用户明确调用；仅安装这些入口，不代表每项任务都必须执行它们。

### Issue tracker

任务和规格使用本仓库的 GitHub Issues。操作约定见 [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md)。

### Domain docs

采用仓库级单一文档入口；术语使用 `GLOSSARY.md`，项目背景可使用 `CONTEXT.md`，架构决策使用 `docs/adr/`。读取及按需创建规则见 [docs/agents/domain.md](docs/agents/domain.md)。
