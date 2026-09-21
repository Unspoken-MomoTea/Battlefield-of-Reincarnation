# 轮回战场创意工坊客户端

当前阶段已经跑通“登录 → 浏览 → 作者上传 → 审核 → 下载 → 安装/升级/卸载”的基础闭环。

当前入口：`src/CreativeWorkshop/index.js`

加载后会：

- 在最高可访问的 SillyTavern 页面挂载一个轻量工坊面板。
- 暴露 `window.ReincarnationWorkshop` 公共接口。
- 默认连接 `https://workshop.6661816.xyz`。
- 通过 Discord OAuth 登录，登录态仅保存在浏览器 IndexedDB。
- 下载、浏览和审核阶段不会执行作品中的 JavaScript；只有玩家主动点击安装后，声明为“酒馆助手脚本”的 artifact 才会写入 Tavern Helper 并启用。
- “发现”页采用工坊式卡片浏览，可在“全部 / 角色 / 扩展”之间快速切换，并按最新、热门、下载、收藏或点赞排序；列表使用服务端分页和“加载更多”，不会只显示首批 24 个作品。
- 公开作品详情不再只展示 artifact 标签/Manifest：服务端会从已审核发布 bundle 生成只读内容预览，详情页可直接阅读世界书条目正文、关键词、位置/顺序，查看正则匹配与替换内容、Tavern Helper 脚本源码，以及预设/数据摘要。
- 作品详情采用“阅读区 + 右侧信息/安装栏”结构：封面、简介、当前版本更新摘要、版本历史和具体内容位于阅读区；下载/安装/升级、点赞、收藏、下载量、依赖和原版替换目标集中在右侧。
- 从第二个已发布版本开始，公开详情会把当前版本与上一个已审核版本对比，显示世界书/正则/脚本的新增、修改、删除及主要变更字段；首次发布明确显示“没有上一版本可比较”。
- 点赞和收藏入口始终可见；未登录时点击会提示 Discord 登录，而不是把互动按钮整个隐藏。
- 作品详情会显示当前用户真实的点赞/收藏状态；下载后主操作会连续切换为安装、应用新版或一键升级，但仍保持“下载不执行脚本，主动安装才写入”的安全边界。
- “本地”页使用 IndexedDB 保存下载的 bundle、缓存版本和已应用版本，并用作品卡片展示封面、简介与安装状态；主操作只保留安装/更新/修复等当前最相关动作，检查安装、导出、卸载等低频操作收进更多菜单。
- 每次下载都会按服务端 manifest 校验 artifact 数量、字节数与 SHA-256，校验失败不会进入本地缓存。
- 本地作品可导出为 `.rwpack`，另一台设备可离线导入；导入时会再次执行完整哈希校验。
- IndexedDB 支持多标签页升级协调；发生 schema 升级时会主动请求其他标签页关闭旧连接，并带阻塞超时提示。
- 本地页可查看工坊逻辑存储量、浏览器站点配额，并一键清理“仅缓存”作品；已安装作品不会被误删。
- 作品可声明其他工坊项目为依赖，并指定最低版本；依赖随发布版本冻结，安装前会阻止缺失、未应用或版本不足的依赖。
- 服务器拒绝循环依赖，避免出现 A 依赖 B、B 又依赖 A 的不可安装关系。
- 世界书安装到共享世界书“轮回战场·创意工坊”，条目写入来源标记，卸载只删除对应作品条目。
- 正则安装为当前角色卡局部正则，并使用项目命名空间 ID，卸载不会删除玩家自己的正则。
- 酒馆助手脚本通过 ScriptTree API 安装，使用项目命名空间 ID；更新时原位替换工坊脚本，停用作品时只清理该项目拥有的脚本。
- script artifact 也可以声明需要临时屏蔽/替换的原酒馆助手脚本（character / preset / global）；安装前记录原脚本和启用状态，停用时自动还原。若玩家在作品启用期间修改过原脚本，则保留玩家修改，只恢复安装前启用状态。
- 预设名称会附带项目 ID 与 artifact 序号命名空间，避免两个同名作品互相覆盖。
- 世界书 artifact 可声明需要关闭/替换的原版条目；安装前记录原值。停用时若玩家修改过原条目，会保留玩家修改，只恢复安装前的启用/关闭状态。
- “DLC 修复 / 更新”会扫描已安装作品的世界书、正则、脚本、预设及原版恢复点；可对异常作品执行 Repair。
- “DLC 修复 / 更新”还能定位加载当前工坊的酒馆助手脚本，查询 main 最新 commit，并直接把脚本中的 jsDelivr 固定 commit 链接改为最新 SHA；以后更新工坊本体不需要再手动复制新链接。客户端优先通过 Workshop Worker 的 `/api/client/latest` 获取最新提交（KV 缓存），失败时再回退 GitHub API。
- v1.7.0 起，工坊在服务连接成功后会自动检查自身更新；若 Tavern Helper 中的工坊 loader 仍指向旧提交，会直接弹出“一键热更”。确认后只重写该 loader 中本仓库的 jsDelivr commit SHA，保留 `apiBase` 与脚本内其他用户配置。
- loader 写入成功后会直接动态导入新的固定 SHA，并通过客户端 `destroy → handoff → reopen` 生命周期让新版接管当前界面；正常情况下不需要刷新整个 SillyTavern。若热载入失败，loader 已更新时刷新一次酒馆即可兜底。
- 为避免 Worker 的 latest KV 短暂缓存造成错误降级，只要发现“loader SHA 与服务端 latest 不一致”，客户端会额外即时核对 GitHub main 后再决定目标 SHA；不会因为旧缓存把新 loader 写回旧提交。
- 安装前会检查同名世界书条目、残留正则/脚本 ID、同名预设与角色目标冲突；非致命冲突由玩家确认后再继续。
- 安装过程带快照；任一步骤失败会回滚已经发生的世界书、原版世界书、正则、脚本和预设修改。
- 已安装作品可执行“检查安装”；缺失或被修改的工坊资源可一键 Repair，修复只触碰该项目拥有的资源。
- 世界书/正则记录安装目标角色，切换到其他角色时会阻止误更新、误卸载。
- Discord 登录后可创建作品、上传新版本并提交审核。
- 发布界面采用“文件优先”流程：作者直接拖入 JSON / JS / TXT，客户端自动识别世界书、正则、Tavern Helper ScriptTree、预设或普通数据；识别不确定时只需要在对应文件行修正类型，不再先选 artifact 类型。
- 创建作品和上传新版本共用同一套“检查与安装规则”步骤：如果版本包含世界书或脚本，会扫描当前 SillyTavern 的世界书条目与酒馆助手脚本，并通过勾选选择需要临时屏蔽/替换的原版内容，不要求作者手写 UID、脚本 ID 或作用域声明。
- 封面文件选择后会立即本地预览；创建作品时直到最终确认前都不会上传，已有作品更新封面时也先预览再确认上传。
- 顶层作品类型只有“角色”和“扩展”；世界书、正则、酒馆助手脚本、预设、数据都属于作品内部 artifact，不再作为作品类型。
- 两种作品都可以直接上传完整的 `bundle v1` JSON；普通作者也可以在发布界面分批加入世界书、正则、酒馆助手脚本、预设和数据文件，组合成同一个版本。
- 作者上传世界书时可直接填写需要临时关闭的原版条目，不必手写 bundle 元数据；安装前会先验证目标存在且唯一。
- 本地页检查到新版本后，可直接一键升级并重新应用；缓存与酒馆安装作为一个事务处理，应用失败会保留旧缓存与旧安装状态。
- 管理员账号会出现“审核”页：可查看全部已上传作品，而不只待审核作品。
- 管理页可筛选“未提交 / 审核中 / 已通过 / 已拒绝”，并显示作者、公开版本、审核人、审核意见和时间。
- 已通过或已拒绝的作品仍可打开内容、版本历史和审核记录；只有“审核中”才显示批准/驳回按钮。
- 管理员可对作品执行下架/恢复；下架不会破坏版本和审核历史。
- 作者会在“我的作品”直接看到管理员的下架原因与时间；已发布作品必须先下架，之后作者才可以永久删除自己的项目。
- 管理员拥有独立的“永久删除”操作。永久删除会先清理 R2 中该项目所有版本的 bundle、manifest 与封面，确认对象存储清理成功后再删除 D1 项目记录；版本、审核、点赞、收藏、举报等关联记录随数据库外键级联清理。
- 审核详情同时显示统一管理员审计日志，驳回时必须填写原因。

可在加载脚本前覆盖 API：

```js
window.ReincarnationWorkshopConfig = {
  apiBase: 'http://127.0.0.1:8787',
};
```

当前公共接口：

```js
ReincarnationWorkshop.open();
ReincarnationWorkshop.close();
await ReincarnationWorkshop.refresh();
await ReincarnationWorkshop.login();
await ReincarnationWorkshop.logout();
await ReincarnationWorkshop.getSession();
await ReincarnationWorkshop.listInstalled();
await ReincarnationWorkshop.cacheProject(projectId);
await ReincarnationWorkshop.checkProjectUpdate(projectId);
await ReincarnationWorkshop.preflightProject(projectId);
await ReincarnationWorkshop.applyProject(projectId);
await ReincarnationWorkshop.inspectProjectInstallation(projectId);
await ReincarnationWorkshop.repairProjectInstallation(projectId);
await ReincarnationWorkshop.uninstallProject(projectId);
const exported = await ReincarnationWorkshop.exportProject(projectId);
await ReincarnationWorkshop.importProject(file);
await ReincarnationWorkshop.checkWorkshopUpdate();
await ReincarnationWorkshop.updateWorkshopLoaderLink();
```

“下载到本地”和“安装到酒馆”仍然是两个动作：前者只更新 IndexedDB 缓存，不执行脚本；后者才通过 Tavern Helper API 修改酒馆资源并启用属于该作品的脚本。`data` artifact 目前只允许缓存，不会直接写入酒馆。

UI 组件不得绕过 service/installer 层直接修改酒馆数据。


## 架构回审

三个参考对象的吸收情况、明确不照搬的部分和后续优先级记录在 [ARCHITECTURE.md](./ARCHITECTURE.md)。
