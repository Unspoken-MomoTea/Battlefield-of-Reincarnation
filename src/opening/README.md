# Opening / 开局系统

开局采用 **模块化源码 + 单文件交付产物**。用户继续使用固定地址：

```js
var url = 'https://workshop.6661816.xyz/opening/latest';
```

源码边界：
- `page/template.html`：页面骨架。
- `styles/core.css`、`styles/extra.css`：页面样式。
- `runtime/00-70*.js`：数据库、资产读取、变量模式、角色、商店、伙伴/剧情、导航/预设、最终降临。
- `character-assets/`：工坊开局角色/伙伴资产；伙伴资产的 `build.好感度` 默认 0、`build.是否队友` 默认 true，并在最终降临时写入 `stat_data.关系列表`。
- `store/`：核心与工坊商店。
- `hot-update/`：Opening 独立热更新元数据。

`tools/build-opening.py` 生成两份字节一致的产物：
- `dist/opening/entry.html`：`/opening/latest` 实际交付文件。
- `Regular/开局.html`：旧入口兼容副本。

CI 使用 `python tools/build-opening.py --check` 防止源码与产物漂移。页面与产物均禁止 Markdown 代码围栏。

测试通道跟随 `main` 上最近一次修改 `dist/opening/entry.html` 的提交；Worker 再重定向到固定 SHA 的 jsDelivr：

```text
https://cdn.jsdelivr.net/gh/Unspoken-MomoTea/Battlefield-of-Reincarnation@<sha>/dist/opening/entry.html?v=<short-sha>
```

正式通道只接受 `opening-vX.Y.Z` 标签，并校验标签版本与 `src/opening/version.js` 一致。
