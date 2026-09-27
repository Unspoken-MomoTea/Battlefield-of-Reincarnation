    class WorldRumorRequestFeature extends WorldRequestFeature {
        constructor(engine,rumor){super(engine);this.rumor=rumor||DEFAULT_WORLD_RUMOR_SERVICE;}
        initialize(){
            const engine=this.engine;
            if(engine.config.activePromptDocumentId!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)return;
            const upgraded=this.rumor.upgradePreset(engine.config.preset);
            if(upgraded!==engine.config.preset){engine.config.preset=upgraded;engine.saveConfig();}
        }
        async afterBuildRequest(request,base){
            const maintenance=this.rumor.requirements(base?.stat||{});
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            if(Array.isArray(request.timeAnomalies))request.timeAnomalies=request.timeAnomalies.filter(item=>item?.类型!=='传闻维护');
            if(Array.isArray(payload.本轮必须修复的时间越界记录))payload.本轮必须修复的时间越界记录=payload.本轮必须修复的时间越界记录.filter(item=>item?.类型!=='传闻维护');
            payload.传闻维护={
                话题:copy(maintenance.话题||[]),
                公开传闻:copy(maintenance.公开传闻||{}),
                本轮必须复核的传播链:copy(maintenance.本轮必须复核的传播链||[]),
                取材边界:'__PROMPT_REGISTRY_RUMOR_SOURCE__',
                本轮公开传闻动作:maintenance.本轮公开传闻动作,
                刷新原因:copy(maintenance.刷新原因||[]),
                世界侧可传播事实:copy(maintenance.世界侧可传播事实||[]),
                本轮新公开事实:copy(maintenance.本轮新公开事实||[])
            };
            request.input=JSON.stringify(payload,null,2);
            request.rumorMaintenance=copy(maintenance);
            request.manifest=Object.assign({},request.manifest,{
                传闻维护:{
                    空分类:RUMOR_PUBLIC_CATEGORIES.filter(category=>maintenance.公开传闻?.[category]?.当前数量===0),
                    待复核传播:(maintenance.本轮必须复核的传播链||[]).map(item=>item.名称),
                    可传播候选:(maintenance.本轮新公开事实||[]).map(item=>item.名称)
                },
                传闻节流:{
                    模式:'世界侧事实驱动',
                    本轮动作:maintenance.本轮公开传闻动作,
                    刷新原因:copy(maintenance.刷新原因||[]),
                    正文直接取材:false,
                    软失败不重试:true
                }
            });
            return request;
        }
        hideHostOnlyDetails(root) {
            const sections=Array.from(root?.querySelectorAll?.('.we-section')||[]);
            const trade=sections.find(section=>section.querySelector('.we-section-head h2')?.textContent?.trim()==='情报交易');
            if(!trade)return 0;
            let removed=0;
            for(const detail of trade.querySelectorAll('details')){
                const summary=detail.querySelector('summary')?.textContent?.trim();
                if(summary==='主持人档案'){
                    detail.remove();
                    removed++;
                }
            }
            return removed;
        }

        afterRender(){
            if(this.engine.tab==='传闻')this.hideHostOnlyDetails(this.engine.panel?.querySelector?.('main'));
        }
    }
