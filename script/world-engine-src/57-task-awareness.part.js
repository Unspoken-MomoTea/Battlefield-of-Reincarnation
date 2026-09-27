    // 任务感知层：任务.列表是现有 MVU 的唯一正式任务账簿；世界引擎只读消费，不建立第二套后台任务库。
    const TASK_AWARENESS_RULES=`【任务感知 · 只读】
任务列表是世界因果来源之一。世界推进不得创建、删除或修改任务，也不得推进任务状态、交付、结算或奖励；任务影响只通过事件、人物行动、势力地区、探索与传播表现。事件可用“关联任务”引用当前任务.列表中已存在的任务名，作为因果来源；禁止引用不存在的任务。
情报交易由世界引擎生成或刷新；购买、扣款、消费性删除及购买后创建任务由MVU/变量AI处理，世界引擎下一轮只读接续。副本成就、击杀、奖励与惩罚不进入世界推进上下文。`;
    const TASK_WORLD_BOOK_TITLE='任务与委托系统';
    // 旧版曾把正式任务规则从内置默认资料中排除；现在恢复为可读取的权威规则。
    BUILTIN_DEFAULT_WORLD_BOOK_EXCLUSIONS.delete(TASK_WORLD_BOOK_TITLE);

    // 任务只读投影与事件关联校验已迁移至 WorldTaskAwarenessService。\n\n    // 请求、世界书目录恢复已迁移至 WorldTaskAwarenessFeature。
