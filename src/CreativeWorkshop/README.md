# 轮回战场创意工坊客户端

当前阶段先把“登录 → 浏览 → 作者上传 → 审核 → 下载到本地缓存”的完整链路跑通，再接入对酒馆世界书/正则/预设的实际安装。

当前入口：`src/CreativeWorkshop/index.js`

加载后会：

- 在最高可访问的 SillyTavern 页面挂载一个轻量工坊面板。
- 暴露 `window.ReincarnationWorkshop` 公共接口。
- 默认连接 `https://workshop.6661816.xyz`。
- 通过 Discord OAuth 登录，登录态仅保存在浏览器 IndexedDB。
- 不向创意工坊内容开放任意 JavaScript 执行权限。
- “发现”页可浏览、搜索并查看服务端已审核作品。
- “本地”页使用 IndexedDB 保存下载的 bundle 和版本信息。
- Discord 登录后可创建作品、上传新版本并提交审核。
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
```

目前“下载到本地”只代表缓存到 IndexedDB，不等于已经写入 SillyTavern。下一阶段的安装器会按 artifact 类型通过受控 service 层调用 Tavern Helper 的世界书、正则和预设 API，并记录可回滚的安装状态。

UI 组件不得绕过 service/installer 层直接修改酒馆数据。
