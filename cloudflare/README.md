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

`wrangler.jsonc` 中 staging 与 production 故意绑定同一套 D1 / KV / R2，以节省 Cloudflare 容量。现有共享资源沿用早期 staging 名称；不要为了命名整洁再复制一套数据。Worker、域名与客户端更新通道仍保持独立。

## Discord

Discord Developer Portal 需要同时登记两个 Redirect URL：

```text
https://workshop-test.6661816.xyz/api/auth/discord/callback
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

## D1 migration

从现在开始数据库结构使用 `cloudflare/migrations/` 作为正式升级历史，`schema.sql` 只保留“当前完整基线”用于阅读和全新环境核对。不要在已经有数据的 production 上反复执行完整 schema 来代替 migration。

当前 migration：

```text
0001_initial.sql
0002_admin_audit.sql
...
0008_project_type.sql
```

执行：

```bash
npm run db:migrate:local
npm run db:migrate:staging
```

远程只有这一份共享 D1；`db:migrate:staging` 会直接迁移测试服与正式服共同使用的数据。production Worker 部署时再次执行 migration 只会检查同一份迁移记录，通常为 no-op。

## 初始化 D1

当前远程共享数据库沿用早期测试环境名称 `reincarnation_workshop_staging`，不要再创建第二份 production 数据库。全新初始化时才执行完整 schema；已有数据只走 migration。

本地：

```bash
npx wrangler d1 execute reincarnation_workshop_staging --local --file=schema.sql
npx wrangler dev
```

## 安全边界

- 浏览器只持有随机 Session Token。
- KV 只保存 Token 的 SHA-256，不保存明文 Session Token。
- Discord Client Secret 仅存在 Worker Secret。
- OAuth state 单次使用并在 10 分钟后过期。
- OAuth 登录结果只保留 2 分钟并且只能交换一次。
- 远程项目内容在浏览、下载和审核阶段只作为数据处理；Worker 不执行上传的 JavaScript。

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
- `GET /api/admin/projects`：管理员作品管理列表，可按审核状态、类型和关键词筛选全部已上传作品。
- `POST /api/admin/projects/:id/review`：批准或驳回最新版本。

已发布作品上传新版本后，旧的已审核版本仍保持公开，直到新版本审核通过才切换公开版本。

### bundle v1

服务器对 artifact 做结构校验；脚本在服务端只作为文本/JSON 数据保存与审核，不会在 Worker 中执行：

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

允许的 `kind`：`worldbook`、`regex`、`script`、`preset`、`data`。顶层作品类型只有 `character` 与 `extension`，与 artifact 类型彼此独立。单个 bundle 当前限制为 4 MB、最多 32 个 artifact。

## 审核预览

管理员可以在批准/驳回前读取待审核最新版本的 manifest 与 bundle：

- `GET /api/admin/projects/:id/review`：读取作品最新上传内容、版本历史与审核历史；已通过/已拒绝作品也可查看。
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

production 与 staging 共用上面的 D1 / KV / R2；Discord Developer Portal 仍需要同时登记 production 和 staging 两个 callback URL。因为 D1 共用，测试服 migration 必须保持对当前 stable Worker 的向后兼容。


## 管理员发布后管理

管理员除了审核之外，还可以：

- `POST /api/admin/projects/:id/state`：`archive` 下架或 `restore` 恢复。
- `GET /api/admin/logs`：读取统一管理员操作日志。
- 审核通过、审核拒绝、下架、恢复都会写入 `admin_audit_logs`。
- 驳回审核必须填写原因。

下架不会删除 R2 文件或审核记录；恢复时根据最新版本审核状态恢复到 `published / pending / rejected / draft`。
