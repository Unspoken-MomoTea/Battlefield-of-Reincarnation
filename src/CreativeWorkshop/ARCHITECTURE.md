# 创意工坊架构回审

本文件用于持续对照三个参考对象，避免只复制表面 UI 而漏掉成熟工程中的关键边界。

## 当前目标架构

```text
src/CreativeWorkshop/
├─ index.js                  # 仅启动
├─ app/                      # 生命周期、事件、全局 Bridge
├─ ui/                       # 样式、模板、DOM 节点、通用 UI helper
├─ views/                    # 发现 / 本地 / 作者 / 管理员
└─ services/
   ├─ api/                   # auth / projects / admin / transport
   ├─ projects/              # 完整性、离线包、缓存、批量更新
   └─ installer/
      ├─ normalize/          # 世界书 / 正则 / 酒馆助手脚本 / 预设适配
      ├─ conflicts/          # 安装前冲突预检
      ├─ repair/             # 安装健康检查 / Repair Registry
      ├─ plan.js
      ├─ original-conflicts.js # 原世界书启停状态覆盖、快照与安全恢复
      ├─ original-regexes.js   # 原正则启停状态覆盖、快照与安全恢复
      ├─ original-scripts.js   # 原酒馆助手脚本启停状态覆盖、快照与安全恢复
      ├─ snapshot.js
      ├─ apply.js
      └─ uninstall.js
             │
             │ HTTPS
             ▼
cloudflare/src/
├─ index.js                  # 只保留错误边界 / CORS
├─ router.js
├─ routes/                   # system / auth / projects / admin
├─ auth/                     # Discord / Session / User
├─ projects/
│  ├─ author/                # 作者列表 / 元数据 / 版本
│  ├─ admin/                 # 列表 / 详情 / 审核 / 下架 / 审计
│  ├─ artifacts.js
│  ├─ manifest.js
│  ├─ cover.js
│  ├─ diff.js
│  └─ versions.js
├─ engagement.js
├─ routes/system.js           # 健康检查 / 客户端最新 commit 查询与 KV 缓存
└─ middleware/
   └─ request-guard.js

D1 → 元数据 / 审核 / 互动统计
KV → OAuth / Session
R2 → bundle / manifest / 封面
```

核心原则：

1. 远程作品在浏览、下载、审核阶段始终只作为数据处理；只有玩家主动安装后，经过 artifact 校验的酒馆助手脚本才会通过 Tavern Helper ScriptTree API 写入并启用。
2. 服务器负责身份、审核、版本与公开状态；客户端负责本地安装状态。
3. 下载和安装是两个动作。
4. 安装必须可回滚；停用只能清理本项目拥有的资源，并恢复该项目控制过的原世界书、原正则和原脚本安装前启停状态。
5. 原版资源控制是 bundle 级 `resource_overrides`，每个目标只保存“enabled / disabled”；未声明就是“保持”。作者界面以三态控件呈现“保持 / 启用 / 停用”。
6. 原版世界书扫描沿用世界推进的“当前角色主书 / 附加 / 聊天绑定 / 全局启用”来源，但来源中的启用与停用条目都必须展示；原正则和原脚本只扫描当前角色卡自身资源，并且不能因为当前停用而从作者界面消失。创意工坊 loader 与 `rw:` 命名空间资源必须从作者可控制列表中排除。
7. 已公开版本不会因为新草稿或驳回而消失。
8. 作者公开可见性（owner_hidden）与管理员审核状态分离：作者可自助下架/重新上架而不锁死更新；管理员 archived 仍可阻止重新公开。
9. 作者更新以“上一版 bundle + 当前元数据”为基线，不要求重建完整包；新文件按同名 artifact 替换，未改内容与上一版 `resource_overrides` 自动继承。把规则切回“保持”就是显式取消。
10. production / staging 不只从 D1 / KV / R2 隔离，客户端热更也必须隔离：staging 固定跟踪 `main`，production 固定跟踪 `workshop-stable`；任何正式客户端代码都只能通过显式 stable promotion 进入。
11. production 部署默认拒绝 main：正式部署脚本要求本地 HEAD 精确等于远端 `workshop-stable`、正式 Cloudflare 资源已配置，并再次输入 `PRODUCTION` 确认。
12. 数据库升级使用 migration，不靠重复执行完整 schema。

---

## 参考一：AkabaneSaki/myrepo CreativeWorkshop

### 已吸收

- Cloudflare Worker + D1 + KV + R2。
- Discord OAuth。
- production / staging 分离。
- 项目创建、上传、审核、发布的完整生命周期。
- 作者项目与管理员审核分离。
- 审核详情可以查看实际 R2 内容。
- 审核后保留历史。
- 管理员下架/恢复和统一审计日志。
- D1 migration。
- bundle 在服务端做结构验证。
- 客户端安装操作集中在受控 service/installer 层。
- 世界书、正则、酒馆助手脚本安装具有来源命名空间，避免误删用户内容。
- 已吸收对方“DLC 修复/更新”思路：独立维护中心负责安装健康检查、Repair、恢复点状态和工坊客户端更新。
- 工坊本体更新不要求玩家手动替换 import：维护中心可扫描 ScriptTree 中的工坊 loader；测试版把固定 SHA 更新到 `main` 最新提交，正式版只更新到 `workshop-stable`。
- 自 v1.7.0 起，自更新从“维护页工具”提升为客户端生命周期能力：服务健康检查成功后自动扫描 loader；发现旧 SHA 时弹出更新提示，用户确认后事务式重写 ScriptTree，并动态导入不可变的新 SHA。
- 新客户端启动时会调用旧 `window.ReincarnationWorkshop.destroy()` 完成 UI、事件和全局 Bridge 清理，再接管并重新打开面板；这样避免热更新后残留双份监听器。旧客户端没有 `destroy` 时仅作为一次性迁移场景执行已知 DOM 兜底清理。
- latest 查询允许 Worker KV 缓存，但当目标 SHA 与本地 loader 不一致时客户端额外核对当前环境自己的 GitHub ref；正式通道永不回退查询 `main`。

### 尚未吸收，后续按需要实现

高优先级：

- 已完成：封面上传与展示。
- 已完成：标签 / 分类筛选增强。
- 已完成：下载量、点赞、收藏。
- 已完成：批量版本查询 + IndexedDB 更新检查冷却。
- 已完成：审核 diff，对比公开版本与待审核版本。
- 已完成：请求体大小保护与统一 middleware 入口。
- 已完成：安装前冲突检查与 Repair Registry。
- 当前项目只有新版，不建立基础包/旧版兼容层。

中优先级：

- 管理员站点设置，如发现页 banner。
- 用户/作者管理与封禁。
- 排名与每日榜单。
- 更完整的项目 taxonomy/facets。

不直接照搬：

- 对方针对旧版/多基础版本的兼容层；当前轮回战场只维护新版，不制造无实际用途的兼容系统。
- 对方特定角色卡 reference 数据结构。
- 远程 iframe UI。当前采用酒馆原生挂载 UI。

---

## 参考二：Awene/tavern_helper_template-main 创意工坊

### 已吸收

- 工坊前端直接运行在酒馆 DOM，而不是远程 iframe。
- 已吸收成熟工坊的浏览层交互：左侧主导航、移动端底部导航、封面卡片、角色/扩展可视分类、排序、分页加载、详情弹窗、真实互动激活态与“下载 → 安装 → 升级”的连续状态。
- 详情层继续按成熟 Workshop 的信息架构收敛：公开详情由 Worker 从已审核 bundle 派生安全只读预览，而不是要求客户端先下载执行；世界书、正则、脚本直接阅读，原始 Manifest 不再暴露给普通用户。
- 公开详情返回 `content_preview`、`change_preview`、`version_history`。其中 `change_preview` 只比较已审核发布版本，区分新增/修改/删除，避免把作者尚未通过审核的草稿泄露给公开用户。
- 详情 UI 采用大尺寸阅读工作区：桌面为“内容阅读列 + 安装/互动侧栏”，移动端自动切换单列；互动入口（点赞/收藏/下载统计）与安装状态常驻可见。
- 本地库已卡片化，并将检查安装、导出、卸载等低频操作收进更多菜单；管理员作品详情也改为独立审核弹窗，不再在列表卡片中展开大段 JSON。
- `window.ReincarnationWorkshop` 稳定公共接口。
- IndexedDB 保存登录与本地安装状态。
- 本地版本检测。
- 一键下载新版并重新应用。
- 下载内容使用 manifest 做 SHA-256 / byte size 完整性校验。
- 离线包导出/导入。
- 离线包重新校验，不信任文件扩展名。
- 安装和缓存分离。
- IndexedDB versionchange 基础处理。

### 尚未吸收，后续按需要实现

高优先级：

- 已完成：批量自动检查更新，并设置持久化检查冷却时间。
- 已完成：IndexedDB 多标签页升级协调、versionchange 主动关闭与 blocked timeout。
- 已完成：本地存储占用统计与“仅缓存作品”安全清理工具。

按业务决定：

- 图片预览缓存、图片哈希复用、图片匹配等属于对方“插图工坊”核心，不是我们当前世界书/正则/预设工坊的必需能力。
- 自动插图、角色名迁移等不应为了“看起来功能多”硬搬进本项目。
- 顶层作品 taxonomy 已收敛为“角色 / 扩展”；世界书、正则、酒馆助手脚本、预设、数据属于 artifact 层，不再与作品类型混在一起。

---

## 参考三：项目内 Go mini server

### 已吸收

- Handler/API 与业务行为分开，不让 UI 直接操作数据库。
- 用户身份由统一 Auth 层解析。
- 数据写入通过明确业务入口执行。
- 管理行为保留日志。
- 配置与 Secret 分离：Secret 不提交 Git。
- 管理器思路被映射为客户端 service / installer 和 Worker 业务模块。

### 当前仍需改善

后端大文件拆分已经完成第一阶段：入口、路由、Auth、作者区、管理员区、项目校验均按目录拆开；原路径保留 barrel 兼容出口。

继续扩展时遵守：

- route 只负责 URL / method / auth context 分发。
- 业务规则放在对应领域目录，不回填到 `index.js`。
- 数据库重复查询明显增多时，再引入 repository 层；目前不为了“层数好看”提前制造空壳抽象。
- 单文件明显超过约 300～400 行时优先检查是否存在第二个职责。

Go 服务器里的常驻内存用户缓存、Redis TCP 连接、Ticker、mqant 不适合 Cloudflare Worker，不搬。

Cron 只在真正需要排行榜快照、垃圾 R2 清理等后台维护任务后再加入。

---

## 当前确认过的关键安全边界

- Discord Client Secret 仅进入 Worker Secret。
- 浏览器只保存随机 Session Token；KV 保存其 SHA-256 key。
- OAuth state 和一次性交换结果都有过期时间。
- 服务端允许经过严格结构校验的 `script` artifact；下载与审核阶段不执行脚本，安装时才通过 Tavern Helper API 写入。
- 世界书、正则、酒馆助手脚本、预设在写入酒馆前再次解析/规范化。
- 正则使用项目命名空间 ID。
- 预设名带项目 ID 与 artifact 序号。
- 安装失败会回滚已执行的世界书、原版世界书、正则、脚本与预设步骤。
- 已安装角色相关资源不能在另一角色上误更新/误卸载。
- 安装前预检只提示或阻止真实冲突，不替玩家自动删除第三方资源；原版冲突目标缺失或匹配不唯一时会在任何写入发生前阻止安装。
- Repair 只重建当前项目自己拥有的世界书条目、正则、脚本和预设；原世界书、原正则和原脚本的状态覆盖都采用“保留玩家编辑、只恢复必要启停状态”的安全策略。
- 多个工坊项目若同时声明同一个原资源，采用 claim 语义：相同目标状态可以共存，最后一个 claim 移除后才恢复安装前状态；相反目标状态在安装前直接阻止。
- 下载 bundle 必须通过 manifest 大小与 SHA-256 校验。
- 离线包导入再次校验 manifest。
- 管理员驳回必须填写原因。
- 管理员审核、下架、恢复写入统一审计日志。

---

## 后续实现顺序

### P0：上线前

已完成：

1. 封面与标签。
2. 下载量、点赞、收藏。
3. 更新审核 diff。
4. 批量版本查询 / 自动更新冷却。
5. Worker API 请求体保护。
6. Worker / Client 大文件第一阶段模块化拆分。

仍建议在正式公开前补：

1. 真实 staging 部署后的端到端测试。
2. Cloudflare 真实 D1/KV/R2 创建后的迁移与回滚演练。

### P1：内容生态扩大后

已完成：

1. 作品之间的显式依赖关系，支持搜索选择、最低版本、版本快照和循环依赖拒绝；作者不再手填项目 ID。
2. 作者与用户管理及封禁。
3. 举报与管理员处理。
4. 安装冲突预检与 Repair Registry。

后续按真实使用反馈再扩充依赖展示、人工恢复工具和运营能力。当前原版世界书与酒馆助手脚本替换都记录安装前快照；停用时若检测到玩家在安装后修改过原内容，会保留玩家修改，仅恢复安装前的启用/关闭状态；只有目标已经不存在时才记录为未自动恢复。

### P2：有实际规模后

1. 排行、推荐、每日榜单。
2. 站点 banner 与运营设置。
3. Cron 清理未引用 R2 对象与历史垃圾。
4. 统计与运营报表。

原则：参考对象中的机制只有在解决本项目真实问题时才移植，不按功能数量照抄。
