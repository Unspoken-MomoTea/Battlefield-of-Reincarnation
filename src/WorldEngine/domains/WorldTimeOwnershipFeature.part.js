    class WorldTimeOwnershipFeature extends WorldRequestFeature {
        constructor(engine){super(engine);}
        async afterBuildRequest(request,base){
            try{
                const payload=JSON.parse(request.input),needsInitialization=worldTimeUnset(base?.stat?.世界?.时间);
                payload.世界时间维护={
                    当前时间:String(base?.stat?.世界?.时间||''),
                    是否需要初始化:needsInitialization,
                    所有权:'世界推进独占写入；变量 AI 只读',
                    初始化锚定:needsInitialization?{
                        任务世界:String(base?.stat?.世界?.名称||''),
                        当前阶段:String(base?.stat?.世界?.因果轨道?.当前阶段||''),
                        当前地点:String(base?.stat?.世界?.地点||''),
                        依据顺序:['最新已确认正文','当前阶段与当前地点','已读取时间线/年表/章节资料','模型已有原著知识','谨慎推断'],
                        禁止:'不得把下一宏观节点、任务期限或未来事件的日期直接当成当前世界时间；无法唯一定位时保持较粗时间精度。'
                    }:undefined,
                    正文时间职责:'若最新正文明确发生过夜、数小时后、次日、跨日旅行或新的日期/时段，必须输出顶层“时间”同步世界时钟；不能保留旧时钟再提交已经发生于新时点的事实。',
                    精确日期格式:'顶层时间及所有事件/历史/传播等日期，只要精确到月日就使用 {yyy}年-{mm}月-{dd}日-{时间段}。月份必须是数字；不要用自定义月份名称替代数字月。',
                    时间段候选:['凌晨','黎明','清晨','早晨','上午','中午','午后','下午','傍晚','入夜','晚上','深夜'],
                    推进原则:'时间段是粗粒度锚点，不是每轮计数器；没有足够时间流逝跨过当前时段就保持原值，只有正文或明确时间资料表明确实经过合理时长才推进。'
                };
                request.input=JSON.stringify(payload,null,2);
            }catch(_){}
            request.schema=copy(WORLD_RESULT_SCHEMA);
            if(request.manifest)request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema);
            return request;
        }
        afterReplayVariableEvent(variables,before,handled){
            const e=this.engine;
            if(handled||e.committing||!e.isEnabled()||!plain(variables?.stat_data)||!plain(before?.stat_data))return handled;
            const previous=String(before?.stat_data?.世界?.时间??''),incoming=String(variables?.stat_data?.世界?.时间??'');
            if(previous===incoming)return handled;
            const wasSpace=before?.stat_data?.系统状态?.是否在主神空间===true,isSpace=variables?.stat_data?.系统状态?.是否在主神空间===true;
            if(wasSpace!==isSpace){
                const enteringWorld=wasSpace&&!isSpace,returningToSpace=!wasSpace&&isSpace;
                const mainSpaceTime=/^轮回历\d+年-\d{2}月-\d{2}日-(?:凌晨|黎明|清晨|早晨|上午|中午|午后|下午|傍晚|入夜|晚上|深夜)$/.test(incoming);
                if((enteringWorld&&worldTimeUnset(incoming))||(returningToSpace&&mainSpaceTime))return handled;
            }
            if(!plain(variables.stat_data.世界))variables.stat_data.世界={};
            variables.stat_data.世界.时间=previous;
            return true;
        }
    }
