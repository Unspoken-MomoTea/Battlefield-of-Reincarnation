# 辅助计算模块

## 目标

将原 `script/辅助计算脚本.js` 纳入与世界推进、状态栏一致的组件生命周期管理。

交付模式：

```
src/Calculator/**
        ↓
python tools/build-calculator.py
        ↓
script/辅助计算脚本.js
        ↓
calculator-vX.Y.Z
```

辅助计算仍保持酒馆单文件兼容，但开发源码、版本管理、创意工坊更新均独立管理。
