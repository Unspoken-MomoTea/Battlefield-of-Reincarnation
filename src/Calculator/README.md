# Calculator

`src/Calculator/` 是辅助计算脚本的唯一开发源码。

酒馆仍只加载单文件交付物：

```text
script/辅助计算脚本.js
```

该文件由：

```bash
python tools/build-calculator.py
```

按固定顺序生成；CI 使用 `--check` 阻止直接修改生成文件。

## 源码职责

- `core/CalculatorFoundation.part.js`：版本、宿主窗口、Runtime 生命周期与热更新预清理。
- `core/CalculatorLogic.part.js`：现有辅助计算业务规则，行为从原交付脚本原样迁入。
- `core/CalculatorBootstrap.part.js`：MVU 订阅、加载标记与退出清理。

正式版本使用独立不可变 Tag：

```text
calculator-vX.Y.Z
```

正式安装只保留一个版本化 loader，之后由创意工坊“修复”页改写 Tag 并安全热重载。测试 main 必须显式配置 `calculatorUpdateChannel: 'testing'` 与 `calculatorUpdateRef: 'main'`。


首个正式 loader：

```js
(async () => {
  await import(
    'https://cdn.jsdelivr.net/gh/Unspoken-MomoTea/Battlefield-of-Reincarnation@calculator-v1.0.0/script/辅助计算脚本.js'
  );
})();
```

之后由创意工坊原位把 Tag 改写为新的 `calculator-vX.Y.Z`，不需要玩家维护第二套地址。
