# StatusBar

`src/StatusBar/` 是主神终端 / 悬浮球状态栏的唯一开发源码。

酒馆继续只加载单文件交付物：

```text
script/悬浮球状态栏.js
```

该文件由：

```bash
python tools/build-status-bar.py
```

从 `src/StatusBar/**/*.part.js` 按固定顺序生成。CI 使用 `--check` 阻止直接修改生成文件后忘记同步源码。

## 目录职责

- `core/StatusBarFoundation.part.js`：宿主窗口、MVU 读写、主题基础、运行时生命周期与版本信息。
- `ui/StatusBarStyles.part.js`：终端全部 CSS / 主题样式。
- `ui/StatusBarShell.part.js`：浮球、面板、弹窗 DOM 壳。
- `domains/StatusBarBloodFusion.part.js`：血统融合流程。
- `domains/StatusBarTransferLoot.part.js`：队友转移与遗物获取。
- `ui/StatusBarEventBindings.part.js`：主 UI、编辑器、头像交互事件。
- `settings/StatusBarSettings.part.js`：API、变量更新模式、主题与终端设置。
- `ui/StatusBarRenderer.part.js`：主面板与各业务 Tab 渲染。
- `ui/StatusBarDetailsEditor.part.js`：详情弹窗和编辑组件。
- `shop/StatusBarShopCatalog.part.js`：商城数据归一化、角色商库与权限。
- `shop/StatusBarShopView.part.js`：商城市场 UI。
- `shop/StatusBarShopTransaction.part.js`：购物车、交易写回与小票。
- `shop/StatusBarShopAi.part.js`：商城 AI 请求、YAML 解析与刷新。
- `domains/StatusBarActions.part.js`：形态、传闻、保存等写回动作。
- `core/StatusBarBootstrap.part.js`：终端 API 暴露、事件订阅与启动。

本轮先完成“零行为拆分 + 生命周期收口”：不改现有业务规则，把 58 万字符单文件拆为明确职责的开发源，并新增 `StatusBarRuntimeLifecycle` 管理事件订阅，保证后续 loader 管理后的热重载不会重复注册 MVU / 酒馆事件。

## 版本与热更新

状态栏正式版本使用独立命名空间：

```text
status-bar-vX.Y.Z
```

当前源码版本由 `STATUS_BAR_VERSION` 提供。创意工坊“修复”页负责检测状态栏安装形态、把旧式内联脚本迁移为版本 loader、写入新版本链接，并在 loader 管理的新版运行时安全时尝试热重载。

正式安装与世界推进一样只保留一个版本化入口；首个正式版为：

```js
(async () => {
  await import(
    'https://cdn.jsdelivr.net/gh/Unspoken-MomoTea/Battlefield-of-Reincarnation@status-bar-v1.0.0/script/悬浮球状态栏.js'
  );
})();
```

以后不需要玩家手工更换第二套地址；创意工坊更新状态栏时直接把这个 loader 的 Tag 改写到新的 `status-bar-vX.Y.Z`。

测试状态栏必须显式配置：

```js
window.ReincarnationWorkshopConfig = {
  statusBarUpdateChannel: 'testing',
  statusBarUpdateRef: 'main',
};
```

默认仍走正式 `status-bar-v*`，不会因为创意工坊自身处于 testing/main 就自动把测试状态栏推给用户。

`v1.0.2` 起，左侧 Tab 轨道始终保留可见的滚动轨道、上下边缘渐隐与底部轻量下拉提示；鼠标悬停时滚动条会强调。按钮未溢出时不制造假的空白回弹，真正超出高度后使用原生纵向滚动，并保持 `.sam-tab-rail` / `.sam-tab-btn` / `data-tab` 扩展挂载约定不变。
