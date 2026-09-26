    // 恢复包可靠性：世界推进成功后主动持久化 replay，不再依赖 replaceMvuData 是否触发可用的 VARIABLE_UPDATE_ENDED。
    // 对旧楼若 replay 缺失，优先用本次重处理事件的 before/已处理楼层恢复；实在无旧状态时按自动推进开关决定是否立即重建。
        // Phase 5: replay 持久化运行时已迁移到 src/WorldEngine/runtime/WorldReplayPersistenceFeature.part.js。
