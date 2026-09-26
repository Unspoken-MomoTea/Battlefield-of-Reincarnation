    // 所有会进入 AI 请求（system 或 user 指令字段）的可编辑文本模板。
    const WORLD_PROMPT_RUNTIME_DEFAULTS=Object.freeze({
        inputWorldbookSemantics:'可选设定/原著差异/时间资料；不是已发生事实，没有世界书也必须正常推演。',
        inputCurrentStateSemantics:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期因果偏移，以及“近期原始锚点 + 更早根总结”组成的分层长期历史记忆。原始历史永久留在MVU，已被上层总结收纳的旧节点不再重复进入热上下文。资产通过WorldResult.资产与同一顶层账簿双向同步；未提供的任务/商城/纯结算数据不属于本引擎职责。',
        inputProseSemantics:'已经演出的剧情；用于确认当前事实与时间跨度，不复述成后台日常。',
        inputStructureRepairSemantics:'引擎已做的确定性纠正；不得在输出中恢复被程序降级/修正的旧错误。',
        inputTimelineSemantics:'程序计算出的宏观边界与到期复核要求；模型负责语义推演，不重定义调度协议。',
        inputWorldResultSemantics:'唯一业务交付物；不包含 JSON Pointer、add/replace 路径或程序日志。',
        inputCharacterAuditSemantics:'若提供NPC构筑审计，只处理列出的既有NPC缺口；完整构筑资料只在审计对象中提供，避免全量NPC重复占用上下文。',
        proseProjectionRule:'非战斗正文会读取完整因果轨道：当前阶段用于当前局势，故事线/下一节点用于长期叙事方向，偏移记录用于跨章因果记忆；这些是规划依据，不等于角色预知或自动知晓幕后信息。正文还会读取进行中当前事件的公开字段，以及程序筛选的场外场景：每个热地区只出现一次共享环境/现场群体，人物列表只携带各自行动事实，关联事件只作索引；活跃异端始终保留在其所在热场景。以上均用于叙事连续性，不代表角色已知。可能影响当前场景的当前事件应维护公开征兆和可见影响；不要把隐藏条件、默认走向或未来宏观事件详情塞进公开字段。',
        requestFinalNote:'当前变量为已确认热事实，不重复结算；已归档旧事件和已回收传播不要重新创建；世界书为空不构成阻塞；只提交业务事实，存储路径由程序编译。',
        macroPlanning:'本轮必须补齐骨架，不能以时间未推进、正文没有宏观变化或无业务变化为由省略。建立待发生节点属于未来规划，可排在下一宏观边界之后，不表示事件现在发生；近期细节与已发生事实仍受本轮时间容量和下一宏观边界限制。不得为凑数提前原著日期，或预先结算未来事件的结果；更新时间使用当前世界时间。',
        macroAcceptance:'按已有状态与本轮结果合并后计数；若本轮结束或取消已有宏观节点，须补足被移出窗口的数量。重试时以已接受业务结果和最新补充清单为准，不重复创建已接受节点。',
        alienReview:'仅因本轮触发复核才需要在 WorldResult.人物 中提交该活跃异端的新活动；至少给出非空地点、目标、行动。人物更新时间无需抄写，由程序使用本轮最终世界时间统一记录。未获得新情报时沿用既有目标/行动，不得因为模型看见<user>行为就自动追踪或改策；若因<user>行为改变目标/行动，必须已有认知或同轮写入可追溯的认知/认知来源。若本轮已确认死亡，则只把异端状态更新为死亡。',
        dueEventReview:'软提醒：该事件已到计划/复核时间。条件与前因满足则转为进行中；若暂不发生，可保持待发生并优先填写新的“下次检查”。“条件”只表示事件触发条件，不要改写成延期阻碍。未处理不会导致本轮世界推进被驳回。',
        retryAcceptedWithPlan:'严格按“补充清单”只补充或修正未通过的业务片段。已接受业务结果已经通过本地验收，默认全部保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。',
        retryAccepted:'只补充或修正导致拒绝的业务片段。已接受业务结果默认保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。',
        retryFresh:'修正格式或业务错误后重新输出一个 WorldResult JSON；不要解释错误，不要输出存储路径。',
        taskCurrentStateSemantics:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期历史、近期因果偏移，以及任务.列表的只读因果字段。任务奖励、惩罚、副本成就、击杀、商城与纯结算数据不进入世界推进。',
        taskListSemantics:'只读因果账本。事件可通过关联任务引用已存在任务；不得创建、删除、改状态、交付或结算任务。',
        worldActivityPayload:'异端不能作为本轮唯一变化；至少推进事件、势力地区或普通人物中的一项非异端实质变化。\n若地区为空：建立至少1个与当前地点/阶段相关的地区。\n若势力为空：建立至少1个当前真实相关的势力/组织；同名提交 WorldResult.势力（实力/领地/描述/声望）与 WorldResult.势力地区（类型=势力的动态现场）。\n若没有进行中的非宏观事件：建立至少1个正在发生的当前事件/近期节点。\n只改更新时间/下次检查、重复原值或只新增待发生宏观节点不算实质变化。'
    });
    let WORLD_PROMPT_RUNTIME_VALUES={...WORLD_PROMPT_RUNTIME_DEFAULTS};
    function worldPromptRuntimeSync(values){
        const source=plain(values)?values:{};
        WORLD_PROMPT_RUNTIME_VALUES={...WORLD_PROMPT_RUNTIME_DEFAULTS,...Object.fromEntries(Object.entries(source).filter(([key,value])=>Object.hasOwn(WORLD_PROMPT_RUNTIME_DEFAULTS,key)&&typeof value==='string'))};
        return WORLD_PROMPT_RUNTIME_VALUES;
    }
    function worldPromptRuntimeValue(key,fallback=''){
        const value=WORLD_PROMPT_RUNTIME_VALUES?.[key];
        return typeof value==='string'?value:String(fallback??'');
    }
    function worldPromptRuntimeLines(key,fallback=''){
        return worldPromptRuntimeValue(key,fallback).split(/\n+/).map(line=>line.trim()).filter(Boolean);
    }
