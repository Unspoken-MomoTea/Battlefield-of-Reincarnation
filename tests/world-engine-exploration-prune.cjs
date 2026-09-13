const assert=require('node:assert/strict');
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
