    class WorldEventArchiveView {
        constructor(engine){this.engine=engine;}
        render(context={}) {
            const {events,matched,tools,section,timelineCards,empty}=context,engine=this.engine;
            const list=events.filter(([n,e])=>matched(n,e)&&((engine.filter||'全部')==='全部'||e.状态===engine.filter));
            return tools(['全部','进行中','待发生','已完成','已取消'])
                +section('世界事件','<div class="we-timeline">'+(timelineCards(list)||empty('没有符合条件的世界事件','按当前事件、近期节点和宏观节点组织。'))+'</div>','按状态层级与因果顺序排列');
        }
    }
