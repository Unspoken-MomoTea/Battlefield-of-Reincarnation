# 轮回战场创意工坊客户端

当前阶段已经跑通“登录 → 浏览 → 作者上传 → 审核 → 下载 → 安装/升级/卸载”的基础闭环。

当前入口：`src/CreativeWorkshop/index.js`

加载后会：

- 在最高可访问的 SillyTavern 页面挂载一个轻量工坊面板。
- 暴露 `window.ReincarnationWorkshop` 公共接口。
- 默认连接 `https://workshop.6661816.xyz`。
- 通过 Discord OAuth 登录，登录态仅保存在浏览器 IndexedDB。
- 下载、浏览和审核阶段不会执行作品中的 JavaScript；只有玩家主动点击安装后，声明为“酒馆助手脚本”的 artifact 才会写入 Tavern Helper 并启用。
- “发现”页可浏览、搜索并查看服务端已审核作品。
- “本地”页使用 IndexedDB 保存下载的 bundle、缓存版本和已应用版本。
- 每次下载都会按服务端 manifest 校验 artifact 数量、字节数与 SHA-256，校验失败不会进入本地缓存。
- 本地作品可导出为 `.rwpack`，另一台设备可离线导入；导入时会再次执行完整哈希校验。
- IndexedDB 支持多标签页升级协调；发生 schema 升级时会主动请求其他标签页关闭旧连接，并带阻塞超时提示。
- 本地页可查看工坊逻辑存储量、浏览器站点配额，并一键清理“仅缓存”作品；已安装作品不会被误删。
- 作品可声明其他工坊项目为依赖，并指定最低版本；依赖随发布版本冻结，安装前会阻止缺失、未应用或版本不足的依赖。
- 服务器拒绝循环依赖，避免出现 A 依赖 B、B 又依赖 A 的不可安装关系。
- 世界书安装到共享世界书“轮回战场·创意工坊”，条目写入来源标记，卸载只删除对应作品条目。
- 正则安装为当前角色卡局部正则，并使用项目命名空间 ID，卸载不会删除玩家自己的正则。
- 酒馆助手脚本通过 ScriptTree API 安装，使用项目命名空间 ID；更新时原位替换工坊脚本，卸载不会删除玩家自己的脚本。
- 预设名称会附带项目 ID 与 artifact 序号命名空间，避免两个同名作品互相覆盖。
- 世界书 artifact 可声明需要关闭/替换的原版条目；安装前记录原值，卸载时仅在条目未被玩家再次修改的情况下自动恢复，避免覆盖玩家后续编辑。
- 安装前会检查同名世界书条目、残留正则/脚本 ID、同名预设与角色目标冲突；非致命冲突由玩家确认后再继续。
- 安装过程带快照；任一步骤失败会回滚已经发生的世界书、原版世界书、正则、脚本和预设修改。
- 已安装作品可执行“检查安装”；缺失或被修改的工坊资源可一键 Repair，修复只触碰该项目拥有的资源。
- 世界书/正则记录安装目标角色，切换到其他角色时会阻止误更新、误卸载。
- Discord 登录后可创建作品、上传新版本并提交审核。
- 顶层作品类型只有“角色”和“扩展”；世界书、正则、酒馆助手脚本、预设、数据都属于作品内部 artifact，不再作为作品类型。
- 两种作品都可以直接上传完整的 `bundle v1` JSON，一次携带多种 artifact；单文件上传时由作者明确选择内容类型。
- 本地页检查到新版本后，可直接一键升级并重新应用；缓存与酒馆安装作为一个事务处理，应用失败会保留旧缓存与旧安装状态。
- 管理员账号会出现“审核”页：可查看全部已上传作品，而不只待审核作品。
- 管理页可筛选“未提交 / 审核中 / 已通过 / 已拒绝”，并显示作者、公开版本、审核人、审核意见和时间。
- 已通过或已拒绝的作品仍可打开内容、版本历史和审核记录；只有“审核中”才显示批准/驳回按钮。
- 管理员可对作品执行下架/恢复；下架不会破坏版本和审核历史。
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
```

“下载到本地”和“安装到酒馆”仍然是两个动作：前者只更新 IndexedDB 缓存，不执行脚本；后者才通过 Tavern Helper API 修改酒馆资源并启用属于该作品的脚本。`data` artifact 目前只允许缓存，不会直接写入酒馆。

UI 组件不得绕过 service/installer 层直接修改酒馆数据。


## 架构回审

三个参考对象的吸收情况、明确不照搬的部分和后续优先级记录在 [ARCHITECTURE.md](./ARCHITECTURE.md)。
