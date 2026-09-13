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

TEST = ROOT / 'tests/world-engine-exploration-prune.cjs'
TEST.write_text("""const assert=require('node:assert/strict');
const {emptyState,RECORDS,compactWorldLifecycle}=require('../script/世界推进系统.js');
const area=()=>({风险:'F',探索度:50,描述:'测试',隐藏真相:''});
const fresh=(地点='新城区·中央街')=>({世界:{名称:'测试世界',时间:'2026年9月13日上午',地点,后台:emptyState(),探索:{},势力:{},因果轨道:{偏移记录:{}}},关系列表:{},系统状态:{是否在主神空间:false},设置:{}});

let stat=fresh();
stat.世界.探索={'新城区':area(),'旧港区':area()};
let result=compactWorldLifecycle(stat);
assert.ok(stat.世界.探索['新城区']);
assert.equal(stat.世界.探索['旧港区'],undefined);
assert.deepEqual(result.回收探索,['旧港区']);

stat=fresh();
stat.世界.探索={'旧港区':area(),'遗迹区':area()};
stat.世界.后台.事件.港口冲突={...RECORDS.事件,地点:'旧港区·码头',状态:'进行中',分类:'当前事件'};
stat.世界.后台.事件.遗迹余波={...RECORDS.事件,地点:'',状态:'待发生',分类:'近期节点',可见影响:[{时间:'',地点:'遗迹区·外环',影响:'仍有关联'}]};
compactWorldLifecycle(stat);
assert.ok(stat.世界.探索['旧港区']);
assert.ok(stat.世界.探索['遗迹区']);

stat=fresh();
stat.世界.探索={'北岭':area(),'旧矿区':area()};
stat.世界.后台.人物.守望者={...RECORDS.人物,所属世界:'测试世界',地点:'北岭·哨所',状态:'场外',行程:[{开始:'',结束:'',地点:'旧矿区·入口',行动:'调查',状态:'计划',结果:''}]};
stat.关系列表.守望者={层级:'Ⅰ'};
compactWorldLifecycle(stat);
assert.ok(stat.世界.探索['北岭']);
assert.ok(stat.世界.探索['旧矿区']);
stat.世界.后台.人物.守望者.行程[0].状态='已完成';
compactWorldLifecycle(stat);
assert.equal(stat.世界.探索['旧矿区'],undefined);

stat=fresh('');
stat.世界.探索={'旧城区':area()};
result=compactWorldLifecycle(stat);
assert.ok(stat.世界.探索['旧城区']);
assert.deepEqual(result.回收探索,[]);
console.log('world-engine exploration pruning regression passed');
""", encoding='utf-8', newline='\n')

print('cold exploration pruning applied')
