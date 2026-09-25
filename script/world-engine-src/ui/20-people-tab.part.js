    // 角色管理视图渲染：只负责名册与世界活动展示；正式档案编辑仍由状态栏负责。
    function worldEngineRenderPeopleTab(ctx) {
        const {
            engine,s,radar,showRadar,alienAlive,entries,formalPeople,backstagePeople,
            relationRoster,matched,userName,section,text,pill,fields,contextRows,
            sceneContextBody,empty,tools,person,exists,value
        }=ctx;
        let html='';
        if(showRadar&&alienAlive>0)html+='<div class="we-meta we-alien-count">异端存活数量 <b>'+alienAlive+'</b></div>';

        const alienByKey=new Map(entries(radar.名单).map(([name,record])=>[nameKey(name),{名称:name,记录:record}]));
        const rolePeople=[
            ...Array.from(formalPeople).map(([n,p])=>[n,p,{正式:true,异端:alienByKey.has(nameKey(n))}]),
            ...backstagePeople.map(([n,p])=>[n,p,{正式:false,异端:alienByKey.has(nameKey(n))}])
        ];
        const list=rolePeople.filter(([n,p,meta])=>{
            const searchable=meta.正式?Object.assign({},p,relationRoster[n]||{}):p;
            if(!matched(n,searchable))return false;
            if((engine.filter||'全部')==='全部')return true;
            const present=meta.正式&&!!relationRoster[n]?.在场;
            return engine.filter==='在场'?present:!present;
        });
        const chosen=list.find(([n])=>n===engine.selectedPerson)||list[0];
        const chosenMeta=chosen?.[2]||{};
        const chosenContext=chosen?derivePersonWorldContext(s,chosen[0],userName):null;
        const chosenRelation=chosenMeta.正式&&plain(relationRoster[chosen?.[0]])?relationRoster[chosen[0]]:null;
        const chosenAudit=engine.isNpcBuildAuditEnabled()&&chosenRelation?npcBuildAssessment(s,chosen[0],chosenRelation):null;
        const chosenAlien=chosen?alienByKey.get(nameKey(chosen[0]))?.记录:null;
        const auditPanel=chosenAudit?section('NPC构筑审计',
            '<div class="we-card"><div class="we-card-top"><h3>'+text(chosenAudit.审计级别)+'</h3>'+pill(chosenAudit.缺口.length?'待补强':'构筑完整',chosenAudit.缺口.length?'future':'dim')+'</div>'
            +fields({层级:chosenAudit.层级,当前组件:chosenAudit.当前组件})
            +(chosenAudit.缺口.length?'<div class="we-chips">'+chosenAudit.缺口.map(x=>pill(x,'future')).join('')+'</div><p class="we-muted">进入世界推进请求的热人物会由后台优先补齐缺口；难度脚本只负责已有组件的品质调整。</p>':'<p class="we-muted">当前构筑已达到本层级审计最低要求。</p>')+'</div>',
            '仅正式关系人物 · 复用NPC生成规则'
        ):'';
        const backgroundPanel=chosen?section('背景关联',contextRows(chosenContext),(chosenContext?.背景关联?.length||0)+' 关系 · '+(chosenContext?.关联事件?.length||0)+' 事件'):'';
        const surroundingsPanel=chosen?section('身边发展',sceneContextBody(chosenContext),'剧情推演现场标签 · 只读派生'):'';
        const alienPanel=chosenAlien?section('异端档案',fields({来源:chosenAlien.来源,经历:chosenAlien.经历,阵营:chosenAlien.阵营,职业:chosenAlien.职业,层级:chosenAlien.层级,状态:chosenAlien.状态}),'异端雷达 · 只读'):'';
        const formalCount=rolePeople.filter(([, ,meta])=>meta.正式).length;
        const worldCount=rolePeople.length-formalCount;
        const roster=list.length?'<div class="we-roster-list">'+list.map(([n,p,meta])=>{
            const rel=meta.正式?relationRoster[n]||{}:{};
            const present=meta.正式&&!!rel.在场;
            const status=present?'在场':p.状态||'场外';
            const source=meta.正式?'正式档案':meta.异端?'异端 · 世界人物':'世界人物';
            const summary=p.行动||p.公开动态||rel.态度||'等待下一次世界推演';
            return '<button class="we-roster-person '+(chosen?.[0]===n?'active':'')+'" data-person="'+text(n)+'"><span class="we-roster-copy"><b>'+text(n)+'</b><small>⌖ '+text(p.地点||'地点未明')+' · '+text(status)+'</small><em>'+text(summary)+'</em></span>'+pill(source,meta.异端?'future':'dim')+'</button>';
        }).join('')+'</div>':empty('没有符合条件的人物','调整筛选或等待世界人物进入活动范围。');
        html+=tools(['全部','在场','场外'])+'<div class="we-columns"><div>'
            +section('人物名册',roster,'正式 '+formalCount+' · 世界人物 '+worldCount)
            +(chosen?section('身份与当前行动',person(chosen[0],chosen[1],true),chosenMeta.正式?'正式关系人物':'世界后台人物')+surroundingsPanel+section('日程与行动',fields({行程:chosen[1].行程,开始时间:chosen[1].开始时间,预计结束:chosen[1].预计结束,下次检查:chosen[1].下次检查}))+auditPanel:empty('尚未选择人物'))
            +'</div><aside>'+backgroundPanel+alienPanel+(chosen?[['情报',chosen[1].认知来源||chosen[1].认知],['近期动向',chosen[1].公开动态]].filter(([,v])=>exists(v)).map(([label,v])=>section(label,value(v))).join(''):'')+'</aside></div>';
        return html;
    }
