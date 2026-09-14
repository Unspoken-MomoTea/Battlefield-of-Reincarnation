    function rumorWorldSameTime(value,current){
        const a=String(value||'').trim(),b=String(current||'').trim();
        return !!a&&!!b&&(typeof sameWorldTimeAnchor==='function'?sameWorldTimeAnchor(a,b):a===b);
    }
    function worldPublicRumorFacts(stat){
        const backend=stat?.世界?.[PATH]||{},now=String(stat?.世界?.时间||'').trim(),facts=[];
        const add=item=>{if(plain(item)&&String(item.公开内容||'').trim())facts.push(item);};
        for(const [名称,event] of Object.entries(backend.事件||{})){
            if(!plain(event)||!['进行中','已完成'].includes(String(event.状态||'')))continue;
            const visible=[String(event.公开征兆||'').trim(),...(Array.isArray(event.可见影响)?event.可见影响.map(x=>String(x?.影响||'').trim()):[])].filter(Boolean);
            if(!visible.length)continue;
            const time=String(event.更新时间||event.时间||'').trim();
            add({类型:'公开事件',名称,地点:String(event.地点||''),时间,公开内容:visible.join('；'),关联事件:[名称],新近:rumorWorldSameTime(time,now)});
        }
        for(const [名称,person] of Object.entries(backend.人物||{})){
            const text=String(person?.公开动态||'').trim();if(!text)continue;
            const time=String(person?.更新时间||'').trim();
            add({类型:'人物公开动态',名称,时间,公开内容:text,关联事件:copy(Array.isArray(person?.关联事件)?person.关联事件:[]),新近:rumorWorldSameTime(time,now)});
        }
        for(const [名称,area] of Object.entries(backend.势力地区||{})){
            const text=String(area?.公开动态||'').trim();if(!text)continue;
            const time=String(area?.更新时间||'').trim();
            add({类型:'地区公开动态',名称,时间,公开内容:text,新近:rumorWorldSameTime(time,now)});
        }
        for(const [名称,faction] of Object.entries(stat?.世界?.势力||{})){
            const text=[faction?.领地,faction?.描述].map(x=>String(x||'').trim()).filter(Boolean).join('；');
            add({类型:'势力公开背景',名称,公开内容:text,新近:false});
        }
        for(const [名称,place] of Object.entries(stat?.世界?.探索||{}))add({类型:'探索公开背景',名称,风险:String(place?.风险||''),公开内容:String(place?.描述||''),新近:false});
        const economy=String(stat?.世界?.货币?.经济波动||'').trim();
        if(economy)add({类型:'经济公开背景',名称:'经济波动',公开内容:economy,新近:false});
        return facts.slice(-24);
    }

    const rumorMaintenanceRequirementsBeforeWorldSource=rumorMaintenanceRequirements;
    rumorMaintenanceRequirements=function(stat){
        const required=rumorMaintenanceRequirementsBeforeWorldSource(stat),facts=worldPublicRumorFacts(stat),fresh=facts.filter(item=>item.新近).slice(-6);
        const empty=RUMOR_PUBLIC_CATEGORIES.filter(category=>Number(required?.公开传闻?.[category]?.当前数量||0)===0),review=required?.本轮必须复核的传播链||[],reasons=[];
        if(empty.length)reasons.push('空分类：'+empty.join('、'));
        if(review.length)reasons.push('传播复核：'+review.map(item=>item.名称).join('、'));
        if(fresh.length)reasons.push('新世界公开事实：'+fresh.map(item=>item.名称).join('、'));
        required.世界侧可传播事实=facts;required.本轮新公开事实=fresh;required.刷新原因=reasons;required.本轮公开传闻动作=reasons.length?'按需更新；每个触发每类最多1条':'保持不变';
        delete required.当前地点;
        return required;
    };
