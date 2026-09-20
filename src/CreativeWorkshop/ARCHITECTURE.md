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
      ├─ original-conflicts.js # 原版世界书关闭/替换记录与安全恢复
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
4. 安装必须可回滚，卸载只能清理本项目拥有的资源。
5. 已公开版本不会因为新草稿或驳回而消失。
6. production / staging 从资源层彻底隔离。
7. 数据库升级使用 migration，不靠重复执行完整 schema。

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
- Repair 只重建当前项目自己拥有的世界书条目、正则、脚本和预设；原版冲突条目采用“保留玩家编辑、只恢复必要启停状态”的安全策略。
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

1. 作品之间的显式依赖关系，支持最低版本、版本快照和循环依赖拒绝。
2. 作者与用户管理及封禁。
3. 举报与管理员处理。
4. 安装冲突预检与 Repair Registry。

后续按真实使用反馈再扩充依赖展示、人工恢复工具和运营能力。当前原版世界书替换已经记录安装前快照；卸载时若检测到玩家在安装后修改过原条目，会保留玩家修改，仅恢复安装前的启用/关闭状态；只有目标世界书或条目已经不存在时才记录为未自动恢复。

### P2：有实际规模后

1. 排行、推荐、每日榜单。
2. 站点 banner 与运营设置。
3. Cron 清理未引用 R2 对象与历史垃圾。
4. 统计与运营报表。

原则：参考对象中的机制只有在解决本项目真实问题时才移植，不按功能数量照抄。
