    // NPC 审计启停、Schema 派生缓存对齐与纠错 guidance 均已迁入 canonical class/service；本层只保留事件前因兼容校验。
    const validateStateBeforeActionableEventRefs=validateState;
    validateState=function(stat) {
        const events=stat?.世界?.[PATH]?.事件||{};
        if(plain(events)){
            for(const [name,event] of Object.entries(events)){
                const parents=Array.isArray(event?.前因)?event.前因.filter(Boolean):[];
                if(parents.includes(name))throw new Error('事件前因非法自引用：'+name+'；前因不能引用事件自身，无明确前因请使用 []');
                const missing=parents.filter(id=>!Object.hasOwn(events,id));
                if(missing.length)throw new Error('事件前因不存在：'+name+' <- '+missing.join('、')+'；前因只能引用已经存在，或本轮同时提交且成功建立的事件名称；当前阶段/自然语言原因不能作为前因，无明确前因请使用 []');
            }
        }
        return validateStateBeforeActionableEventRefs(stat);
    };

    // 事件前因与 Schema 纠错动作已迁移至 WorldRetryGuidanceService。\n\n    // ZOD 派生缓存对齐已迁移至 WorldNpcAuditPolicy。\n\n    // NPC 审计开关、资料同步与 UI 由 WorldNpcAuditPolicy 处理。\n