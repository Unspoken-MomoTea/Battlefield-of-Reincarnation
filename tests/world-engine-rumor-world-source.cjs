const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../script/世界推进系统.js'),'utf8');
const context={module:{exports:{}},console,setTimeout,clearTimeout,AbortController};
vm.runInNewContext(source.replace('module.exports = {','module.exports = {rumorMaintenanceRequirements,RUMOR_WORLD_SOURCE_RULES,'),context);
const {rumorMaintenanceRequirements,RUMOR_WORLD_SOURCE_RULES,emptyState}=context.module.exports;
const now='2026年9月13日清晨';
const stat={
  世界:{名称:'测试世界',时间:now,地点:'玩家私密房间',后台:emptyState(),势力:{},探索:{},货币:{体系:'铜币',购买力基准:'',经济波动:'封港导致粮价与船运费上涨。'},因果轨道:{偏移记录:{}}},
  传闻:{街头巷议:{},情报交易:{},布告与檄文:{}},设置:{},系统状态:{是否在主神空间:false}
};
stat.世界.后台.事件['港口封锁']={
  描述:'内部原因仅供主持人掌握',状态:'进行中',分类:'当前事件',地点:'南港',时间:now,更新时间:now,
  公开征兆:'南港城门贴出临时封港告示，商船被勒令停泊。',
  可见影响:[{时间:'当前',地点:'南港',影响:'码头停止装卸，旅客滞留。'}]
};
stat.世界.后台.人物['商会会长']={
  地点:'商会大厅',目标:'内部目标',行动:'内部行动',认知:['内部认知'],
  公开动态:'商会会长公开宣布暂停远洋贸易。',更新时间:now
};
stat.世界.后台.人物['玩家']={
  地点:'玩家私密房间',目标:'保持低调',行动:'刚刚进行了一项无人知晓的秘密操作',认知:['无人目击'],公开动态:'',更新时间:now
};
stat.世界.后台.势力地区['南港']={
  类型:'地区',描述:'帝国南部港区',公开动态:'码头公开停止装卸并限制出城。',更新时间:now,
  近期变化:[{时间:now,事实:'军警公开增设路障。',关联事件:'港口封锁'}]
};
stat.世界.势力['海运商会']={实力:'C',领地:'南港',描述:'控制多数合法海运航线',声望:15};
stat.世界.探索['旧矿坑']={风险:'C',探索度:20,描述:'附近矿工最近公开议论夜间怪声。',隐藏真相:'仅主持人可知的隐藏内容'};
const maintenance=rumorMaintenanceRequirements(stat);
assert.ok(Array.isArray(maintenance.世界侧可传播事实),'必须提供世界侧公开事实池');
const facts=JSON.stringify(maintenance.世界侧可传播事实);
assert.match(facts,/港口封锁/);
assert.match(facts,/商会会长公开宣布暂停远洋贸易/);
assert.match(facts,/码头公开停止装卸/);
assert.match(facts,/封港导致粮价与船运费上涨/);
assert.doesNotMatch(facts,/玩家私密房间/,'玩家当前地点不能成为传播提示');
assert.doesNotMatch(facts,/无人知晓的秘密操作/,'私密人物行动不能进入公开事实池');
assert.doesNotMatch(facts,/仅主持人可知的隐藏内容/,'隐藏真相不能进入公开事实池');
assert.doesNotMatch(facts,/内部原因仅供主持人掌握/,'事件内部描述不能越过公开征兆泄露');
assert.match(RUMOR_WORLD_SOURCE_RULES,/正文.*(?:不是|不得).*传播|传播.*不得.*正文/,'最终规则必须声明正文不是直接传播源');
assert.match(RUMOR_WORLD_SOURCE_RULES,/世界侧可传播事实/,'最终规则必须从世界公开事实池取材');
assert.match(RUMOR_WORLD_SOURCE_RULES,/目击|公开后果|调查|主动泄露/,'私密行为必须经过现实传播渠道');
assert.match(RUMOR_WORLD_SOURCE_RULES,/时间.*空间|空间.*时间/,'传播必须具有时间与空间路径');
console.log('PASS rumor and propagation are driven by world-side public facts, not private prose');
