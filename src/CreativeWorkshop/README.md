# 轮回战场创意工坊客户端

第一阶段目标是先建立稳定的宿主边界，而不是一次把所有功能堆进来。

当前入口：`src/CreativeWorkshop/index.js`

加载后会：

- 在最高可访问的 SillyTavern 页面挂载一个轻量工坊面板。
- 暴露 `window.ReincarnationWorkshop` 公共接口。
- 默认连接 `https://workshop.6661816.xyz`。
- 通过 Discord OAuth 登录，登录态仅保存在浏览器 IndexedDB。
- 不向创意工坊内容开放任意 JavaScript 执行权限。

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
```

后续项目浏览、上传、审核、安装、更新均应继续通过受控 service 层接入，不允许 UI 组件绕过权限边界直接修改酒馆数据。
