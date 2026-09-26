    // 世界推进主视图渲染：从 50-engine-ui 拆出的事件/因果/时间线业务视图。
    function worldEngineRenderWorldTab(ctx) {
        const {
            engine,s,w,orbit,events,active,future,people,calendarCandidates,snapshot,
            entries,text,empty,section,stabilityDescription,parseDate,calendar,tools,
            timelineCards,exists,fields,prose,compactPerson
        }=ctx;
        let html='';
        const offsets=entries(orbit.偏移记录);
        const stable=w.稳定!==null&&w.稳定!==''&&Number.isFinite(Number(w.稳定))?Number(w.稳定):null;
        const signed=n=>(n>0?'+':'')+n;
        const offsetCard=([name,r])=>{
            const impact=r?.影响程度!==null&&r?.影响程度!==''&&Number.isFinite(Number(r?.影响程度))?Number(r.影响程度):null;
            return '<article class="we-offset"><div class="we-offset-head"><b>'+text(name)+'</b><span>'+text(impact===null?'影响未记录':signed(impact))+'</span></div><p>'+text(r?.描述||'暂无偏移描述')+'</p><small>引发者 · '+text(r?.引发者||'未记录')+' · '+(impact===null?'待确认':impact<0?'因果破坏':impact>0?'因果修复 / 强化':'无数值变化')+'</small></article>';
        };
        const causalHtml='<div class="we-causal"><div class="we-stability"><div><small>世界稳定值</small><strong data-world-stability>'+text(stable===null?'未记录':stable)+'</strong></div><span>'+((s.设置||{}).世界超稳?'世界超稳 · 禁止新增偏移':'基准 100 · 失稳将强化世界排异')+'</span></div>'
            +(stable===null?'':'<meter min="0" max="120" value="'+Math.max(0,Math.min(120,stable))+'" aria-label="世界稳定值">'+stable+'</meter>')
            +stabilityDescription(stable)
            +'<div class="we-offset-heading">偏移记录 <span>'+offsets.length+' 条</span></div>'
            +(offsets.length?offsets.slice(0,3).map(offsetCard).join('')+(offsets.length>3?'<details class="we-offset-more"><summary>展开其余 '+(offsets.length-3)+' 条偏移</summary>'+offsets.slice(3).map(offsetCard).join('')+'</details>':''):empty('暂无因果偏移','关键人物命运、重大事件或势力格局实质改变后记录。'))+'</div>';
        const shown=calendarCandidates.filter(([,e])=>engine.calendarMode==='undated'?!parseDate(e.时间||e.开始时间):!engine.selectedDate||parseDate(e.时间||e.开始时间)?.key===engine.selectedDate);
        const macroCount=events.filter(([,e])=>e.分类==='宏观节点').length;
        const timelineView=snapshot?timelineState(s):null;
        const nextMacroName=timelineView?.下一宏观节点?.名称||'';
        const nextPair=nextMacroName?events.find(([n,e])=>n===nextMacroName&&e.分类==='宏观节点')||null:null;
        const nextNode=nextPair?.[0]||'等待宏观节点';
        const nextEvent=nextPair?.[1]||null;
        const compactPeople=Array.from(people).filter(([,p])=>p.行动||p.公开动态||p.地点).slice(0,4);
        html+='<div class="we-world-focus">'
            +'<div class="we-world-focus-main">'+section('世界动向',orbit.当前阶段&&orbit.当前阶段!=='待初始化'?'<div class="we-pulse"><span class="we-pulse-mark">LIVE</span><p>'+text(orbit.当前阶段)+'</p></div>':empty('阶段待确认','世界推进会把当前世界局势直接写入因果轨道.当前阶段。'),'因果轨道 · 当前阶段')+'</div>'
            +'<div class="we-world-focus-next">'+section('下一宏观节点',(nextEvent?'<button class="we-next-node" data-jump-event="'+text(nextNode)+'" title="点击定位到时间线中的对应宏观事件">':'<div class="we-next-node">')+'<span>→</span><div><h3>'+text(nextNode)+'</h3><p>'+text(nextEvent?.公开征兆||nextEvent?.描述||'本轮需要先建立真实宏观节点')+'</p><small>'+text(nextEvent?.时间||nextEvent?.开始时间||'时间待确认')+(nextEvent?' · 点击定位 →':'')+'</small></div>'+(nextEvent?'</button>':'</div>'),'因果边界')+'</div>'
            +'</div>';
        html+='<div class="we-kpi-grid we-kpi-compact">'
            +'<div class="we-kpi"><small>正在发生</small><strong>'+active.length+'</strong><span>当前活动事件</span></div>'
            +'<div class="we-kpi"><small>近期桥接</small><strong>'+events.filter(([,e])=>e.分类==='近期节点'&&e.状态==='待发生').length+'</strong><span>下一宏观边界之前</span></div>'
            +'<div class="we-kpi"><small>宏观锚点</small><strong>'+macroCount+'</strong><span>'+text(orbit.当前阶段||'阶段待确认')+'</span></div>'
            +'<div class="we-kpi"><small>场外人物</small><strong>'+people.size+'</strong><span>'+future.length+' 个未来事件</span></div>'
            +'</div>';
        html+='<div class="we-dashboard"><div class="we-command-main">'
            +'<section class="we-section we-timeline-board" data-detail="world-calendar"><div class="we-section-head"><h2>事件时间线</h2><small>'+events.length+' 事件 · '+future.length+' 未来 · '+macroCount+' 宏观</small></div><div class="we-calendar-layout"><div class="we-calendar-slot">'+calendar()+'</div><div class="we-timeline-slot">'+tools(['全部','进行中','待发生','已完成','已取消'])+'<div class="we-tools"><span>'+text(engine.calendarMode==='undated'?'未定日 / 作品内时间':engine.selectedDate||'全部日期')+'</span><button data-action="today">回到今天</button><button data-action="clear-date">全部日期</button><button data-action="undated">未定日事件</button></div>'+'<div class="we-timeline">'+(timelineCards(shown.slice(0,engine.eventLimit||12))||empty('没有符合条件的事件'))+'</div>'+(shown.length>(engine.eventLimit||12)?'<button class="we-btn" data-action="more-events">显示更多（共 '+shown.length+' 项）</button>':'')+'</div></div></section>'
            +'</div><aside class="we-command-side">'
            +section('因果状态',causalHtml,'稳定与轨道偏移')
            +section('货币与经济',exists(w.货币)?fields({货币体系:w.货币?.体系,购买力基准:w.货币?.购买力基准,经济波动:w.货币?.经济波动}):empty('尚无货币资料','世界推进会在设定或经济局势明确时维护。'),'世界推进维护')
            +(exists(w.法则)?section('世界法则',prose(w.法则),'当前生效规则 · '+(Array.isArray(w.法则)?w.法则.length:1)+' 条'):'')
            +section('人物动向',(compactPeople.length?'<div class="we-people-strip">'+compactPeople.map(([n,p])=>compactPerson(n,p)).join('')+'</div><button class="we-link-btn" data-tab="角色管理">查看人物名册 →</button>':empty('暂无人物动态')),'重点 NPC')
            +'</aside></div>';
        return html;
    }

    class WorldTabView {
        constructor(engine){ this.engine=engine; }
        render(context={}) { return worldEngineRenderWorldTab({...context,engine:context.engine||this.engine}); }
    }
