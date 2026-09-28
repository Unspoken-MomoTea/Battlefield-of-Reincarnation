const assert = require('node:assert/strict');
const {SamsaraWorldEngine: Engine, emptyState, RECORDS} = require('../script/世界推进系统.js');

const clone = value => JSON.parse(JSON.stringify(value));
const stat = {
  世界:{
    名称:'测试灾变世界',时间:'2010年-04月-13日-上午',地点:'测试区域-主设施-观测平台',
    后台:emptyState(),势力:{本地幸存者:{实力:'F',领地:'测试区域',描述:'区域内临时幸存者组织',声望:0}},探索:{},异端雷达:{名单:{}},
    因果轨道:{当前阶段:'区域灾变与初步失序',故事线:'区域灾变与初步失序',下一节点:'',偏移记录:{}}
  },
  系统状态:{是否在主神空间:false,是否战斗中:false},设置:{},关系列表:{},传闻:{}
};
stat.世界.后台.事件['区域灾变与初步失序']={
  ...RECORDS.事件,
  描述:'灾变污染在测试区域扩散，区域秩序整体崩溃。',
  时间:'2010年-04月-13日-上午',状态:'进行中',地点:'测试区域',分类:'宏观节点',更新时间:'2010年-04月-13日-上午'
};
stat.世界.后台.事件['观测平台入口防守']={...RECORDS.事件,描述:'幸存居民正在阻挡威胁群体进入观测平台。',时间:'2010年-04月-13日-上午',状态:'进行中',地点:'测试区域-主设施-观测平台',分类:'当前事件',更新时间:'2010年-04月-13日-上午'};
stat.世界.后台.势力地区['测试区域-主设施']={...RECORDS.势力地区,类型:'地区',描述:'主设施仍有零散幸存者抵抗',更新时间:'2010年-04月-13日-上午'};
stat.世界.后台.势力地区['本地幸存者']={...RECORDS.势力地区,类型:'势力',描述:'临时组织的居民与工作人员幸存者',更新时间:'2010年-04月-13日-上午'};

const reply={
  摘要:'建立从区域沦陷到外围据点阶段的宏观骨架。',
  人物:[{名称:'观测平台幸存居民',所属世界:'测试灾变世界',地点:'测试区域-主设施-观测平台',目标:'守住观测平台入口',行动:'搬运桌椅继续加固入口',状态:'活跃'}],
  事件:[
    {名称:'幸存队伍集结与观测平台会合',操作:'更新',描述:'核心人物突破楼内封锁并在观测平台会合。',时间:'2010年-04月-13日-中午',状态:'待发生',地点:'测试区域-主设施-观测平台',分类:'宏观节点',更新时间:'2010年-04月-13日-上午'},
    {名称:'运输车争夺与区域突围',操作:'更新',描述:'幸存者夺取运输车并突破正门离开区域。',时间:'2010年-04月-13日-下午',状态:'待发生',地点:'测试区域-正门',分类:'宏观节点',更新时间:'2010年-04月-13日-上午'},
    {名称:'外环城区生存转折',操作:'更新',描述:'团队进入全面失序的外环城区，城市生存阶段发生转折。',时间:'2010年-04月-14日',状态:'待发生',地点:'外环城区-市区',分类:'宏观节点',更新时间:'2010年-04月-13日-上午'},
    {名称:'外围据点保卫战',操作:'更新',描述:'幸存者进入外围据点据点阶段并面对大规模大规模威胁。',时间:'2010年-04月-15日',状态:'待发生',地点:'外环城区-外围据点设施',分类:'宏观节点',更新时间:'2010年-04月-13日-上午'}
  ],
  因果:{
    当前阶段:'病毒爆发初期，测试区域正在整体沦陷。',
    宏观顺序:['区域灾变与初步失序','外环城区生存转折','外围据点保卫战']
  }
};

let calls=0,writes=0,current=clone(stat);
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>{calls++;return JSON.stringify(reply);}}},
  getCurrentChatId:()=> 'macro-open-backbone',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'观测平台入口仍在抵抗威胁群体冲击。'}]
};
host.Mvu={
  getMvuData:()=>({stat_data:clone(current)}),
  replaceMvuData:async data=>{writes++;current=clone(data.stat_data);}
};

(async()=>{
  const engine=new Engine(host);
  engine.config.enabled=true;
  engine.config.retryAttempts=1;
  engine.config.requireMacroBackbone=true;
  engine.worldbook=async()=>[];

  assert.equal(await engine.run(),true,'1个进行中宏观节点 + 2个待发生宏观节点应构成3节点可推进骨架');
  assert.equal(calls,1,'有效的3节点可推进骨架不应触发纠错重试');
  assert.equal(writes,1);

  const events=current.世界.后台.事件;
  assert.equal(events['幸存队伍集结与观测平台会合'].分类,'近期节点','观测平台会合仍应被程序降级为近期节点');
  assert.equal(events['运输车争夺与区域突围'].分类,'近期节点','运输车争夺/突破仍应被程序降级为近期节点');
  const openMacro=Object.values(events).filter(e=>e.分类==='宏观节点'&&['进行中','待发生'].includes(e.状态));
  const futureMacro=openMacro.filter(e=>e.状态==='待发生');
  assert.equal(openMacro.length,3,'宏观骨架按进行中+待发生合计');
  assert.equal(futureMacro.length,2,'不应再硬性要求3个待发生节点');
  assert.match(current.世界.因果轨道.故事线,/区域灾变与初步失序.*外环城区生存转折.*外围据点保卫战/);

  console.log('world-engine open macro backbone acceptance passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
