    // 角色管理只编辑世界推进自己的 世界.后台.人物 活动记录；正式人物档案仍由状态栏负责。
    function worldPersonValidateRecord(stat,name,record) {
        if(!plain(record))throw new Error('世界活动记录无效：'+name);
        const backend=worldEditorBackend(stat),events=backend.事件||{};
        for(const eventName of record.关联事件||[])if(!Object.hasOwn(events,eventName))throw new Error('关联事件不存在：'+eventName);
    }
