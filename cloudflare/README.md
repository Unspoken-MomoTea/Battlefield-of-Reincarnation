# 轮回战场创意工坊后端

这是第一阶段 Worker 骨架。当前已实现：

- `GET /api/health`
- Discord OAuth 起始与回调
- 一次性登录交换码
- KV Session
- `GET /api/auth/me`
- `POST /api/auth/logout`
- D1 初始表结构（用户、项目、项目版本、审核记录）

## Cloudflare 资源

代码只依赖三个 binding：

- `DB`：D1，项目与用户元数据
- `SESSION_KV`：OAuth state、一次性登录结果、会话
- `PROJECTS`：R2，下一阶段用于项目包、世界书、正则和封面

`wrangler.jsonc` 中的 D1/KV ID 目前是占位值，等实际创建资源后替换。配置已经预留 production 与 `staging` 两套完全独立的 D1 / KV / R2。

## Discord

Discord Developer Portal 的 Redirect URL：

```text
https://workshop.6661816.xyz/api/auth/discord/callback
```

第一版只请求：

```text
identify
```

`DISCORD_CLIENT_ID` 是公开配置，填写进 `wrangler.jsonc` 即可。

`DISCORD_CLIENT_SECRET` 绝对不要提交 Git。部署前使用：

```bash
npx wrangler secret put DISCORD_CLIENT_SECRET
```

本地开发可复制一份不提交 Git 的 `.dev.vars`：

```text
DISCORD_CLIENT_SECRET=你的密钥
```

## 初始化 D1

创建数据库后，将真实 ID 写入 `wrangler.jsonc`，然后执行：

```bash
npx wrangler d1 execute reincarnation_workshop --remote --file=schema.sql
```

本地：

```bash
npx wrangler d1 execute reincarnation_workshop --local --file=schema.sql
npx wrangler dev
```

## 安全边界

- 浏览器只持有随机 Session Token。
- KV 只保存 Token 的 SHA-256，不保存明文 Session Token。
- Discord Client Secret 仅存在 Worker Secret。
- OAuth state 单次使用并在 10 分钟后过期。
- OAuth 登录结果只保留 2 分钟并且只能交换一次。
- 远程项目内容后续只作为数据包安装，不赋予任意 JavaScript 执行权限。

## 作品生命周期

第一版项目 API 已完成从草稿到审核发布的完整链路：

- `GET /api/projects`：公开作品列表，仅返回已有已审核版本的作品。
- `GET /api/projects/:id`：公开作品详情与 manifest。
- `GET /api/projects/:id/version`：查询当前公开版本。
- `GET /api/projects/:id/download`：从 R2 下载当前公开 bundle。
- `GET /api/my/projects`：作者自己的全部作品。
- `POST /api/projects`：创建草稿作品。
- `PATCH /api/projects/:id`：修改作品元数据。
- `POST /api/projects/:id/versions`：上传新版本到 R2。
- `POST /api/projects/:id/submit`：提交最新版本审核。
- `GET /api/admin/pending`：管理员待审核队列。
- `POST /api/admin/projects/:id/review`：批准或驳回最新版本。

已发布作品上传新版本后，旧的已审核版本仍保持公开，直到新版本审核通过才切换公开版本。

### bundle v1

服务器只接受数据型 artifact，不接受任意脚本：

```json
{
  "schema_version": 1,
  "artifacts": [
    {
      "kind": "worldbook",
      "name": "示例世界书",
      "format": "json",
      "content": { "entries": {} }
    }
  ]
}
```

允许的 `kind`：`worldbook`、`regex`、`preset`、`data`。`mixed` 是作品分类，不是 artifact 类型。单个 bundle 当前限制为 4 MB、最多 32 个 artifact。

## 审核预览

管理员可以在批准/驳回前读取待审核最新版本的 manifest 与 bundle：

- `GET /api/admin/projects/:id/review`：读取待审核内容。
- `POST /api/admin/projects/:id/review`：提交 `approved` / `rejected` 决定。

作者自己的作品列表会返回最新审核意见 `review_note`，用于显示驳回原因。


## Staging

测试环境已经预留为：

```text
Worker: reincarnation-workshop-staging
Base URL: https://workshop-test.6661816.xyz
D1: reincarnation_workshop_staging
R2: reincarnation-workshop-projects-staging
```

实际创建资源并替换占位 ID 后：

```bash
npx wrangler secret put DISCORD_CLIENT_SECRET --env staging
npx wrangler d1 execute reincarnation_workshop_staging --env staging --remote --file=schema.sql
npx wrangler deploy --env staging
```

生产环境仍使用不带 `--env` 的命令。Discord Developer Portal 需要同时登记 production 和 staging 两个 callback URL。
