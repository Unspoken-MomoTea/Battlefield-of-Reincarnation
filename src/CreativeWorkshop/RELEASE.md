# 创意工坊发布与服务器更新

## 最近正式热修

- `workshop-v2.0.35`：收口收藏、本地下载与酒馆启用三套状态。登录用户新增左侧“我的收藏”，收藏记录从 `project_favorites(user_id, created_at)` 索引只读取当前账号的作品 ID，再与既有 R2 Catalog Snapshot 合并展示，不新增公开目录 D1 扫描；取消收藏会立即从收藏页移除。原“已安装”导航改名为“本地库”，明确下载/本地测试/离线包只是本地内容，只有点击“安装到酒馆”才真正启用。已启用且没有新版时，卡片与详情主按钮改为“停用并还原”；只有自动/手动更新检查真实发现新版本时才显示“更新项目”，普通“检查更新”退到次级操作。状态徽章统一为“已下载 / 已启用 / 有更新 / 启用异常”，避免把缓存和启用混为一谈。
- `workshop-v2.0.34`：重做发现首页的“推荐”排序，避免与“下载最多”长期重合。下载、点赞、收藏先做对数压缩，再叠加新作扶持、近期更新加成、温和时间衰减，并用“作品 ID + 当天”生成确定性微扰：同一天翻页排序稳定，但推荐位会随日期轻微轮换。客户端下载到 Catalog Snapshot 后在本地使用同一公式排序；Worker 侧旧版 `/api/projects?sort=popular` 也同步使用同一算法。同期状态栏左侧 Tab 轨道改为真正的纵向滚动容器，扩展继续沿用既有 `.sam-tab-rail` / `.sam-tab-btn` / `data-tab` 挂载约定；状态栏功能本身独立发布为 `status-bar-v1.0.1`。
- `workshop-v2.0.33`：按 Cloudflare Free-only 策略重做服务器存储与公开目录。服务器不再保留可回退的作品历史版本：新版本写入成功后会删除旧 bundle / manifest 和失去引用的旧封面，详情与审核页也不再展示历史版本。首次提交审核前，客户端必须先把完整 bundle 与封面保存为本地测试副本，并向服务器标记“本地副本已确认”；这类首次审核作品被驳回后，服务器项目及 R2 对象会直接删除，作者继续从本地副本修改并重新上传。旧客户端遗留的待审作品没有本地确认标记时保守不自动删除，避免历史用户数据丢失。R2 增加 Free 硬预算：总占用以 9.5 GB 为绝对上限、上传阶段按 9.45 GB 预留事务余量，bundle、封面和公开目录快照写入前都会检查实际 R2 占用，超过预算返回 507 并拒绝写入。主管理员新增“容量”页，可查看 R2 实际字节/对象数、D1 当前数据库大小/500 MB、作品与版本记录数，并可一次清理改版前遗留历史版本。公开发现页改为共享 Catalog Snapshot：服务端只在目录失效/过期时从 D1 构建一次轻量元数据快照，客户端拿到目录后在本机完成搜索、标签、分类、子类型、推荐/最新/点赞/下载排序和分页；旧版客户端继续访问 `/api/projects` 时也改为从同一目录快照筛选，不再为每次搜索执行 D1 `LIKE/json_each/JOIN` 扫描。
- `workshop-v2.0.32`：补齐开局角色/伙伴原始构筑的标签编辑。开局角色与开局伙伴的技能现在都有“标签”输入框，开局伙伴的携带装备也新增“标签”输入框，支持逗号、中文逗号或换行分隔；发布时会真实写入 MVU 的 `技能.*.标签` / `装备.*.标签`，开局选择后由现有完整构筑注入链路原样写入角色或关系列表，无需再通过故事神谕二次修改。编辑已发布/本地测试作品时也会回填已有标签，不会保存一次后丢失。新增发布→回读回归，覆盖开局角色技能、伙伴技能和伙伴装备三条路径。
- `workshop-v2.0.31`：去除世界书角色详情里的重复“作品内容”MVU 面板。世界书角色已经能在下方“世界书内容”中完整查看关键词、位置、顺序和正文，因此详情页与审核页不再额外重复展示 world_character 的结构化 MVU 卡；开局角色、开局伙伴、开局商店及其它 data 类型仍保留“作品内容”展示。
- `workshop-v2.0.30`：修复正式工坊更新偶尔把 loader 写成 40 位提交 SHA，而不是 `workshop-vX.Y.Z` 的问题。根因是正式发布时 `workshop-stable` 与不可变 Tag 虽然原子推送，但 GitHub 的 Tag 列表/上游查询仍可能短暂滞后；旧更新服务会在这段窗口把新 stable head 当成 `legacy-ref` 并缓存，客户端随后就会把精确 SHA 写进载入脚本。现在正式通道严格要求不可变 Tag：Tag 尚未可见时 Worker 返回上一个已确认的正式 Tag（若有）或暂缓更新，不再缓存/下发裸 SHA；客户端即使收到旧式 `legacy-ref` 元数据也拒绝改写正式 loader。已有 SHA loader 在下一次取得正式 Tag 后仍会自动规范化为 `workshop-vX.Y.Z`。
- `workshop-v2.0.29`：重做作品详情与审核页的 MVU 内容展示。Worker 不再只把 data artifact 压成一段“其他内容”文本，而会输出结构化 `data_entries`；详情页和审核页共用同一套语义渲染器，开局角色/开局伙伴会直接展示种族、身份、层级、血统属性与效果、技能、伙伴好感/队友状态/初始装备及人物资料，开局商店会按装备/道具/技能分组展示品质、类型、价格、标签、属性、效果、描述、数量/冷却/消耗。每个 MVU 面板都保留可折叠的原始 JSON 兜底。内容区现在排在更新记录之前，data 不再归入“其他内容”；版本差异也开始计入 MVU 数据变化，详情侧栏单独显示 MVU 数据数量。未识别 data 仍会以完整原始数据展示，不会丢失。
- `workshop-v2.0.28`：合并管理员驳回交互与异步完成状态修复。管理员点击“驳回”后不再先弹浏览器原生 prompt、再弹第二个确认框；改为单个工坊弹窗内直接填写必填驳回原因并确认。提交审核增加短超时恢复与自动重试，服务端把“已经进入 pending”视为幂等成功，避免 D1 已提交但客户端响应丢失时按钮永久停在“正在提交审核”。本地测试保存不再对同一 bundle 做两轮 SHA-256；IndexedDB 写入现在先监听事务完成、同时等待 put/delete 请求成功，如果 WebView 丢失 transaction complete 事件则在短暂宽限后按已写入继续，避免数据已经落盘但按钮一直“正在保存”。提交成功后的“我的作品/已安装”刷新改为后台刷新，不再阻塞主按钮完成状态。
- `workshop-v2.0.27`：修复部分酒馆/客户端在安装含正则或酒馆助手脚本的 MOD 时，Tavern Helper 对“当前为空”的正则/脚本列表返回 `undefined`，安装预检直接执行 `.map()` 导致 `TypeError: Cannot read properties of undefined (reading 'map')`、作品无法安装的问题。安装预检、快照、原版正则/脚本状态同步和依赖读取现在都把缺失列表规范为空数组；新增两条真实安装链回归，覆盖空正则库与空脚本树从预检到实际 apply 均可完成安装。
- `workshop-v2.0.26`：处理本地测试与审核交互。保存本地测试现在会先立刻切换为“正在准备 / 正在读取封面 / 正在保存”，并在重计算与 IndexedDB 写入前让出一帧给 UI，完成后按钮保持“✓ 已保存”状态；再次编辑时恢复为可保存状态，避免点击后长时间看起来毫无反应。对异常本地 bundle 增加结构校验，不再让 `artifacts.map` 直接抛出 `Cannot read properties of undefined (reading 'map')` 这类开发者错误。管理员审核列表与详情现在读取 `content_kind`，角色作品会明确显示“世界书角色 / 开局角色 / 开局伙伴 / 异端”等子类型，并在详情右侧增加“作品类型”。顶栏“刷新工坊”按钮缩短为“刷新”。
- `workshop-v2.0.25`：修复 2.0.24 的发现首页回归。上版给“角色三个子栏目”补客户端分类兜底时，误把同一段过滤逻辑替换进了通用发现首页，导致 `loadShowcase()` 引用了只存在于角色循环中的 `kind` 变量；Safari/WebView 因此显示 `Can't find variable: kind`，发现推荐/最新发布/玩家好评/下载排行全部加载失败。现在通用发现首页恢复按排序直接展示，角色首页才按 `character + kind` 做二次隔离，并加入专门回归测试防止再次串改。
- `workshop-v2.0.24`：修复发现页分类列表长期复用旧内存缓存后出现“扩展/开局商店看不到新作品、角色三个栏目显示串类作品”的问题。分类渲染现在会再次按 `category + kind` 校验返回项目，避免错误响应串入其它栏目；公开作品列表同时改为 `no-store`，客户端列表请求也显式绕过浏览器 HTTP 缓存。工坊顶栏新增“刷新工坊”按钮，可一键清空发现页缓存并按当前所在的发现首页、角色首页、分类目录或管理页重新读取数据。
- `workshop-v2.0.23`：撤出 2.0.22 新增的启动/普通“重新扫描”自动全量开局 Registry 重建，避免每次进入工坊或维护页都遍历已安装项目并重复扫描 IndexedDB；“修复”页改为单独的“重建开局资产索引”手动动作。与此同时修复 Mod 刚发布新版时详情 manifest 已更新、`/download` 却仍命中旧 5 分钟缓存而触发 artifact 大小/SHA 校验失败的问题：客户端下载先锁定详情中的精确版本，服务端支持 `?version=N` 的不可变版本包；若完整性校验仍命中大小/SHA 不一致，客户端会使用 cache-buster 强制重取一次，校验本身继续保留。
- `workshop-v2.0.22`：修复“本地测试开局伙伴可见，但早先从正式工坊安装的伙伴仍不显示”的历史安装状态问题。工坊现在在启动及维护页重新扫描时，会从所有 `applied` 项目已缓存的 bundle 重新构建 `opening_assets` / `opening_store_catalogs`，自动补回旧版本曾漏写或丢失的开局 Registry，并同步修正安装记录中的数量，无需用户卸载重装。辅助计算更新检查同时修复与工坊旧缓存相同的问题：当 Worker 缓存返回的正式 Tag 恰好等于当前已安装版本时，会再向 GitHub 核对最新 `calculator-v*`，因此已发布的 `calculator-v1.0.1` 不会再被旧的 1.0.0 五分钟缓存压住。
- `workshop-v2.0.21`：继续修复酒馆 sandbox 开局页无法读取已安装伙伴的问题。部分酒馆/移动客户端把 HTML 放进 opaque-origin iframe，`postMessage` 的 `event.origin` 会变成 `null`；2.0.20 的安全白名单因此仍会拒绝真实开局页。现在只对当前页面中能确认属于轮回战场开局的 iframe 放行 opaque origin，请求源必须匹配 iframe `contentWindow` 且其 `src/srcdoc` 能识别为开局页面，未知 sandbox iframe 仍拒绝。同期辅助计算 `v1.0.1` 把页面生命周期清理从受 Permissions Policy 限制的 `unload` 改为原生 `pagehide`，消除相关控制台警告。
- `workshop-v2.0.20`：修复固定开局地址 `/opening/latest` 经 jsDelivr 跨域运行时无法读取创意工坊本地安装资产的问题。此前工坊把开局角色/伙伴与商店目录写入酒馆宿主 origin 的 IndexedDB，而 CDN 开局页读取的是另一个 origin 下的同名空库，因此会出现“作品已安装，但开局伙伴库/商店仍为空”。现在创意工坊宿主通过受信任的 `postMessage` 数据桥向开局页提供 `opening_assets` 与 `opening_store_catalogs`，并在安装、更新、卸载后主动推送刷新；同源环境仍保留 IndexedDB 兜底。桥只接受当前宿主、`cdn.jsdelivr.net` 与工坊正式/测试域名请求。
- `workshop-v2.0.19`：开局伙伴发布面板新增“初始好感度”和“是否队友”两个 MVU 字段。初始好感度默认 `0`、仅接受 `-100～100` 并按整数写入；是否队友默认“是”。字段会随伙伴 data artifact 保存，重新编辑时原样回填；玩家在开局选择已安装的工坊伙伴后，会把对应 `好感度` / `是否队友` 写入 `stat_data.关系列表.<伙伴名>`。旧伙伴资源缺少这两个字段时继续按 `0 / true` 兼容。
- `workshop-v2.0.18`：修复作者“我的作品”中待审核作品仍显示空三点菜单的问题；待审核作品没有可执行管理操作时不再显示菜单。管理员审核详情中，审核中的版本只显示“批准 / 驳回”，下架、恢复与永久删除仅对已经审核通过的作品显示。正式更新检查也不再盲信与当前安装版本相同的 Worker 缓存：当 Worker 返回缓存中的“已是最新版”时，会额外核对 `workshop-stable` / 正式 Tag，避免新版本发布后被旧 5 分钟缓存压住；正式发布前的 production smoke 也不再预热 `/api/client/latest` 旧版本缓存。
- `workshop-v2.0.17`：简化管理员审核流程：批准版本不再先弹可选“审核备注”输入框，只保留最终确认；作品详情的“审核记录”不再重复显示 `review_approved / review_rejected` 管理审计项。工坊标签展示去除多余 `#` 前缀；管理页默认筛选“审核中”，不再提供“未提交审核”筛选，且“全部审核状态”默认排除从未提交的作者草稿。此版本同时包含 production Worker 的 GitHub/KV 容灾、Cache API 热缓存与 D1 `auth_store` 登录存储热修。
- `workshop-v2.0.16`：修复部分酒馆客户端 / WebView 缺少 `crypto.subtle` 时，工坊“下载到本地”在 SHA-256 完整性校验阶段报 `Cannot read properties of undefined (reading 'digest')` 的兼容性问题。客户端现在优先使用原生 Web Crypto，并在不可用时回退到内置 SHA-256 实现；下载、离线包校验与作者本地测试仍保留完整哈希校验，不会因兼容处理跳过安全检查。
- `workshop-v2.0.15`：放宽同一角色卡不同版本之间的 Mod 目标迁移。角色卡升级后，即使已安装 Mod 含角色级正则、角色脚本或对应原版状态记录，也可在新版同系列角色卡上继续安装/更新、检查修复和卸载；仅真正切换到其他角色卡时继续阻止跨角色操作。
- `workshop-v2.0.14`：已安装的远端 Mod 在工坊连接成功后自动批量检查作者新版本，复用 15 分钟持久缓存；进入“已安装”页会直接显示“有更新 vX”，主按钮变为“升级到 vX / 下载 vX”，手动“检查全部更新”仍可强制刷新。自动检查失败只降级为显示本地记录，不影响已安装页。
- `workshop-v2.0.13`：状态栏与辅助计算的更新检查改为优先通过正式 Worker `/api/components/latest` 获取组件版本，Worker 不可用时才回退客户端直连 GitHub；同时校验更新通道/Ref，并避免 stale 快照把已安装的新版本降级。用于降低客户端 GitHub 403/429 对热更新的影响。
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

## 状态栏独立版本与工坊维护

状态栏与世界推进采用相同的“源码分片 → 单文件交付 → 工坊维护 loader”模式，但版本命名空间完全独立：

```text
src/StatusBar/**                         # 唯一开发源码
python tools/build-status-bar.py         # 生成
script/悬浮球状态栏.js                   # 酒馆单文件交付
status-bar-vX.Y.Z                        # 正式不可变 Tag
```

正式工坊默认只检查 `status-bar-v*`。即使创意工坊本身运行在 testing/main，状态栏也不会跟随 main；测试状态栏必须在 loader 配置中显式加入：

```js
window.ReincarnationWorkshopConfig = {
  apiBase: 'https://workshop-test.6661816.xyz',
  updateChannel: 'testing',
  updateRef: 'main',
  statusBarUpdateChannel: 'testing',
  statusBarUpdateRef: 'main',
};
```

“修复”页会显示独立的“状态栏更新”区。旧角色卡中完整内联的 `悬浮球状态栏.js` 可直接被接管并改写成版本 loader；第一次接管只持久化 loader，不在当前页面强制叠加新版运行时。由 loader 启动的新版状态栏会登记 `SamsaraStatusBarRuntime`、`Samsara.StatusBarInfo` 并集中持有可停止的事件订阅，后续版本才允许安全热重载。

正式发布使用 `.github/workflows/status-bar-promote-stable.yml` 或提交标记 `[publish status-bar]`。发布前会校验 `STATUS_BAR_VERSION`、生成交付同步、状态栏语法/回归和工坊 updater 合同；成功后只创建 `status-bar-vX.Y.Z`，不会移动 `workshop-stable`，也不会发布世界推进。


## 辅助计算独立发布

```text
src/Calculator/**                         # 唯一开发源码
python tools/build-calculator.py         # 生成
script/辅助计算脚本.js                   # 酒馆单文件交付
calculator-vX.Y.Z                        # 正式不可变 Tag
```

正式工坊默认只检查 `calculator-v*`。测试辅助计算必须显式配置：

```js
window.ReincarnationWorkshopConfig = {
  calculatorUpdateChannel: 'testing',
  calculatorUpdateRef: 'main',
};
```

正式发布使用 `.github/workflows/calculator-promote-stable.yml` 或提交标记 `[publish calculator]`。辅助计算发布不会移动世界推进、状态栏或工坊的正式 Tag。
