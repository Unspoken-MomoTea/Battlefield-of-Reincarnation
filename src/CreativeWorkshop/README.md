# 轮回战场创意工坊客户端

当前阶段已经跑通“登录 → 浏览 → 作者上传 → 审核 → 下载 → 安装/升级/卸载”的基础闭环。

当前入口：`src/CreativeWorkshop/index.js`

加载后会：

- 在最高可访问的 SillyTavern 页面挂载一个轻量工坊面板。
- 暴露 `window.ReincarnationWorkshop` 公共接口。
- 默认连接 `https://workshop.6661816.xyz`。
- 通过 Discord OAuth 登录，登录态仅保存在浏览器 IndexedDB。
- 不向创意工坊内容开放任意 JavaScript 执行权限。
- “发现”页可浏览、搜索并查看服务端已审核作品。
- “本地”页使用 IndexedDB 保存下载的 bundle、缓存版本和已应用版本。
- 世界书安装到共享世界书“轮回战场·创意工坊”，条目写入来源标记，卸载只删除对应作品条目。
- 正则安装为当前角色卡局部正则，并使用项目命名空间 ID，卸载不会删除玩家自己的正则。
- 预设名称会附带项目 ID 与 artifact 序号命名空间，避免两个同名作品互相覆盖。
- 安装过程带快照；任一步骤失败会回滚已经发生的世界书、正则、预设修改。
- 世界书/正则记录安装目标角色，切换到其他角色时会阻止误更新、误卸载。
- Discord 登录后可创建作品、上传新版本并提交审核。
- 混合包作者可直接上传一个完整的 `bundle v1` JSON，一次携带世界书、正则、预设和数据 artifact。
- 本地页检查到新版本后，可直接“下载最新版并重新应用”，无需返回发现页手工重复操作。
- 管理员账号会出现“审核”页，可批准或驳回待审核版本。

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
await ReincarnationWorkshop.applyProject(projectId);
await ReincarnationWorkshop.uninstallProject(projectId);
```

“下载到本地”和“安装到酒馆”仍然是两个动作：前者只更新 IndexedDB 缓存，后者才通过 Tavern Helper API 修改酒馆资源。`data` artifact 目前只允许缓存，不会直接写入酒馆。

UI 组件不得绕过 service/installer 层直接修改酒馆数据。
