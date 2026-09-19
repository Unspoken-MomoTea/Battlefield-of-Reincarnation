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

`wrangler.jsonc` 中的 D1/KV ID 目前是占位值，等实际创建资源后替换。

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
