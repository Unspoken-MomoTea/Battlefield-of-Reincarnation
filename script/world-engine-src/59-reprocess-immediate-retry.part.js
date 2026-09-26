    // 变量重处理缺少 replay 时，直接使用 VARIABLE_UPDATE_ENDED 传入的 variables 重新推进；不等待 MVU 二次落盘。
        // Phase 5: 变量重处理即时重试已迁移到 src/WorldEngine/runtime/WorldImmediateReprocessRetryFeature.part.js。
