const assert=require('node:assert/strict');
const {applyPatches,compileWorldResult,compactWorldLifecycle,emptyState,RECORDS}=require('../script/世界推进系统.js');
const area=(progress=50)=>({风险:'F',探索度:progress,描述:'测试',隐藏真相:''});
const fresh=(地点='藤美学园·教学楼')=>({
  世界:{名称:'学园默示录',时间:'2008年07月17日-07:00',地点,稳定:100,后台:emptyState(),探索:{},势力:{},因果轨道:{当前阶段:'爆发初期',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},法则:[],货币:{},历法:{}},
  设置:{单一世界:false},系统状态:{是否在主神空间:false},资产:{},角色:{},关系列表:{},任务:{列表:{}},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
});
const region=(name,description=name)=>[name,{...RECORDS.势力地区,类型:'地区',描述:description,目标:'维持局势',进展:'',公开动态:''}];

let stat=fresh('藤美学园·教学楼');
let [name,record]=region('藤美学园','玩家已经进入并穿越校园。');
stat.世界.后台.势力地区[name]=record;
let next=applyPatches(stat,compileWorldResult(stat,{摘要:'只推进后台地区'}).patches);
assert.ok(next.世界.探索['藤美学园'],'当前地点已位于后台整体地区时必须自动投影探索');
assert.equal(next.世界.探索['藤美学园'].探索度,10,'首次实际到达整体区域至少记10%浅尝');

stat=fresh('床主市市区街道·中央路');
next=applyPatches(stat,compileWorldResult(stat,{摘要:'玩家进入市区',势力地区:[{名称:'床主市市区街道',类型:'地区',描述:'社会秩序正在崩坏。',进展:'玩家已进入市区街道。'}]}).patches);
assert.ok(next.世界.后台.势力地区['床主市市区街道']);
assert.ok(next.世界.探索['床主市市区街道'],'本轮新建且与当前地点匹配的整体地区也必须同步投影');
assert.equal(next.世界.探索['床主市市区街道'].探索度,10);

stat=fresh('藤美学园·校门');
[name,record]=region('藤美学园');
stat.世界.后台.势力地区[name]=record;
stat.世界.后台.势力地区['远坂宅邸']={...record,描述:'远方后台地区'};
next=applyPatches(stat,compileWorldResult(stat,{摘要:'远方地区也在后台推进'}).patches);
assert.ok(next.世界.探索['藤美学园']);
assert.equal(next.世界.探索['远坂宅邸'],undefined,'玩家未到达的远方后台地区不得自动变成探索奖励');

stat=fresh('藤美学园·教学楼');
[name,record]=region('藤美学园');
stat.世界.后台.势力地区[name]=record;
next=applyPatches(stat,compileWorldResult(stat,{摘要:'深入调查校园',探索:[{名称:'藤美学园',探索度:30,风险:'D',描述:'已掌握校园主要路线。'}]}).patches);
assert.equal(next.世界.探索['藤美学园'].探索度,30,'AI明确给出的更高探索进度不得被10%兜底覆盖');
assert.equal(Object.keys(next.世界.探索).length,1);

stat=fresh('床主市市区街道');
stat.世界.探索={'藤美学园':area(30),'床主市市区街道':area(10)};
const lifecycle=compactWorldLifecycle(stat);
assert.ok(stat.世界.探索['藤美学园'],'探索台账是玩家长期/结算档案，离开区域后不得被生命周期回收');
assert.ok(stat.世界.探索['床主市市区街道']);
assert.deepEqual(lifecycle.回收探索||[],[],'生命周期不得再清除已获得的探索记录');

console.log('world-engine exploration projection regression passed');
