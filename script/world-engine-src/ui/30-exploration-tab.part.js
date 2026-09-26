    // 探索与势力视图：玩家探索结算台账、地区现场与势力声望。
    class ExplorationFactionView extends WorldEngineTabView {
        constructor(){super('exploration');}
        render(ctx) {
        const {
            engine,state,w,events,entries,text,fields,areaSceneBody,exists,details,
            empty,section,eventCard
        }=ctx;
        let html='';
        const regionRecords=state.势力地区||{};
        const exploration=entries(w.探索).map(([name,ledger])=>[name,{...(regionRecords[name]||{}),...ledger,类型:'探索'}]);
        const factionList=entries(w.势力).map(([name,ledger])=>[name,{...(regionRecords[name]||{}),...ledger,类型:'势力'}]);
        const projectedNames=new Set([...exploration.map(([n])=>n),...factionList.map(([n])=>n)]);
        const backstageAreas=entries(regionRecords).filter(([name,r])=>r.类型!=='势力'&&!projectedNames.has(name));
        const dir=engine.directoryTab||'探索';
        const progressStage=value=>{
            const n=Math.max(0,Math.min(100,Number(value)||0));
            if(n>=100)return '核心';
            if(n>=90)return '掌控';
            if(n>=60)return '深入';
            if(n>=30)return '熟悉';
            if(n>=10)return '浅尝';
            return '无知';
        };
        const repStage=value=>{
            const n=Number(value)||0;
            if(n<=-5000)return '敌对';
            if(n<=-1000)return '仇视';
            if(n<500)return '冷淡';
            if(n<2000)return '中立';
            if(n<5000)return '友好';
            if(n<10000)return '崇敬';
            return '崇拜';
        };
        const chosenArea=exploration.find(([n])=>n===engine.selectedArea)||exploration[0];
        const chosenFaction=factionList.find(([n])=>n===engine.selectedFaction)||factionList[0];

        html+='<div class="we-notice">这里显示的是结算台账，不是地图数据库：只有 <b>世界.探索</b> 中的整体地标才计探索收益；后台尚未投影的地区不会出现在探索名录中。势力声望同样只记录势力对玩家的真实关系结算。</div>';
        html+='<div class="we-tools">'+['探索','热点','势力'].map(t=>'<button data-directory="'+t+'" class="'+(dir===t?'active':'')+'">'+t+'</button>').join('')+'</div>';

        if(dir==='探索'){
            const cards=exploration.map(([n,r])=>{
                const progress=Math.max(0,Math.min(100,Number(r.探索度)||0));
                const control=r.控制方||'控制权未明';
                const environment=Array.isArray(r.环境状态)?(r.环境状态.length?r.环境状态.length+'项':'未记录'):r.环境状态||'未记录';
                return '<button class="we-explore-card '+(chosenArea?.[0]===n?'active':'')+'" data-area="'+text(n)+'">'
                    +'<div class="we-explore-head"><div><small>探索地标</small><h3>'+text(n)+'</h3></div><span class="we-risk-badge">风险 '+text(r.风险||'F')+'</span></div>'
                    +'<div class="we-explore-score"><strong>'+progress+'<small>%</small></strong><span>'+text(progressStage(progress))+'</span></div>'
                    +'<div class="we-explore-bar"><i style="width:'+progress+'%"></i></div>'
                    +'<div class="we-explore-meta"><span>控制 · '+text(control)+'</span><span>环境 · '+text(environment)+'</span></div>'
                    +'<p>'+text(r.描述||r.公开动态||'尚无区域描述')+'</p>'
                    +'</button>';
            }).join('');
            const areaDetail=chosenArea?(()=>{
                const [n,r]=chosenArea;
                const backstage=regionRecords[n]||{};
                return '<div class="we-area-detail"><div class="we-area-facts">'+fields({风险:r.风险,控制方:r.控制方||'未明',争夺方:r.争夺方,环境状态:r.环境状态})+'<div class="we-area-note">'+text(r.描述||'暂无已确认的玩家探索描述。')+'</div></div>'
                    +areaSceneBody(backstage)
                    +'<div class="we-area-archive">'+(exists(backstage.进展)||exists(backstage.公开动态)||exists(backstage.资源)||exists(backstage.近期变化)?details('area-world-'+n,{世界进展:backstage.进展,公开动态:backstage.公开动态,资源:backstage.资源,近期变化:backstage.近期变化},'世界地区档案'):'')
                    +(exists(r.隐藏真相)?details('area-truth-'+n,{隐藏真相:r.隐藏真相},'主持人档案'):'')+'</div></div>';
            })():empty('暂无探索地标','只有已经投影到世界.探索的整体区域才会出现在这里。');
            html+=section('探索结算名录','<div class="we-explore-grid we-explore-index">'+(cards||empty('暂无探索地标','等待玩家实际发现整体区域。'))+'</div>');
            html+=section('区域档案',areaDetail,'地区现场与后台档案 · 点击上方地标切换');
            if(backstageAreas.length){
                html+=section('后台未投影地区','<details><summary>'+backstageAreas.length+' 个世界地区尚未计入玩家探索奖励</summary>'+backstageAreas.map(([n,r])=>'<div class="we-brief-row"><b>'+text(n)+'</b><span>'+text(r.进展||r.公开动态||r.描述||'后台运行中')+'</span></div>').join('')+'</details>','仅主持人参考 · 不计探索收益');
            }
        }else if(dir==='热点'){
            const hotspots=events.filter(([,e])=>e.状态==='进行中');
            html+=section('当前热点',hotspots.map(([n,e])=>eventCard(n,e)).join('')||empty('暂无进行中的热点','世界当前没有进行中的事件。'));
        }else{
            const factionCards=factionList.map(([n,r])=>{
                const rep=Number(r.声望)||0,stage=repStage(rep),width=Math.min(100,Math.max(0,rep)/100);
                return '<button class="we-faction-card '+(chosenFaction?.[0]===n?'active':'')+'" data-faction="'+text(n)+'"><div class="we-card-top"><h3>'+text(n)+'</h3><span class="we-risk-badge">实力 '+text(r.实力||'F')+'</span></div>'
                    +'<div class="we-rep"><span>声望 '+rep+'</span><b>'+text(stage)+'</b></div><div class="we-explore-bar"><i style="width:'+width+'%"></i></div>'
                    +'<div class="we-muted">'+(rep>0?'正声望奖励权重 '+(rep/100).toFixed(1)+'×（合计上限 3×）':'空间币奖励：0（声望不为正）')+'</div>'
                    +'<p>'+text(r.描述||r.目标||'暂无势力描述')+'</p><small>'+text(r.领地||'领地未记录')+'</small></button>';
            }).join('');
            const factionDetail=chosenFaction?'<h3>'+text(chosenFaction[0])+'</h3>'+fields({实力:chosenFaction[1].实力,声望:chosenFaction[1].声望,关系阶段:repStage(chosenFaction[1].声望),领地:chosenFaction[1].领地,目标:chosenFaction[1].目标,描述:chosenFaction[1].描述,当前进展:chosenFaction[1].进展}):empty('暂无势力记录');
            html+=section('势力结算名录','<div class="we-explore-layout"><div class="we-faction-grid">'+(factionCards||empty('暂无已知势力'))+'</div><aside class="we-area-side">'+section('势力档案',factionDetail,'点击左侧势力切换')+'</aside></div>','声望只反映势力对玩家的真实关系');
        }
        return html;
        }
    }
