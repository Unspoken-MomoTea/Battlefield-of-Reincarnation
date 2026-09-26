    class WorldSoftMaintenanceFeature extends WorldRequestFeature {
        async afterBuildRequest(request,_base){
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            if(plain(payload?.传闻维护?.公开传闻)){
                for(const category of RUMOR_PUBLIC_CATEGORIES){
                    const item=payload.传闻维护.公开传闻[category];
                    if(item&&Number(item.当前数量)===0)item.为空补足=1;
                }
            }
            payload.验收策略={
                模式:'分级验收',
                硬错误:'Schema、非法状态、因果引用损坏、明确时间轴冲突',
                软维护:'事件排期补全、传闻补齐、传播复核；可跨轮渐进完成，不得拖死整轮'
            };
            request.input=JSON.stringify(payload,null,2);
            request.manifest=Object.assign({},request.manifest,{
                验收策略:{模式:'分级验收',事件因果锚点可接受:true,传闻补齐:'软维护'}
            });
            return request;
        }
    }
