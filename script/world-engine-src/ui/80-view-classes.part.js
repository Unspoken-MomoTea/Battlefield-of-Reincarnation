    // UI 视图类：页面渲染不再作为 SamsaraWorldEngine 的业务方法堆积。
    class WorldEngineView {
        constructor(engine){this.engine=engine;}
        render(){return '';}
    }
    class WorldTabView extends WorldEngineView {
        render(ctx){return worldEngineRenderWorldTab({...ctx,engine:this.engine});}
    }
    class PeopleTabView extends WorldEngineView {
        render(ctx){return worldEngineRenderPeopleTab({...ctx,engine:this.engine});}
    }
    class ExplorationTabView extends WorldEngineView {
        render(ctx){return worldEngineRenderExplorationTab({...ctx,engine:this.engine});}
    }
    class WorldEventsTabView extends WorldEngineView {
        render(ctx){return worldEngineRenderWorldEventsTab({...ctx,engine:this.engine});}
    }
    class HistoryTabView extends WorldEngineView {
        render(ctx){return worldEngineRenderRunRecordTab({...ctx,engine:this.engine});}
    }
    class SettingsTabView extends WorldEngineView {
        render(ctx){return worldEngineRenderSettingsTab({...ctx,engine:this.engine});}
    }
    class PromptTabView extends WorldEngineView {
        render(ctx){return worldEngineRenderPromptTab({...ctx,engine:this.engine});}
    }
    class RequestInspectorView extends WorldEngineView {
        render(ctx){return worldEngineRenderRequestInspector({...ctx,engine:this.engine});}
    }
    class AssetsTabView extends WorldEngineView {
        render(ctx){
            const {s,w,entries,plain,matched,tools,section,text,pill,fields,details,empty,userName,relationNamesByKey,people,nameKey}=ctx;
            const ownersOf=asset=>Array.from(new Set((Object.hasOwn(asset,'所属对象')?(Array.isArray(asset.所属对象)?asset.所属对象:[asset.所属对象]):['<user>']).map(x=>String(x??'').trim()).filter(x=>x&&x!=='无主')));
            const assets=entries(s.资产).filter(([,asset])=>plain(asset));
            const list=assets.filter(([name,asset])=>{
                const owners=ownersOf(asset),category=this.engine.filter||'全部';
                return (category==='全部'||category==='玩家相关'&&owners.includes('<user>')||category==='共同持有'&&owners.length>1||category==='无主'&&!owners.length)&&matched(name,{...asset,归属:owners.join(' ')});
            });
            let html=tools(['全部','玩家相关','共同持有','无主']);
            html+=section('资产与归属',list.map(([name,asset])=>{
                const owners=ownersOf(asset);
                const ownerLinks=owners.length?owners.map(owner=>{
                    const label=owner==='<user>'?(userName||'玩家'):owner;
                    if(owner!=='<user>'&&(relationNamesByKey.has(nameKey(owner))||people.has(owner)))return '<button data-jump-person="'+text(relationNamesByKey.get(nameKey(owner))||owner)+'">'+text(label)+' ↗</button>';
                    if(Object.hasOwn(w.势力||{},owner))return '<button data-faction="'+text(owner)+'" data-asset-owner>'+text(label)+' ↗</button>';
                    return pill(label,'dim');
                }).join(''):pill('无主','dim');
                return '<article class="we-card" data-asset-card="'+text(name)+'"><div class="we-card-top"><h3>'+text(name)+'</h3>'+pill(asset.类型||'类型未记录','dim')+'</div><div class="we-tools"><b>所属对象</b>'+ownerLinks+(owners.length>1?pill('共同持有','future'):'')+'</div><p>'+text(asset.状态||'状态未记录')+'</p>'+fields({主体规模:asset.主体规模,完整度:asset.完整度==null?undefined:asset.完整度+'%'})+details('asset-'+name,{能源:asset.能源,建设序列:asset.建设序列,驻扎人员:asset.驻扎人员,待办事件:asset.待办事件},'运转详情 · 建设 / 驻扎 / 待办')+'</article>';
            }).join('')||empty('暂无符合条件的资产'),'共 '+assets.length+' 项 · 可按名称、所属对象或状态搜索');
            return html;
        }
    }
    class RumorTabView extends WorldEngineView {
        render(ctx){
            const {s,state,tools,section,entries,matched,text,fields,details,empty,pill}=ctx;
            let html=tools();
            for(const category of ['街头巷议','情报交易','布告与檄文']){
                html+=section(category,entries((s.传闻||{})[category]).filter(([n,r])=>matched(n,r)).map(([n,r])=>'<article class="we-card"><h3>'+text(n)+'</h3><p>'+text(r.内容||r.摘要)+'</p>'+fields({来源:r.来源||r.卖家||r.发布者,可信度:r.可信度,要价:r.要价,位置:r.张贴位置})+details('rumor-'+n,{真实内幕:r.真实内幕},'主持人档案')+'</article>').join('')||empty('暂无'+category,'传闻来自已发生事件与传播渠道。'));
            }
            html+=section('传播链',entries(state.传播).map(([n,r])=>'<article class="we-card"><div class="we-card-top"><h3>'+text(n)+'</h3>'+pill(r.状态,'dim')+'</div><p>'+text(r.内容)+'</p>'+fields({时间:r.时间,来源:r.来源,范围:r.范围,受众:r.受众,到期时间:r.到期时间})+details('spread-'+n,{关联事件:r.关联事件,引发行动:r.引发行动,真相:r.真相},'因果与传播详情')+'</article>').join('')||empty('尚无传播链'));
            return html;
        }
    }

    class WorldEngineViewRegistry {
        constructor(engine){
            this.engine=engine;
            this.world=new WorldTabView(engine);
            this.people=new PeopleTabView(engine);
            this.exploration=new ExplorationTabView(engine);
            this.assets=new AssetsTabView(engine);
            this.events=new WorldEventsTabView(engine);
            this.rumor=new RumorTabView(engine);
            this.history=new HistoryTabView(engine);
            this.settings=new SettingsTabView(engine);
            this.prompts=new PromptTabView(engine);
            this.inspector=new RequestInspectorView(engine);
        }
    }
