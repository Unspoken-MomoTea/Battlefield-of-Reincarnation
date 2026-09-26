    // 世界事件/历史记忆归档视图：从主 UI 类中拆出纯渲染职责。
    class WorldEventsView extends WorldEngineTabView {
        constructor(){super('events');}
        render(ctx) {
        const {engine,events,matched,tools,section,timelineCards,empty}=ctx;
        const list=events.filter(([n,e])=>matched(n,e)&&((engine.filter||'全部')==='全部'||e.状态===engine.filter));
        return tools(['全部','进行中','待发生','已完成','已取消'])
            +section('世界事件','<div class="we-timeline">'+(timelineCards(list)||empty('没有符合条件的世界事件','按当前事件、近期节点和宏观节点组织。'))+'</div>','按状态层级与因果顺序排列');
        }
    }
    class WorldHistoryMemoryView extends WorldEngineTabView {
        constructor(){super('history');}
        render(ctx) {
        const {state,radar,showRadar,exists,section,text,entries,fields,empty,pill}=ctx;
        let html='';
        if(showRadar&&exists(radar.当前模式))html+=section('干涉模式','<article class="we-card"><p>'+text(radar.当前模式)+'</p></article>');
        const historyMemory=projectWorldHistoryMemory(state);
        html+=section('近期历史锚点',entries(historyMemory.近期锚点).reverse().map(([n,r])=>'<article class="we-card"><div class="we-meta">'+text(r.时间)+'</div><p>'+text(r.事实)+'</p>'+fields({关联事件:r.关联事件})+'</article>').join('')||empty('尚无未收纳的近期历史锚点'),(historyMemory.统计?.原始锚点总数||0)+' 条原始历史 · 仅展示当前热根节点');
        html+=section('长期历史总结',(historyMemory.长期总结||[]).slice().reverse().map(r=>'<article class="we-card"><div class="we-card-top"><h3>'+text(r.名称)+'</h3>'+pill('L'+text(r.层级),'dim')+'</div><div class="we-meta">'+text([r.起始时间,r.结束时间].filter(Boolean).join(' → '))+'</div><p>'+text(r.摘要)+'</p></article>').join('')||empty('尚无长期历史总结','历史锚点积累后会自动分层压缩；底层事实仍保留在MVU。'),(historyMemory.统计?.总结节点总数||0)+' 个总结节点 · 原始历史不删除');
        return html;
        }
    }
