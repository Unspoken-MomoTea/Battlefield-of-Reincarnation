const assert = require('node:assert/strict');
const {SamsaraWorldEngine: Engine, emptyState, RECORDS} = require('../script/世界推进系统.js');
const clone = value => JSON.parse(JSON.stringify(value));
const fresh = () => {
  const backend=emptyState();
  backend.事件['军械库日常警戒']={...RECORDS.事件,描述:'守军维持军械库外围日常警戒。',时间:'2026年9月7日中午',状态:'进行中',分类:'当前事件',地点:'军械库'};
  backend.势力地区['军械库区域']={类型:'地区',描述:'城内军械库及外围道路。',目标:'维持警戒',进展:'守军保持常规轮值。',下次检查:'',关联事件:['军械库日常警戒'],公开动态:'守军照常巡逻。'};
  backend.势力地区['城防守军']={类型:'势力',描述:'负责城防与军械库警戒。',目标:'维持城防',进展:'执行常规轮值。',下次检查:'',关联事件:['军械库日常警戒'],公开动态:'守军正常执勤。'};
  return {
    世界:{名称:'测试世界',时间:'2026年9月7日中午',地点:'军械库',后台:backend,势力:{城防守军:{实力:'C',领地:'城内',描述:'负责城防与军械库警戒。',声望:0}},探索:{},因果轨道:{偏移记录:{}}},
    系统状态:{是否在主神空间:false},设置:{},任务:{列表:{},副本成就:{}},关系列表:{},传闻:{}
  };
};

function setup(request){
  let stat=fresh(),writes=0,text='守军仍在等待军械库调度。';
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    toastr:{error:()=>{}},
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request}},
    getCurrentChatId:()=> 'due-event-test',
    getChatMessages:()=>[{message_id:8,message:text,role:'assistant'}]
  };
  host.Mvu={getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async data=>{writes++;stat=clone(data.stat_data);}};
  const engine=new Engine(host);
  engine.config.enabled=true;
  engine.config.requireMacroBackbone=false;
  engine.config.retryAttempts=2;
  engine.worldbook=async()=>[];
  return {engine,get:()=>stat,writes:()=>writes,change:fn=>fn(stat),text:value=>{text=value;}};
}

function addDueEvent(state){
  state.世界.后台.事件.军械库整备与资源清点={
    ...RECORDS.事件,
    描述:'清点军械库库存并完成整备',
    时间:'2026年9月7日上午',
    状态:'待发生',
    条件:''
  };
}

(async()=>{
  {
    const x=setup(async()=>JSON.stringify({摘要:'无变化'}));
    x.change(addDueEvent);
    const first=await x.engine.buildRequest(x.engine.snapshot()),payload=JSON.parse(first.input);
    assert.deepEqual(payload.本轮必须复核的到期事件.map(item=>item.名称),['军械库整备与资源清点']);
    assert.match(payload.本轮必须复核的到期事件[0].说明,/软提醒/);
    assert.match(payload.本轮必须复核的到期事件[0].说明,/未处理不会导致本轮世界推进被驳回/);
    assert.doesNotMatch(payload.本轮必须复核的到期事件[0].说明,/阻碍条件/);

    x.change(state=>{state.世界.后台.事件.军械库整备与资源清点.下次检查='2026年9月7日下午';});
    const deferred=JSON.parse((await x.engine.buildRequest(x.engine.snapshot())).input);
    assert.deepEqual(deferred.本轮必须复核的到期事件,[],'未来下次检查到来前不应反复催办同一事件');
  }

  {
    let calls=0;
    const x=setup(async()=>{calls++;return JSON.stringify({
      摘要:'军械库整备暂未启动，但外围警戒继续推进。',
      势力地区:[{名称:'军械库区域',操作:'更新',类型:'地区',描述:'城内军械库及外围道路。',目标:'维持警戒',进展:'守军完成一次中午换岗。',关联事件:['军械库日常警戒'],公开动态:'外围巡逻完成换岗。'}]
    });});
    x.change(addDueEvent);
    assert.equal(await x.engine.run(),true);
    assert.equal(calls,1,'AI 暂时未处理到期事件也不得因此触发纠错重试');
    assert.equal(x.writes(),1);
    const event=x.get().世界.后台.事件.军械库整备与资源清点;
    assert.equal(event.状态,'待发生');
    assert.ok(!event.条件,'不得强迫模型把触发条件改写成阻碍原因');
    assert.ok(!event.下次检查,'未处理时保持待复核即可');
    assert.equal(x.engine.lastRetryLog.length,0,'到期事件软提醒不得制造失败记录');
  }

  {
    const x=setup(async()=>JSON.stringify({
      摘要:'军械库整备继续等待，外围警戒照常推进。',
      事件:[{名称:'军械库整备与资源清点',下次检查:'2026年9月7日下午'}],
      势力地区:[{名称:'军械库区域',操作:'更新',类型:'地区',描述:'城内军械库及外围道路。',目标:'维持警戒',进展:'守军把下一轮巡逻交接给午后班次。',关联事件:['军械库日常警戒'],公开动态:'外围警戒维持。'}]
    }));
    x.change(addDueEvent);
    assert.equal(await x.engine.run(),true);
    const event=x.get().世界.后台.事件.军械库整备与资源清点;
    assert.ok(!event.条件,'延期不得篡改事件触发条件');
    assert.equal(event.下次检查,'2026年9月7日下午');
    const after=JSON.parse((await x.engine.buildRequest(x.engine.snapshot())).input);
    assert.deepEqual(after.本轮必须复核的到期事件,[],'延期后在下次检查到来前保持安静');
  }

  console.log('world-engine due event relaxation passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
