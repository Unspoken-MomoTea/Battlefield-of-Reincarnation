    class WorldAssetView {
        constructor(engine){this.engine=engine;}
        render(context={}){
            const {s,w,people,userName,relationNamesByKey,entries,matched,tools,section,text,pill,fields,details,empty}=context;
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
