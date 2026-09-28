const assert=require('node:assert/strict');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const NOW='2010年-04月-13日-上午';

// Exercise the registered render hook instead of binding the assertion to an old source file.
{
  const engine=new Engine({localStorage:{getItem:()=>null,setItem:()=>{}}});
  const removed=[];
  const detail=label=>({querySelector:()=>({textContent:label}),remove:()=>removed.push(label)});
  const sections=[
    {querySelector:()=>({textContent:'街头巷议'}),querySelectorAll:()=>[detail('主持人档案')]},
    {querySelector:()=>({textContent:'情报交易'}),querySelectorAll:()=>[detail('主持人档案'),detail('购买须知')]}
  ];
  engine.panel={querySelector:()=>({querySelectorAll:()=>sections})};
  engine.tab='世界推进';engine.services.rumorRequest.afterRender();
  assert.deepEqual(removed,[]);
  engine.tab='传闻';engine.services.rumorRequest.afterRender();
  assert.deepEqual(removed,['主持人档案'],'只移除情报交易中的主持人档案，保留其它区块和购买说明');
}

function filledRumors(){
  return {
    街头巷议:{旧校闻:{来源:'学生',内容:'校门最近盘查变严，似乎有人失踪。',可信度:'可疑'}},
    情报交易:{旧情报:{卖家:'流动商人',情报评级:'F',摘要:'北门附近有人收购药品。',要价:'20日元',真实内幕:'只是零散囤货。'}},
    布告与檄文:{旧公告:{发布者:'学生会',内容:'夜间不要单独前往旧校舍。',张贴位置:'主教学楼'}}
  };
}
function freshState({rumors,stalePropagation=false}={}){
  const backend=emptyState();
  backend.势力地区['北城学园']={...clone(RECORDS.势力地区),类型:'地区',描述:'正在加强出入管理的校园',更新时间:NOW};
  backend.势力地区['北城学园校方']={...clone(RECORDS.势力地区),类型:'势力',描述:'负责校园警戒与管理',更新时间:NOW};
  backend.事件['校门封锁']={
    ...clone(RECORDS.事件),分类:'当前事件',描述:'校方临时封锁北门并检查离校人员。',时间:NOW,条件:'连续失踪事件引发警戒',前因:[],状态:'进行中',
    默认走向:'封锁继续扩大。',结果:'',公开征兆:'北门增设警戒线与临时岗哨。',地点:'北城学园-北门',更新时间:NOW
  };
  if(stalePropagation){
    backend.传播['北门封锁消息']={
      ...clone(RECORDS.传播),关联事件:['校门封锁'],来源:'目击学生',范围:'北门附近',时间:'2010年-04月-10日-上午',
      内容:'有人说北门突然不让出校。',真相:'校方因连续失踪事件临时加强警戒。',状态:'传播中',
      更新时间:'2010年-04月-10日-上午',到期时间:'',受众:['北门附近学生'],引发行动:[]
    };
  }
  return {
    世界:{名称:'测试末日世界',时间:NOW,地点:'北城学园-主教学楼',稳定:100,后台:backend,
      因果轨道:{当前阶段:'校内警戒升级',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},势力:{北城学园校方:{实力:'F',领地:'北城学园',描述:'负责校园警戒与管理',声望:0}},探索:{},法则:[],货币:{体系:'日元',购买力基准:'便利店餐食约500日元',经济波动:''},历法:{}},
    设置:{单一世界:true},系统状态:{是否在主神空间:false},资产:{},关系列表:{},传闻:rumors===undefined?{街头巷议:{},情报交易:{},布告与檄文:{}}:clone(rumors)
  };
}
function setup({state=freshState(),reply}={}){
  let current=clone(state),calls=0;
  const message={message_id:7,role:'assistant',message:'北门外的警戒线又向外挪了一段，路过的学生都在低声议论。'};
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'rumor-liveliness-test',getChatMessages:()=>[message],
    Mvu:{getMvuData:()=>({stat_data:clone(current)}),replaceMvuData:async raw=>{current=clone(raw.stat_data);}},
    Samsara:{terminal:{apiReady:()=>true,request:async()=>{calls++;return typeof reply==='function'?reply(calls):String(reply||'');}},validateWorldState:stat=>clone(stat)},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},toastr:{error:()=>{}}
  };
  const engine=new Engine(host);engine.worldbook=async()=>[];engine.config.contextTurns=1;engine.config.requireMacroBackbone=false;engine.config.retryAttempts=1;engine.config.enabled=true;
  return {engine,getState:()=>clone(current),getCalls:()=>calls,markProcessed:()=>{current.世界.后台.已处理楼层=engine.snapshot().fingerprint;}};
}
function livelyReply(){
  return JSON.stringify({
    摘要:'补齐本地传闻并建立北门封锁的传播链。',
    事件:[{名称:'校门封锁',操作:'更新',描述:'校方已经把警戒线扩至北门外。'}],
    传播:[{名称:'北门封锁消息',操作:'更新',关联事件:['校门封锁'],来源:'目击学生',范围:'北城学园校内',时间:NOW,
      内容:'北门临时封锁的消息已从现场学生扩散到各班。',真相:'校方因连续失踪事件加强警戒。',状态:'传播中',更新时间:NOW,到期时间:'2010年-04月-14日-上午',受众:['学生','教职工'],引发行动:['部分学生改走南门']}],
    传闻:{
      街头巷议:[
        {名称:'北门突然封了',操作:'更新',来源:'二年级学生',内容:'北门今早突然拉起警戒线，离校都要登记，有人说是因为最近连续有人失踪。',可信度:'或许可信'},
        {名称:'南门开始排队',操作:'更新',来源:'食堂阿姨',内容:'不少学生听说北门封锁后改走南门，午休前南门已经排起长队，保安也开始逐个查证件。',可信度:'或许可信'}
      ],
      情报交易:[
        {名称:'封锁原因',操作:'更新',卖家:'摄影部学生',情报评级:'F',摘要:'出售北门封锁前拍到的校车与警车照片。',要价:'500日元',真实内幕:'照片显示校方比公开通知更早开始调动保安。'},
        {名称:'南门巡逻表',操作:'更新',卖家:'校内跑腿人',情报评级:'F',摘要:'提供今天南门保安换岗的大致时间。',要价:'300日元',真实内幕:'时间来自观察，可能有十分钟左右误差。'}
      ],
      布告与檄文:[
        {名称:'临时出入管理通知',操作:'更新',发布者:'北城学园校方',内容:'即日起北门实行临时出入登记，请学生优先使用南门并随身携带学生证。',张贴位置:'主教学楼公告栏'},
        {名称:'社团活动提前结束',操作:'更新',发布者:'学生会',内容:'今日放学后社团活动统一提前结束，禁止学生在旧校舍与北门区域逗留。',张贴位置:'各班公告板'}
      ]
    }
  });
}

(async()=>{
  {
    const x=setup();
    const request=await x.engine.buildRequest(x.engine.snapshot()),payload=JSON.parse(request.input);
    assert.match(request.system,/【信息传播 · 世界侧事实】/,'系统提示使用当前已注册的世界侧取材规则');
    assert.deepEqual(payload.传闻维护.话题,['悬赏线索','商路动向','势力情报','遗迹坐标','人物行踪','黑市消息','宝物传闻','怪物异动','深渊异变','种族摩擦','物价波动']);
    for(const category of ['街头巷议','情报交易','布告与檄文'])assert.equal(payload.传闻维护.公开传闻[category].为空补足,1,category+'为空时按软维护规则优先补1条');
    assert.ok(payload.传闻维护.本轮新公开事实.some(item=>item.名称==='校门封锁'),'有公开征兆的事件应进入世界侧事实池');
  }

  {
    const x=setup({reply:livelyReply()});
    assert.equal(await x.engine.run(),true,'三类空传闻应能在一次世界推进中补活');
    const state=x.getState();
    for(const category of ['街头巷议','情报交易','布告与檄文'])assert.equal(Object.keys(state.传闻[category]).length,2,category+'应从空列表补成2条');
    assert.equal(state.世界.后台.传播['北门封锁消息'].更新时间,NOW,'公开传闻背后的传播链应同步建立');
  }

  {
    const state=freshState({rumors:filledRumors(),stalePropagation:true});
    const x=setup({state,reply:JSON.stringify({摘要:'世界事件推进，传播暂未复核。',事件:[{名称:'校门封锁',操作:'更新',描述:'校方已经把警戒线扩至北门外。'}]})});
    assert.equal(await x.engine.run(),true,'未完成的传播复核属于软维护，不否决本轮');
    assert.equal(x.getCalls(),1,'未维护传播链不得触发整轮重试');
    const next=x.getState();
    assert.equal(x.engine.services.rumor.maintenanceNeeded(next),true,'未复核传播链仍保留为后续维护项');
  }

  {
    const state=freshState({rumors:filledRumors()});
    const reply=JSON.stringify({摘要:'事件更新，错误传闻保留为诊断。',
      事件:[{名称:'校门封锁',操作:'更新',描述:'校方已增加北门巡逻。'}],
      传闻:{情报交易:[{名称:'错误传闻',操作:'更新',卖家:'居民',摘要:'错误货币',要价:'20空间币',情报评级:'F',真实内幕:'测试'}]},
      传播:[{名称:'错误传播',操作:'更新',关联事件:['不存在的事件']}]});
    const x=setup({state,reply});x.engine.config.retryAttempts=3;
    assert.equal(await x.engine.run(),true,'传闻和传播软失败不得阻止其它已验收片段提交');
    assert.equal(x.getCalls(),1,'实际主流程不能因传闻软失败重试');
    assert.equal(x.getState().世界.后台.事件.校门封锁.描述,'校方已增加北门巡逻。');
    assert.equal(x.getState().传闻.情报交易.错误传闻,undefined);
    assert.equal(x.getState().世界.后台.传播.错误传播,undefined);
    assert.equal(x.engine.lastRequest.manifest.软失败片段.length,2,'请求检查保留被丢弃片段的原因');
  }

  {
    const state=freshState({rumors:filledRumors(),stalePropagation:true});
    const reply=JSON.stringify({摘要:'北门封锁消息继续扩散。',事件:[{名称:'校门封锁',操作:'更新',描述:'校方已经把警戒线扩至北门外。'}],传播:[{名称:'北门封锁消息',操作:'更新',范围:'全校',更新时间:NOW,受众:['学生','教职工','家长群'],引发行动:['更多学生改走南门']}]});
    const x=setup({state,reply});
    x.markProcessed();
    assert.equal(await x.engine.run(),true,'即使楼层已处理，陈旧传播链也应允许触发修复运行');
    assert.equal(x.getCalls(),1,'传播维护修复应实际发起一次模型请求');
    const spread=x.getState().世界.后台.传播['北门封锁消息'];
    assert.equal(spread.范围,'全校');assert.equal(spread.更新时间,NOW);assert.ok(spread.受众.includes('家长群'));
  }

  console.log('world-engine rumor liveliness regression tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
