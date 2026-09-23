# 创意工坊发布通道

创意工坊使用两条完全独立的更新通道。

| 环境 | API | Worker env | 客户端更新 ref | 数据资源 |
| --- | --- | --- | --- | --- |
| 测试 | `https://workshop-test.6661816.xyz` | `staging` | `main` | staging D1 / KV / R2 |
| 正式 | `https://workshop.6661816.xyz` | `production` | `workshop-stable` | production D1 / KV / R2 |

## 日常开发

所有普通开发提交进入 `main`。

测试版客户端会从 staging Worker 的 `/api/client/latest` 获取：

```text
channel = testing
ref = main
```

因此 main 上的新提交只会向测试版提示更新，不会推动正式版。

安全的默认部署命令也是 staging：

```powershell
cd cloudflare
npm run deploy
```

等价于：

```powershell
npm run deploy:staging
```

## 发布正式客户端

正式客户端只跟踪 `workshop-stable`。不要直接让 production 跟踪 `main`。

GitHub Actions 中运行：

```text
creative-workshop-promote-stable
```

工作流默认发布触发时的 main 提交，也可以填写一个已经位于 main 上的目标 SHA。工作流会：

1. 确认目标提交属于 main。
2. 确认相对当前 `workshop-stable` 只能 fast-forward，不允许倒退或改写正式历史。
3. 重新运行 Worker contract tests、Worker syntax、Client contract tests、Client syntax。
4. 全部通过后才把 `workshop-stable` 移到目标 SHA。

只有这一步完成后，正式版客户端才会发现新版本。

## 发布正式 Worker / 数据库

正式 Worker 和数据库命令有额外保护：

```powershell
cd cloudflare
npm run db:migrate:production
npm run deploy:production
```

两条命令都会拒绝以下情况：

- `env.production` 仍有 D1 / KV / Discord 占位配置。
- 当前本地 HEAD 不等于远端 `workshop-stable`。
- 非交互终端。
- 操作者没有手动输入完整的 `PRODUCTION`。

因此日常位于 main 时，即使误敲正式部署命令，也不会把测试代码部署到正式 Worker。

## 推荐正式发布顺序

当一次版本同时包含 Worker / migration / 客户端变更时：

1. 在 staging 跑 migration（如有）并部署 staging Worker。
2. 用测试版完整验证上传、审核、安装、更新、卸载与恢复。
3. 运行 `creative-workshop-promote-stable`，把确认过的 SHA 提升为 stable。
4. 本地切换到该 `workshop-stable` 提交。
5. 对 production 先执行 migration（如有），再部署 production Worker。
6. 正式客户端随后只会收到 stable SHA。

若只改客户端 UI，可以省略 production Worker / D1 步骤，只提升 stable。

## Loader 约定

测试 Loader：

```js
window.ReincarnationWorkshopConfig = {
  apiBase: 'https://workshop-test.6661816.xyz',
};
```

它会自动识别为 `testing / main`。

正式 Loader：

```js
window.ReincarnationWorkshopConfig = {
  apiBase: 'https://workshop.6661816.xyz',
};
```

它会自动识别为 `stable / workshop-stable`。

也可以显式指定：

```js
window.ReincarnationWorkshopConfig = {
  apiBase: 'https://workshop-test.6661816.xyz',
  updateChannel: 'testing',
  updateRef: 'main',
};
```

正式环境不建议覆盖 `updateChannel` / `updateRef`，避免人为绕过 stable 通道。
