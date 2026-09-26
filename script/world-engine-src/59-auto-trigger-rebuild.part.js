    // 自动推进触发重构：正文完成是主入口；变量重处理只恢复已确认结果，不重新调用世界 AI。
    const WORLD_REPLAY_VERSION=1;
    const WORLD_REPLAY_SCOPES=[
        ['世界','货币'],['世界','历法'],['世界',PATH],['世界','因果轨道'],['世界','势力'],['世界','探索'],
        ['世界','异端雷达','名单'],['世界','稳定'],['传闻'],['资产'],['关系列表']
    ];
    // 调度与 replay 生命周期由 WorldAutoProgressController / WorldReplayService 组合。\n