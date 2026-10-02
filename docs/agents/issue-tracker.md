# Issue tracker: GitHub

任务和规格记录在 `Unspoken-MomoTea/Battlefield-of-Reincarnation` 的 GitHub Issues。

## 操作约定

优先使用可用的 GitHub 连接器；在本地仓库使用 CLI 时，显式指定 `--repo Unspoken-MomoTea/Battlefield-of-Reincarnation`。

- 创建：`gh issue create --repo Unspoken-MomoTea/Battlefield-of-Reincarnation --title "标题" --body-file /path/to/body.md`。
- 读取：`gh issue view <number> --repo Unspoken-MomoTea/Battlefield-of-Reincarnation --comments`。
- 列表：`gh issue list --repo Unspoken-MomoTea/Battlefield-of-Reincarnation --state open --json number,title,body,labels`。
- 评论：`gh issue comment <number> --repo Unspoken-MomoTea/Battlefield-of-Reincarnation --body-file /path/to/comment.md`。
- 标签：`gh issue edit <number> --repo Unspoken-MomoTea/Battlefield-of-Reincarnation --add-label "标签"` 或 `--remove-label "标签"`。
- 关闭：`gh issue close <number> --repo Unspoken-MomoTea/Battlefield-of-Reincarnation`。

多行正文通过结构化工具参数或 UTF-8 正文文件传递，保留真实换行。

## Skill 操作含义

- “publish to the issue tracker”：在本仓库创建 GitHub Issue。
- “fetch the relevant ticket”：读取对应 Issue 的正文、标签和相关评论。
- 依照当前用户任务的授权范围操作；单纯讨论或阅读不自动触发发布、评论或关闭。

`triage` 当前未安装，因此不初始化完整分流标签体系。`to-spec` 明确调用时按其流程使用 `ready-for-agent` 标签；发布前检查标签是否存在，必要时在该任务的授权范围内创建。

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub Issues 与 PR 共用编号。遇到裸编号 `#42`，先确认其类型，避免将 PR 当作 Issue。
