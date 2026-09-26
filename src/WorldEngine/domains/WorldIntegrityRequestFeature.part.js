    class WorldIntegrityRequestFeature extends WorldRequestFeature {
        async afterBuildRequest(request,_base){
            request.manifest=request.manifest||{};
            request.manifest.因果与时间约束={
                启用:true,
                因果偏移处理:'仅重大世界级变化时维护；无变化则省略',
                单条建议范围:'-12~-1 / +1~+15',
                宏观事实时间:'同一自然日允许；跨日未来拒绝',
                人物精确时间:'仅双方均为 HH:mm 时精确比较'
            };
            return request;
        }
    }
