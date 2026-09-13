from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'script/world-engine-src/10-world-state.part.js'
text = PATH.read_text(encoding='utf-8')

old = """    function compactWorldLifecycle(stat) {
        const state=stat?.世界?.[PATH];
        if(!state)return {归档事件:[],回收传播:[],回收人物:[]};
        const now=worldDateKey(stat?.世界?.时间),removed=[];
        for(const [name,record] of Object.entries(state.传播||{})){
            if(propagationEnded(record,now)){delete state.传播[name];removed.push(name);}
        }
        const archived=compactFinishedEvents(stat);
        const removedPeople=pruneColdTemporaryPeople(stat);
        return {归档事件:archived,回收传播:removed,回收人物:removedPeople};
    }
"""
new = """    function explorationLocationRefs(record,kind) {
        if(!plain(record))return [];
        const out=[];
        if(String(record.地点||'').trim())out.push(String(record.地点).trim());
        if(kind==='事件'){
            for(const item of Array.isArray(record.可见影响)?record.可见影响:[]){
                if(plain(item)&&String(item.地点||'').trim())out.push(String(item.地点).trim());
            }
        }else if(kind==='人物'){
            for(const item of Array.isArray(record.行程)?record.行程:[]){
                if(!plain(item)||!String(item.地点||'').trim())continue;
                const status=String(item.状态||'').trim();
                if(/^(?:已完成|完成|已结束|结束|已取消|取消|已失效|失效)$/.test(status))continue;
                out.push(String(item.地点).trim());
            }
        }
        return out;
    }
    function pruneColdExploration(stat) {
        const world=stat?.世界,bucket=world?.探索,state=world?.[PATH];
        if(!plain(bucket)||!state)return [];
        const currentLocation=String(world?.地点||'').trim();
        // 没有当前地点时无法证明玩家已经离开，宁可保留，避免误删长期档案。
        if(!currentLocation)return [];
        const eventLocations=Object.values(state.事件||{}).flatMap(record=>explorationLocationRefs(record,'事件'));
        const personLocations=Object.values(state.人物||{}).flatMap(record=>explorationLocationRefs(record,'人物'));
        const removed=[];
        for(const areaName of Object.keys(bucket)){
            if(!String(areaName||'').trim())continue;
            if(worldLocationRelated(currentLocation,areaName))continue;
            if(eventLocations.some(location=>worldLocationRelated(location,areaName)))continue;
            if(personLocations.some(location=>worldLocationRelated(location,areaName)))continue;
            delete bucket[areaName];
            removed.push(areaName);
        }
        return removed;
    }
    function compactWorldLifecycle(stat) {
        const state=stat?.世界?.[PATH];
        if(!state)return {归档事件:[],回收传播:[],回收人物:[],回收探索:[]};
        const now=worldDateKey(stat?.世界?.时间),removed=[];
        for(const [name,record] of Object.entries(state.传播||{})){
            if(propagationEnded(record,now)){delete state.传播[name];removed.push(name);}
        }
        const archived=compactFinishedEvents(stat);
        const removedPeople=pruneColdTemporaryPeople(stat);
        // 先回收已经结束的事件与冷人物，再判断哪些探索区域真正失去剧情关联。
        const removedExploration=pruneColdExploration(stat);
        return {归档事件:archived,回收传播:removed,回收人物:removedPeople,回收探索:removedExploration};
    }
"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'compactWorldLifecycle block mismatch: expected 1, got {count}')
PATH.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')
print('cold exploration pruning applied')
