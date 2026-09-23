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
