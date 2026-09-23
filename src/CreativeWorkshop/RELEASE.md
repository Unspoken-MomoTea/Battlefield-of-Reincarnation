# 创意工坊发布与服务器更新

创意工坊把测试代码与正式代码通道分开，但 staging / production 共用同一套 Cloudflare 数据资源。

| 环境 | API | Worker env | 客户端更新 ref | 数据资源 |
| --- | --- | --- | --- | --- |
| 测试 | `https://workshop-test.6661816.xyz` | `staging` | `main` | 与正式服共用 D1 / KV / R2 |
| 正式 | `https://workshop.6661816.xyz` | `production` | `workshop-stable` | 与测试服共用 D1 / KV / R2 |

正式版本还会创建不可覆盖的 Git Tag：

```text
workshop-vX.Y.Z
```

例如客户端 `WORKSHOP_VERSION = 1.12.2` 的正式发布 Tag 必须是：

```text
workshop-v1.12.2
```

## Windows 双击发布工具

Windows 用户首选仓库根目录：

```text
创意工坊更新工具.bat
```

直接双击，不需要先打开 PowerShell，也不需要输入 `cd` 或 `npm run ...`。

菜单提供：

```text
1. 更新测试服
2. 发布正式客户端（自动推进 workshop-stable + 创建 workshop-vX.Y.Z）
3. 更新正式服务器
4. 依次更新测试服 + 正式服务器
5. 只检查测试服
6. 只检查正式服务器
7. 两个服务器环境都只检查
8. 预演正式客户端发布
9. 查看 main / workshop-stable / 正式 Tag
0. 退出
```

正式客户端发布会自动读取远端 `origin/main` 中的 `WORKSHOP_VERSION`，自动决定 Tag 名，不要求手工填写版本号。例如当前版本为 `1.12.2` 时，工具会准备：

```text
workshop-stable
workshop-v1.12.2
```

确认发布后，它会在临时 worktree 重新运行 Worker tests、Client tests 和 JS/MJS syntax，再使用原子 push 同时推进 stable 与 Tag。

GitHub Actions 的 `creative-workshop-promote-stable` 仍保留，作为网页端的第二条正式发布入口。

## 日常开发与测试服

普通开发只提交到 `main`。测试客户端只跟踪 `main`，因此 main 上的新提交不会直接进入正式客户端。

本地拉取代码后，可以使用：

```powershell
cd C:\Users\MLT\Desktop\新版\角色卡\轮回战场
git pull

cd cloudflare
npm run update:staging
```

`update:staging` 不会再主动 `git fetch`。它直接读取本地已经同步好的 `origin/main`（若没有则回退本地 `main`），再在临时 worktree 中执行：

```text
校验 staging 配置
→ npm ci
→ Worker tests
→ Client tests
→ JS/MJS syntax
→ wrangler deploy --dry-run
→ shared D1 migrations（仅允许向后兼容）
→ staging Worker deploy
→ /api/health 检查 testing / main
```

它不会自动提交本地修改，也不会推进 `workshop-stable`。因此推荐先在仓库里正常 `git pull`，确认本地已经是你要部署的版本，再双击 BAT。即使随后 GitHub 临时不可达，只要本地引用已经同步且 Cloudflare / npm 网络可用，服务器更新本身仍可继续。

原来的低级命令仍然可以单独使用：

```powershell
npm run db:migrate:staging
npm run deploy:staging
```

其中 `npm run deploy` 仍等价于 `npm run deploy:staging`，默认不会碰正式服。

## 一键更新入口

服务器更新菜单不会主动访问 GitHub 做 `fetch`。它假定你已经先完成本地 `git pull`。注意：正式客户端发布（推进 `workshop-stable` + 创建 Tag）本身必须向 GitHub `push`，因此该步骤仍然需要 GitHub 可访问。

直接运行：

```powershell
cd cloudflare
npm run update
```

会出现选择菜单：

```text
1. 更新测试服（main）
2. 更新正式服（workshop-stable）
3. 依次更新两服
0. 退出
```

也可以直接指定：

```powershell
npm run update:staging
npm run update:production
npm run update:both
```

Windows 下还可以运行：

```text
src/CreativeWorkshop/update-servers.cmd
```

正式环境操作会要求输入完整的 `PRODUCTION`。

只想检查而不联网、不迁移、不部署时：

```powershell
node scripts/update-servers.mjs staging --dry-run
node scripts/update-servers.mjs production --dry-run
node scripts/update-servers.mjs both --dry-run
```

## 发布正式客户端版本

正式客户端从不跟踪 `main`，只跟踪 `workshop-stable`。

Windows 本地首选直接双击根目录 `创意工坊更新工具.bat` 并选择“发布正式客户端”。如果希望从网页发布，也可以在 GitHub Actions 中手动运行：

```text
creative-workshop-promote-stable
```

必须填写：

```text
release_version
```

例如：

```text
1.12.2
```

可选填写：

```text
target_sha
```

留空时使用触发工作流时选中的提交。

工作流会严格执行：

1. 拉取 `main`、`workshop-stable` 与全部 tags。
2. 确认目标 SHA 位于 `main` 历史中。
3. 确认 `workshop-stable → target SHA` 只能 fast-forward。
4. 检出目标 SHA。
5. 读取该提交的 `src/CreativeWorkshop/app/workshop-app.js`。
6. 要求输入版本与 `WORKSHOP_VERSION` 完全一致。
7. 生成 Tag 名 `workshop-vX.Y.Z`。
8. 如果该 Tag 已存在，直接拒绝，正式 Tag 不允许覆盖。
9. 重新执行 Worker tests / syntax 与 Client tests / syntax。
10. 创建 annotated Git Tag。
11. 使用 `git push --atomic` 同时推进 `workshop-stable` 与 Tag。

因此一次成功的正式发布必须满足：

```text
WORKSHOP_VERSION = X.Y.Z
workshop-stable  = 正式目标提交
workshop-vX.Y.Z  = 同一个正式目标提交
```

其中 Tag 是永久版本锚点，`workshop-stable` 是正式客户端当前更新指针。

## 为什么正式版不会被测试提交影响

测试 Worker 返回：

```text
channel = testing
ref     = main
```

正式 Worker 返回：

```text
channel = stable
ref     = workshop-stable
```

客户端即使遇到 Worker latest KV 的短时缓存，也只会核对自己通道对应的 Git ref：

- 测试版只核对 `main`
- 正式版只核对 `workshop-stable`

正式版不会因为 main 上的新测试提交出现更新提示。

## Cloudflare 共享数据环境

受 Cloudflare 容量约束，测试服与正式服故意共用同一套数据资源：

```text
shared D1
shared SESSION_KV
shared PROJECTS R2
├─ staging Worker   / workshop-test.6661816.xyz / testing / main
└─ production Worker / workshop.6661816.xyz     / stable / workshop-stable
```

现有共享资源沿用早期 staging 名称，不为了改名复制数据或新建第二套资源。

发布策略会检查：

- staging / production Worker 名称必须不同
- staging / production API 地址必须不同
- D1 必须绑定同一个 database_id
- KV 必须绑定同一个 namespace id
- R2 必须绑定同一个 bucket
- staging 必须是 `testing / main`
- production 必须是 `stable / workshop-stable`
- API 必须使用 HTTPS

因为数据库共享，测试版 migration 会直接作用于正式数据。main 上的 migration 在 stable 跟进前必须保持向后兼容；禁止提前删除、重命名旧字段或做破坏性数据重写。

## 推荐正式上线顺序

如果本次版本同时包含客户端、Worker 和 migration：

1. 将开发提交推到 `main`。
2. 执行 `npm run update:staging`。
3. 在测试版完整验证登录、上传、审核、下载、安装、更新、停用、卸载、原资源恢复和多 Mod 共存。
4. 在 GitHub Actions 执行 `creative-workshop-promote-stable`，输入与 `WORKSHOP_VERSION` 相同的正式版本号。
5. 确认产生新的 `workshop-vX.Y.Z` Tag，且 `workshop-stable` 已推进。
6. 执行 `npm run update:production`。
7. 脚本会从本地已同步的 `origin/workshop-stable`（或本地 `workshop-stable`）建立临时 worktree，再跑测试、共享 D1 migration（通常已由 staging 应用）、正式 Worker deploy 和 health check；服务器更新阶段不会再次访问 GitHub 做 fetch。
8. 正式客户端随后只会看到该 stable 提交。

如果只改客户端、不需要 Worker / D1 变化：

1. staging 测试通过。
2. Promote stable + Tag。
3. 不需要重新部署 production Worker；正式客户端会通过 `workshop-stable` 获取新客户端提交。

## 低级正式部署命令

需要手工执行共享数据库 migration 或正式 Worker 部署时仍可使用：

```powershell
cd cloudflare
npm run db:migrate:production
npm run deploy:production
```

这两个命令使用额外保护脚本，要求：

- production 配置不存在占位值
- 当前本地 HEAD 精确等于远端 `workshop-stable`
- 必须在交互终端运行
- 必须输入完整的 `PRODUCTION`

日常开发建议优先使用 `npm run update:production`，因为它不要求切换当前工作分支，会从远端 stable 建临时 worktree。

## Loader 约定

测试 Loader：

```js
window.ReincarnationWorkshopConfig = {
  apiBase: 'https://workshop-test.6661816.xyz',
};
```

自动识别为：

```text
testing / main
```

正式 Loader：

```js
window.ReincarnationWorkshopConfig = {
  apiBase: 'https://workshop.6661816.xyz',
};
```

自动识别为：

```text
stable / workshop-stable
```

测试时也可以显式指定：

```js
window.ReincarnationWorkshopConfig = {
  apiBase: 'https://workshop-test.6661816.xyz',
  updateChannel: 'testing',
  updateRef: 'main',
};
```

正式环境不建议覆盖 `updateChannel` / `updateRef`，避免人为绕过 stable 通道。
