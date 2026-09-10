const assert = require('node:assert/strict');
const {SamsaraWorldEngine: Engine, emptyState, RECORDS} = require('../script/世界推进系统.js');

const clone = value => JSON.parse(JSON.stringify(value));
const stat = {
  世界:{
    名称:'学园默示录',时间:'2010年-04月-13日-上午',地点:'藤美学园-主教学楼-天台',
    后台:emptyState(),势力:{},探索:{},异端雷达:{名单:{}},
    因果轨道:{当前阶段:'校园爆发与初步沦陷',故事线:'校园爆发与初步沦陷',下一节点:'',偏移记录:{}}
  },
  系统状态:{是否在主神空间:false,是否战斗中:false},设置:{},关系列表:{},传闻:{}
};
stat.世界.后台.事件['校园爆发与初步沦陷']={
  ...RECORDS.事件,
  描述:'死体病毒在藤美学园扩散，校园秩序整体崩溃。',
  时间:'2010年-04月-13日-上午',状态:'进行中',地点:'藤美学园',分类:'宏观节点',更新时间:'2010年-04月-13日-上午'
};

const reply={
  摘要:'建立从校园沦陷到高城家阶段的宏观骨架。',
  事件:[
    {名称:'主角团集结与天台会合',操作:'更新',描述:'核心人物突破楼内封锁并在天台会合。',时间:'2010年-04月-13日-中午',状态:'待发生',地点:'藤美学园-主教学楼-天台',分类:'宏观节点',更新时间:'2010年-04月-13日-上午'},
    {名称:'校车争夺与校园突围',操作:'更新',描述:'幸存者夺取校车并突破正门离开校园。',时间:'2010年-04月-13日-下午',状态:'待发生',地点:'藤美学园-正门',分类:'宏观节点',更新时间:'2010年-04月-13日-上午'},
    {名称:'床主市大逃杀',操作:'更新',描述:'团队进入全面失序的床主市，城市生存阶段发生转折。',时间:'2010年-04月-14日',状态:'待发生',地点:'床主市-市区',分类:'宏观节点',更新时间:'2010年-04月-13日-上午'},
    {名称:'高城家堡垒战',操作:'更新',描述:'幸存者进入高城家据点阶段并面对大规模尸潮。',时间:'2010年-04月-15日',状态:'待发生',地点:'床主市-高城家庄园',分类:'宏观节点',更新时间:'2010年-04月-13日-上午'}
  ],
  因果:{
    当前阶段:'病毒爆发初期，藤美学园正在整体沦陷。',
    宏观顺序:['校园爆发与初步沦陷','床主市大逃杀','高城家堡垒战']
  }
};

let calls=0,writes=0,current=clone(stat);
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>{calls++;return JSON.stringify(reply);}}},
  getCurrentChatId:()=> 'macro-open-backbone',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'天台入口仍在抵抗死体冲击。'}]
};
host.Mvu={
  getMvuData:()=>({stat_data:clone(current)}),
  replaceMvuData:async data=>{writes++;current=clone(data.stat_data);}
};

(async()=>{
  const engine=new Engine(host);
  engine.config.enabled=true;
  engine.config.retryAttempts=0;
  engine.config.requireMacroBackbone=true;
  engine.worldbook=async()=>[];

  assert.equal(await engine.run(),true,'1个进行中宏观节点 + 2个待发生宏观节点应构成3节点可推进骨架');
  assert.equal(calls,1,'有效的3节点可推进骨架不应触发纠错重试');
  assert.equal(writes,1);

  const events=current.世界.后台.事件;
  assert.equal(events['主角团集结与天台会合'].分类,'近期节点','天台会合仍应被程序降级为近期节点');
  assert.equal(events['校车争夺与校园突围'].分类,'近期节点','校车争夺/突破仍应被程序降级为近期节点');
  const openMacro=Object.values(events).filter(e=>e.分类==='宏观节点'&&['进行中','待发生'].includes(e.状态));
  const futureMacro=openMacro.filter(e=>e.状态==='待发生');
  assert.equal(openMacro.length,3,'宏观骨架按进行中+待发生合计');
  assert.equal(futureMacro.length,2,'不应再硬性要求3个待发生节点');
  assert.match(current.世界.因果轨道.故事线,/校园爆发与初步沦陷.*床主市大逃杀.*高城家堡垒战/);

  console.log('world-engine open macro backbone acceptance passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
