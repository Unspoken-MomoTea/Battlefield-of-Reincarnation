    const SamsaraWorldEngineBeforeRumorWorldSource=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeRumorWorldSource{
        async buildRequest(base){
            const request=await super.buildRequest(base);
            const maintenance=rumorMaintenanceRequirements(base?.stat||{});
            const payload=JSON.parse(request.input);
            payload.传闻维护=Object.assign({},payload.传闻维护||{}, {
                取材边界:'只使用世界侧可传播事实、已有传播链与既有公开传闻；正文不是直接传播源',
                本轮公开传闻动作:maintenance.本轮公开传闻动作,
                刷新原因:copy(maintenance.刷新原因||[]),
                世界侧可传播事实:copy(maintenance.世界侧可传播事实||[]),
                本轮新公开事实:copy(maintenance.本轮新公开事实||[])
            });
            delete payload.传闻维护.当前地点;
            delete payload.传闻维护.可传播候选事件;
            request.input=JSON.stringify(payload,null,2);
            request.rumorMaintenance=copy(maintenance);
            request.manifest=request.manifest||{};
            request.manifest.传闻节流={模式:'世界侧事实驱动',本轮动作:maintenance.本轮公开传闻动作,刷新原因:copy(maintenance.刷新原因||[]),正文直接取材:false,软失败不重试:true};
            return request;
        }
    };
