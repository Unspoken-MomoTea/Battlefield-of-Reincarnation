const assert = require('node:assert/strict');
const {SamsaraWorldEngine: Engine, emptyState, RECORDS} = require('../script/世界推进系统.js');
const clone = value => JSON.parse(JSON.stringify(value));
const fresh = () => ({
  世界:{名称:'测试世界',时间:'2026年9月7日中午',地点:'军械库',后台:emptyState(),势力:{},探索:{},因果轨道:{偏移记录:{}}},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{},副本成就:{}},关系列表:{},传闻:{}
});

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

(async()=>{
  {
    const x=setup(async()=>JSON.stringify({摘要:'无变化'}));
    x.change(state=>{
      state.世界.后台.事件.军械库整备与资源清点={
        ...RECORDS.事件,
        描述:'清点军械库库存并完成整备',
        时间:'2026年9月7日上午',
        状态:'待发生'
      };
    });
    const first=await x.engine.buildRequest(x.engine.snapshot()),payload=JSON.parse(first.input);
    assert.deepEqual(payload.本轮必须复核的到期事件.map(item=>item.名称),['军械库整备与资源清点']);
    assert.match(payload.本轮必须复核的到期事件[0].说明,/优先填写新的“下次检查”/);
    assert.doesNotMatch(payload.本轮必须复核的到期事件[0].说明,/阻碍条件/);

    x.change(state=>{state.世界.后台.事件.军械库整备与资源清点.下次检查='2026年9月7日下午';});
    const deferred=JSON.parse((await x.engine.buildRequest(x.engine.snapshot())).input);
    assert.deepEqual(deferred.本轮必须复核的到期事件,[],'未来下次检查到来前不应反复催办同一事件');
  }

  {
    let calls=0,inputs=[];
    const x=setup(async (_system,input)=>{
      calls++;inputs.push(JSON.parse(input));
      if(calls===1)return JSON.stringify({摘要:'本轮没有新的世界事实'});
      return JSON.stringify({摘要:'军械库继续等待',事件:[{名称:'军械库整备与资源清点',下次检查:'2026年9月7日下午'}]});
    });
    x.change(state=>{
      state.世界.后台.事件.军械库整备与资源清点={
        ...RECORDS.事件,
        描述:'清点军械库库存并完成整备',
        时间:'2026年9月7日上午',
        状态:'待发生',
        条件:''
      };
    });
    assert.equal(await x.engine.run(),true);
    assert.equal(calls,2,'完全无视到期事件时只需纠正一次，不应被三字段硬校验连续卡死');
    assert.equal(x.writes(),1);
    const event=x.get().世界.后台.事件.军械库整备与资源清点;
    assert.equal(event.状态,'待发生');
    assert.equal(event.条件,'','延期不得强迫模型把触发条件改写成阻碍原因');
    assert.equal(event.下次检查,'2026年9月7日下午');
    assert.match(JSON.stringify(inputs[1].纠错重试),/优先填写新的“下次检查”/);
    assert.doesNotMatch(JSON.stringify(inputs[1].纠错重试),/复核日期、阻碍条件与下次检查/);
  }

  console.log('world-engine due event relaxation passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
