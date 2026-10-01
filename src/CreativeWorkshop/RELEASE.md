# 创意工坊发布与服务器更新

## 最近正式热修

- `workshop-v2.0.10`：开局伙伴的人设编辑补上“外貌”字段；发布包会保存到 `profile.外貌`，重新编辑时可回填，开局选择已安装伙伴时会显示并写入伙伴 MVU 数据。此版本按独立创意工坊通道正式发布。
- `workshop-v2.0.9`：正式发布机制拆分为独立组件版本。创意工坊以后只提升 `WORKSHOP_VERSION` 并发布 `workshop-vX.Y.Z`；世界推进独立使用 `WORLD_ENGINE_VERSION` 与 `world-engine-vX.Y.Z`。本次世界推进仍保持 `2.0.8`，不会因工坊发布而产生更新。
- `V2.0.8`：本地作品的单个 Mod“停用并还原原版”和“删除本地缓存”改为直接执行，不再弹二次确认；批量缓存清理以及安装冲突、修复、更新等需要用户选择的流程仍保留确认。
- `V2.0.7`：修复旧 Mod 随角色卡从 `V3.6.11` 升级到 `V3.7` 后被 `character_mismatch` 锁死的问题。仅含共享世界书 / 原世界书状态等可安全迁移内容的已安装 Mod，可直接在新版角色卡更新、检查修复或卸载，并自动把安装目标迁移到当前版本；若旧安装仍含角色卡内部正则或角色脚本，则继续阻止跨卡迁移，避免旧卡残留资源。
- `V2.0.6`：已安装 Mod 的原版世界书目标可随角色卡世界书改名/换版迁移；即使条目 UID 随新卡重建，也会在唯一同名条目可确认时由“检查并修复 / 重新应用”更新绑定，并在卸载时保留新版世界书内容。

创意工坊把测试代码与正式代码通道分开，但 staging / production 共用同一套 Cloudflare 数据资源。

| 环境 | API | Worker env | 客户端更新 ref | 数据资源 |
| --- | --- | --- | --- | --- |
| 测试 | `https://workshop-test.6661816.xyz` | `staging` | `main` | 与正式服共用 D1 / KV / R2 |
| 正式 | `https://workshop.6661816.xyz` | `production` | `workshop-stable` | 与测试服共用 D1 / KV / R2 |

创意工坊与世界推进从此使用**独立版本与独立不可变 Git Tag**：

```text
workshop-vX.Y.Z
world-engine-vX.Y.Z
```

`WORKSHOP_VERSION` 只约束 `workshop-vX.Y.Z`；`WORLD_ENGINE_VERSION` 只约束 `world-engine-vX.Y.Z`。两者可以不同，例如：

```text
WORKSHOP_VERSION = 2.0.9  -> workshop-v2.0.9
WORLD_ENGINE_VERSION = 2.0.8 -> world-engine-v2.0.8
```

历史 `VX.Y.Z` 统一 Tag 只作为旧正式版本兼容来源保留，不再创建新的统一 Tag。

## Windows 双击发布工具

Windows 用户首选仓库根目录：

```text
创意工坊更新工具.bat
```

直接双击，不需要先打开 PowerShell，也不需要输入 `cd` 或 `npm run ...`。

菜单提供：

```text
1. 更新测试服
2. 发布创意工坊正式版（推进 workshop-stable + 创建 workshop-vX.Y.Z）
3. 发布世界推进正式版（只创建 world-engine-vX.Y.Z）
4. 更新正式服务器
5. 依次更新测试服 + 正式服务器
6. 只检查测试服
7. 只检查正式服务器
8. 预演创意工坊正式发布
9. 查看 main / workshop-stable / 两类正式 Tag
0. 退出
```

创意工坊发布会自动读取远端 `origin/main` 中的 `WORKSHOP_VERSION`，准备 `workshop-vX.Y.Z`，在临时 worktree 运行 Worker / Client 测试与语法检查，再原子推进 `workshop-stable` 与创意工坊 Tag。

世界推进发布则只读取 `WORLD_ENGINE_VERSION`，校验 `script/世界推进系统.js` 与分片源码同步，运行世界推进完整回归，然后只创建并推送 `world-engine-vX.Y.Z`；**不会推进 `workshop-stable`，也不会修改或要求提升 `WORKSHOP_VERSION`**。

GitHub Actions 分别提供 `creative-workshop-promote-stable` 与 `world-engine-promote-stable` 两个独立入口。

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
7. 生成 Tag 名 `VX.Y.Z`。
8. 如果该 Tag 已存在，直接拒绝，正式 Tag 不允许覆盖。
9. 重新执行 Worker tests / syntax 与 Client tests / syntax。
10. 创建 annotated Git Tag。
11. 使用 `git push --atomic` 同时推进 `workshop-stable` 与 Tag。

因此一次成功的正式发布必须满足：

```text
WORKSHOP_VERSION = X.Y.Z
workshop-stable  = 正式目标提交
VX.Y.Z  = 同一个正式目标提交
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

测试创意工坊时可以显式指定：

```js
window.ReincarnationWorkshopConfig = {
  apiBase: 'https://workshop-test.6661816.xyz',
  updateChannel: 'testing',
  updateRef: 'main',
};
```

这只让**创意工坊**跟踪 `main`；世界推进默认仍保持正式 `world-engine-v*` 通道，不会因为进入测试工坊而出现测试世界推进更新。

只有确实要测试世界推进时，才额外显式打开：

```js
window.ReincarnationWorkshopConfig = {
  apiBase: 'https://workshop-test.6661816.xyz',
  updateChannel: 'testing',
  updateRef: 'main',
  worldEngineUpdateChannel: 'testing',
  worldEngineUpdateRef: 'main',
};
```

正式环境不建议覆盖这些通道参数，避免人为绕过正式 Tag。


## 正式版本事实、Tag 与精确 SHA

正式版本事实按组件拆开：

- `workshop-vX.Y.Z`：创意工坊正式版本；`workshop-stable` 是其正式部署/更新指针。
- `world-engine-vX.Y.Z`：世界推进正式版本；不依赖 `workshop-stable`。
- 历史 `VX.Y.Z`：旧统一发布兼容 Tag，只读保留，不再生成。

Worker 查询创意工坊时优先使用 `workshop-v*`，迁移期兼容旧 `V*`；只有 Tag 对应当前 `workshop-stable` 发布头时才作为正式工坊版本事实。世界推进查询只在 `world-engine-v*` 与历史 `V*` 中解析正式版本，**不会因为创意工坊发布了新版本而产生世界推进更新**。

测试通道仍直接写固定 commit SHA；正式 loader 使用对应组件的不可变 Tag，并同时保留解析后的精确 commit SHA 作为诊断元数据。
