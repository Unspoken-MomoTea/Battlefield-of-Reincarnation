# Opening modules

新版开局的模块化核心。旧的 `Regular/开局.html` 会分阶段迁移到这里，迁移期间保持现有开局可用。

## Character assets

`character-assets/schema.js` 定义角色资产用途：

- `world_character`：世界书人物
- `opening_character`：开局角色
- `opening_partner`：开局伙伴
- `heretic`：异端库角色快照

异端快照只保存可重算的原始构筑与人设，不保存最终属性、真属性、HP/EP，也不保存道具、货币、权限、任务或世界状态。

## Opening store

`store/provider-registry.js` 是开局商店的扩展边界。核心商店和未来创意工坊内容都通过 provider 提供 catalog，开局 UI 不直接依赖某个工坊实现。


## Hot update preview

Opening is now an independent hot-update component rooted in `src/opening/`.

- Version source: `src/opening/version.js`
- Component metadata: `src/opening/hot-update/component.js`
- Current preview source: `Regular/开局.html`
- Stable tag namespace reserved for later: `opening-vX.Y.Z`

During the preview stage, both Worker environments resolve Opening from `main` by the latest commit that changed `Regular/开局.html`. The fixed shell URL is:

```js
var url = 'https://workshop.6661816.xyz/opening/latest';
```

The Worker returns a `302` with `Cache-Control: no-store` to an immutable jsDelivr URL pinned to the exact 40-character commit SHA, for example:

```text
https://cdn.jsdelivr.net/gh/Unspoken-MomoTea/Battlefield-of-Reincarnation@<sha>/Regular/%E5%BC%80%E5%B1%80.html?v=<short-sha>
```

This means the regex shell address does not change, while each Opening build receives a different immutable CDN URL. After the first formal Opening release, production can switch from `testing/main` to `stable/opening-vX.Y.Z` without changing the shell again.
