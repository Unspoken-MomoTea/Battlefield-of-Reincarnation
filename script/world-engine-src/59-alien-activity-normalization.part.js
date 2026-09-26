    // 活跃异端的人物筛选、热投影、补种、复核与时间戳策略已归入 WorldPersonActivityService。
    // 这里仅保留 compileWorldResult 的兼容装饰 seam，等待剩余 compile decorator 全部类化后统一删除。
    const compileWorldResultBeforeAlienActivityNormalization=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.normalizeAlienActivityTimestamps(stat,value);
        return compileWorldResultBeforeAlienActivityNormalization(stat,result);
    };
