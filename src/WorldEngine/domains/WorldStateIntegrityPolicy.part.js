    class WorldStateIntegrityPolicy {
        constructor(patchPolicy,timePolicy,rumor){
            this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;
            this.timePolicy=timePolicy||DEFAULT_WORLD_TIME_POLICY;
            this.rumor=rumor||DEFAULT_WORLD_RUMOR_SERVICE;
        }

        validate(stat) {
            const state=stat.世界[PATH];
            for(const [category,template] of Object.entries(RECORDS)){
                if(!plain(state[category])||Object.keys(state[category]).length>300)throw new Error(category+'记录过多或结构错误');
                for(const [name,value] of Object.entries(state[category])){
                    if(forbidden.has(name))throw new Error('非法记录名');
                    this.patchPolicy.checkRecord(value,template,DETAILS[category]);
                    this.patchPolicy.checkDetails(value,DETAILS[category]);
                }
            }
            for(const [name,event] of Object.entries(state.事件)){
                if(!['待发生','进行中','已完成','已取消'].includes(event.状态))throw new Error('非法事件状态：'+name+' = '+String(event.状态||'空')+'；只允许 待发生/进行中/已完成/已取消');
                if(!EVENT_CATEGORIES.has(event.分类))throw new Error('非法事件分类：'+name+' = '+String(event.分类||'空'));
                const parents=Array.isArray(event?.前因)?event.前因.filter(Boolean):[];
                if(parents.includes(name))throw new Error('事件前因非法自引用：'+name+'；前因不能引用事件自身，无明确前因请使用 []');
                const missing=parents.filter(id=>!Object.hasOwn(state.事件,id));
                if(missing.length)throw new Error('事件前因不存在：'+name+' <- '+missing.join('、')+'；前因只能引用已经存在，或本轮同时提交且成功建立的事件名称；当前阶段/自然语言原因不能作为前因，无明确前因请使用 []');
            }
            const calendar=plain(stat.世界?.历法)?stat.世界.历法:{};
            const monthDays=Array.isArray(calendar.月份天数)?calendar.月份天数:[];
            if(monthDays.length>24||monthDays.some(n=>!Number.isInteger(Number(n))||Number(n)<1||Number(n)>99))throw new Error('世界历法月份天数无效');
            const hasMonthDay=value=>/\d{1,2}\s*月\s*-?\s*\d{1,2}\s*日/.test(String(value||''));
            if(monthDays.length&&hasMonthDay(stat.世界.时间)&&!this.timePolicy.calendarDate(stat.世界.时间,calendar))throw new Error('世界时间违反历法月长：'+stat.世界.时间);
            if(monthDays.length){
                for(const [name,event] of Object.entries(state.事件)){
                    for(const value of [event.时间,event.开始时间,event.结束时间]){
                        if(hasMonthDay(value)&&!this.timePolicy.calendarDate(value,calendar))throw new Error('事件日期违反世界历法：'+name+' = '+value);
                    }
                }
            }
            const range=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
            for(const [name,item] of Object.entries(stat.世界.势力||{}))if(!QUALITY_RANKS.includes(item.实力)||!range(item.声望,-5000,10000))throw new Error('势力品质或声望越界：'+name+'，实力='+String(item.实力)+'，声望='+String(item.声望)+'；实力只允许 '+QUALITY_RANKS.join('/')+'，声望范围 -5000~10000');
            for(const [name,item] of Object.entries(stat.世界.探索||{}))if(!QUALITY_RANKS.includes(item.风险)||!range(item.探索度,0,100))throw new Error('探索品质或进度越界：'+name+'，风险='+String(item.风险)+'，探索度='+String(item.探索度)+'；风险只允许 '+QUALITY_RANKS.join('/')+'，探索度范围 0~100');
            for(const item of Object.values((stat.世界.因果轨道||{}).偏移记录||{}))if(!range(item.影响程度,-100,120))throw new Error('因果偏移越界');
            for(const item of Object.values(stat.关系列表||{}))if(!range(item.好感度,-100,100))throw new Error('人物好感越界');
            for(const item of Object.values((stat.任务||{}).列表||{}))if(!['进行中','可交付','可结算','失败'].includes(item.状态))throw new Error('任务状态无效');
            for(const item of Object.values((stat.任务||{}).副本成就||{}))if(!['未达成','已达成'].includes(item.状态))throw new Error('成就状态无效');
            this.rumor.validatePublicState(stat);

            const visiting=new Set(),visited=new Set();
            const visit=name=>{
                if(visiting.has(name))throw new Error('事件前因形成循环');
                if(visited.has(name))return;
                visiting.add(name);
                state.事件[name].前因.forEach(visit);
                visiting.delete(name);
                visited.add(name);
            };
            Object.keys(state.事件).forEach(visit);
            for(const category of ['人物','势力地区','传播']){
                for(const record of Object.values(state[category]))if(record.关联事件.some(id=>!Object.hasOwn(state.事件,id)))throw new Error('关联事件不存在');
            }
        }
    }

    const DEFAULT_WORLD_STATE_INTEGRITY_POLICY=new WorldStateIntegrityPolicy(DEFAULT_WORLD_PATCH_POLICY,DEFAULT_WORLD_TIME_POLICY,DEFAULT_WORLD_RUMOR_SERVICE);
