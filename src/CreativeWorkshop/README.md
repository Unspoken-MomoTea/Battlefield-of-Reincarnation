# 轮回战场创意工坊客户端

当前阶段已经跑通“登录 → 浏览 → 作者上传 → 审核 → 下载 → 安装/升级/卸载”的基础闭环。

当前入口：`src/CreativeWorkshop/index.js`

发布环境与 testing / stable 提升流程见 [RELEASE.md](./RELEASE.md)。

加载后会：

- 在最高可访问的 SillyTavern 页面挂载一个轻量工坊面板。
- 暴露 `window.ReincarnationWorkshop` 公共接口。
- 默认连接 `https://workshop.6661816.xyz`。
- 通过 Discord OAuth 登录，登录态仅保存在浏览器 IndexedDB。
- 下载、浏览和审核阶段不会执行作品中的 JavaScript；只有玩家主动点击安装后，声明为“酒馆助手脚本”的 artifact 才会写入 Tavern Helper 并启用。
- “发现”页采用工坊式卡片浏览，可在“全部 / 角色 / 扩展”之间快速切换，并按最新、热门、下载、收藏或点赞排序；列表使用服务端分页和“加载更多”，不会只显示首批 24 个作品。
- 公开作品详情不再只展示 artifact 标签/Manifest：服务端会从已审核发布 bundle 生成只读内容预览，详情页可直接阅读世界书条目正文、关键词、位置/顺序，查看正则匹配与替换内容、Tavern Helper 脚本源码，以及预设/数据摘要。
- 作品详情采用“阅读区 + 右侧信息/安装栏”结构：封面、简介、当前版本更新摘要、版本历史和具体内容位于阅读区；下载/安装/升级、点赞、收藏、下载量、依赖和“原版资源状态”集中在右侧。
- 从第二个已发布版本开始，公开详情会把当前版本与上一个已审核版本对比，显示世界书/正则/脚本的新增、修改、删除及主要变更字段；首次发布明确显示“没有上一版本可比较”。
- 点赞和收藏入口始终可见；未登录时点击会提示 Discord 登录，而不是把互动按钮整个隐藏。
- 作品详情会显示当前用户真实的点赞/收藏状态；下载后主操作会连续切换为安装、应用新版或一键升级，但仍保持“下载不执行脚本，主动安装才写入”的安全边界。
- “本地”页使用 IndexedDB 保存下载的 bundle、缓存版本和已应用版本，并用作品卡片展示封面、简介与安装状态；主操作只保留安装/更新/修复等当前最相关动作，检查安装、导出、卸载等低频操作收进更多菜单。
- 每次下载都会按服务端 manifest 校验 artifact 数量、字节数与 SHA-256，校验失败不会进入本地缓存。
- 本地作品可导出为 `.rwpack`，另一台设备可离线导入；导入时会再次执行完整哈希校验。
- IndexedDB 支持多标签页升级协调；发生 schema 升级时会主动请求其他标签页关闭旧连接，并带阻塞超时提示。
- 本地页可查看工坊逻辑存储量、浏览器站点配额，并一键清理“仅缓存”作品；已安装作品不会被误删。
- 作品可声明其他工坊项目为依赖，并指定最低版本；作者界面通过“搜索作品名称 → 选择作品 → 设置最低版本”建立关系，不再要求手填项目 ID。依赖随发布版本冻结，安装前会阻止缺失、未应用或版本不足的依赖。
- 服务器拒绝循环依赖；作者主动下架或管理员下架的作品也不能继续作为新版本依赖，避免形成不可安装关系。
- 世界书安装到共享世界书“轮回战场·创意工坊”，条目写入来源标记，卸载只删除对应作品条目。
- 正则安装为当前角色卡局部正则，并使用项目命名空间 ID，卸载不会删除玩家自己的正则。
- 酒馆助手脚本通过 ScriptTree API 安装，使用项目命名空间 ID；更新时原位替换工坊脚本，停用作品时只清理该项目拥有的脚本。
- 作品可以在 bundle 级声明“原版资源状态”：针对当前使用的原世界书条目、当前角色正则，以及 character / preset / global 酒馆助手脚本，分别选择“保持 / 启用 / 停用”。“保持”不会写入规则；“启用 / 停用”会在安装前记录完整快照，并在停用/卸载作品时恢复安装前状态。
- 世界书、正则、脚本的原版状态规则都采用安全恢复：若玩家在作品启用期间修改过原资源内容，停用时保留玩家修改，仅恢复安装前的启用/停用状态。
- 多个已安装作品对同一原资源提出相同状态要求时可以共同持有；若一个要求启用、另一个要求停用，则安装前阻止冲突，避免互相抢状态。
- 预设名称会附带项目 ID 与 artifact 序号命名空间，避免两个同名作品互相覆盖。
- “DLC 修复 / 更新”会扫描已安装作品的世界书、正则、脚本、预设，以及原世界书/原正则/原脚本状态恢复点；可对异常作品执行 Repair。
- “DLC 修复 / 更新”还能定位加载当前工坊的酒馆助手脚本，并按当前环境的更新通道改写 jsDelivr 固定 commit：测试环境跟踪 `main`，正式环境只跟踪 `workshop-stable`。客户端优先通过 Workshop Worker 的 `/api/client/latest` 获取本通道最新提交（KV 缓存），失败时也只回退查询同一 GitHub ref。
- v1.7.0 起，工坊在服务连接成功后会自动检查自身更新；若 Tavern Helper 中的工坊 loader 仍指向旧提交，会直接提示更新。确认后只重写该 loader 中本仓库的 jsDelivr commit SHA，保留 `apiBase` 与脚本内其他用户配置。
- loader 更新只负责直接覆盖 Tavern Helper 中的固定 SHA，并在写入后重新读取脚本树确认已经持久化；不会为了工坊更新刷新整个 SillyTavern。
- 为避免 Worker 的 latest KV 短暂缓存造成错误降级，只要发现“loader SHA 与服务端 latest 不一致”，客户端会额外即时核对当前通道自己的 GitHub ref。测试版只核对 `main`，正式版只核对 `workshop-stable`，正式版不会因为 main 上的测试提交出现更新提示。
- 安装前会检查同名世界书条目、残留正则/脚本 ID、同名预设与角色目标冲突；非致命冲突由玩家确认后再继续。
- 安装过程带快照；任一步骤失败会回滚已经发生的工坊世界书/正则/脚本/预设写入，以及原世界书/原正则/原脚本状态修改。
- 已安装作品可执行“检查安装”；缺失或被修改的工坊资源可一键 Repair，修复只触碰该项目拥有的资源。
- 世界书/正则记录安装目标角色，切换到其他角色时会阻止误更新、误卸载。
- Discord 登录后可创建作品、上传新版本并提交审核。
- 发布界面按作品用途切换专用编辑器：世界角色直接填写人物资料并自动生成世界书条目；开局角色/开局伙伴直接填写 Opening Asset 构筑；开局商店直接填写商品目录；只有通用扩展保留世界书 / 正则 / 酒馆助手脚本上传器。
- 角色作品可选择“世界角色 / 开局角色 / 开局伙伴”。开局角色与伙伴由表单直接生成有效 build，安装后进入共享 Opening Asset Registry，卸载/升级会同步移除或替换。
- “原版资源状态”只属于通用扩展。世界角色、开局角色、开局伙伴和开局商店均不会显示、保存或应用原版世界书 / 正则 / 脚本状态规则。
- 作者可从当前 MVU 直接发布“异端库”角色；上传会递归剔除最终属性、真属性、HP/EP，并排除道具、货币、凭证、任务、成就与世界状态，仅保留原始战斗构筑及作者补充的人设。
- 扩展作品可选择“开局商店”专用模板；表单直接生成 store_catalog 数据，安装后合并进开局商店。商品 ID 会按来源项目命名空间隔离，升级/卸载与安装事务同步回滚。
- “原版资源状态”直接嵌在发布/更新页面，不再经过第二步弹窗。默认打开“世界书”，同时提供“正则 / 酒馆助手脚本”页签；每项都能选择“保持 / 启用 / 停用”。
- 世界书资源来源与世界推进保持一致：读取当前角色主书、角色附加、当前聊天绑定和全局启用的世界书，但会把这些世界书中的“当前启用 + 当前停用”条目全部列出。条目显示当前状态、蓝灯常驻/绿灯关键词/向量化、UID/关键词，并可展开查看正文。
- 正则与酒馆助手脚本都只读取当前角色卡自身资源，不扫描当前预设或全局脚本；当前角色卡里已经停用的正则/脚本仍会显示。工坊自己安装的 `rw:` 命名空间资源，以及加载创意工坊本体的 loader 脚本都会自动隐藏，避免作品把工坊自己关掉。
- 已发布作品的“更新作品”与首次发布使用同一套编辑结构：名称、简介、标签、依赖、当前封面、上一版全部 artifact 以及上一版作者选择的原版资源状态都会自动载入。作者把某项改回“保持”即可取消上一版规则，不会因为目标目前处于停用状态而消失。
- 上传同名世界书/正则/脚本会替换上一版对应项，未修改的旧内容继续保留，不需要重新拼完整版本。
- 更新提交按“资料 → 新封面（如有）→ 新版本 → 提交审核”分步恢复；某一步失败后重试会从失败步骤继续，避免重复生成版本和 R2 文件。
- 封面文件选择后会立即本地预览；已有作品更新时默认保留当前封面，只有明确选择新图片才替换。
- 顶层作品类型只有“角色”和“扩展”；世界书、正则、酒馆助手脚本属于当前作者上传工作流的内部 artifact。
- 本地页检查到新版本后，可直接一键升级并重新应用；缓存与酒馆安装作为一个事务处理，应用失败会保留旧缓存与旧安装状态。
- 管理员账号会出现“审核”页：可查看全部已上传作品，而不只待审核作品。
- 管理页可筛选“未提交 / 审核中 / 已通过 / 已拒绝”，并显示作者、公开版本、审核人、审核意见和时间。
- 已通过或已拒绝的作品仍可打开内容、版本历史和审核记录；只有“审核中”才显示批准/驳回按钮。
- 管理员可对作品执行下架/恢复；下架不会破坏版本和审核历史。
- 作者可以主动下架/重新上架自己已经审核通过的作品；作者下架只控制公开可见性，不改变审核状态，因此下架后仍可继续更新。管理员下架是独立的审核状态，仍具有更高优先级。
- 作者会在“我的作品”直接看到管理员的下架原因与时间；已发布作品在作者主动下架或管理员下架后，才允许作者永久删除。
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

“下载到本地”和“安装到酒馆”仍然是两个动作：前者只更新 IndexedDB 缓存，不执行脚本；后者才通过 Tavern Helper API 修改酒馆资源并启用属于该作品的脚本。普通 `data` artifact 仍只缓存；只有受支持的 `opening_character`、`opening_partner` 与 `store_catalog` 会进入开局本地 Registry。

UI 组件不得绕过 service/installer 层直接修改酒馆数据。


## 架构回审

三个参考对象的吸收情况、明确不照搬的部分和后续优先级记录在 [ARCHITECTURE.md](./ARCHITECTURE.md)。
