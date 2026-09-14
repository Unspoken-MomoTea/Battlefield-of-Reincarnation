const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));

function setup(autoProgress){
  const timers=new Map();
  let timerId=0,raw={},firstMvuHandler=null,calls=0;
  const sandbox={module:{exports:{}},console,AbortController,
    setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},
    clearTimeout:key=>timers.delete(key)};
  vm.runInNewContext(source,sandbox);
  const {SamsaraWorldEngine:Engine,emptyState}=sandbox.module.exports;
  const fresh=()=>({stat_data:{
    世界:{名称:'测试世界',时间:'2026年09月14日',地点:'城镇',稳定:100,后台:emptyState(),势力:{},探索:{},
      因果轨道:{当前阶段:'旧变量结果',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
    系统状态:{是否在主神空间:false,是否战斗中:false},设置:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}},资产:{}
  }});
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
    // 故意不把普通 VARIABLE_UPDATE_ENDED 监听接进测试：缺快照分支必须自己安排补跑，不能依赖基础监听兜底。
    eventOn:()=>()=>{},
    eventMakeFirst:(event,fn)=>{if(event==='mvu')firstMvuHandler=fn;return()=>{if(firstMvuHandler===fn)firstMvuHandler=null;};},
    tavern_events:{CHAT_CHANGED:'chat',MESSAGE_SWIPED:'swipe',MESSAGE_DELETED:'delete'},
    getCurrentChatId:()=> 'missing-replay-policy',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'这一楼正文保持不变。',swipe_id:0}],
    toastr:{error:()=>{}},
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>{
      calls++;
      return JSON.stringify({摘要:'重新建立本楼世界结果。',因果:{当前阶段:'自动补跑结果#'+calls}});
    }}},
    Mvu:{events:{VARIABLE_UPDATE_ENDED:'mvu'},getMvuData:()=>clone(raw),replaceMvuData:async value=>{raw=clone(value);}}
  };
  raw=fresh();
  const engine=new Engine(host);
  engine.config.enabled=true;
  engine.config.autoProgress=autoProgress;
  engine.config.autoProgressInterval=5;
  engine.config.requireMacroBackbone=false;
  engine.config.retryAttempts=1;
  engine.worldbook=async()=>[];
  engine.init();
  const fingerprint=engine.snapshot().fingerprint;
  // 模拟旧版本留下 commit、但 replay 从未持久化；重新处理按钮已经清空本楼 stat_data。
  raw={__samsaraWorldCommit:fingerprint};
  return {
    engine,fresh,fingerprint,timers,calls:()=>calls,
    async beginReprocess(){
      assert.equal(typeof firstMvuHandler,'function','replay first-listener must be bound');
      const variables=fresh();
      await firstMvuHandler(variables,{});
      return variables;
    },
    persistReprocess(variables){raw=Object.assign({},clone(raw),clone(variables));},
    async tick(){
      const pending=[...timers.values()];timers.clear();
      for(const item of pending)item.fn();
      await new Promise(resolve=>setImmediate(resolve));
    },
    async flush(){
      let guard=0;
      while(timers.size&&guard++<20)await this.tick();
      await new Promise(resolve=>setImmediate(resolve));
    },
    read:()=>clone(raw)
  };
}

(async()=>{
  {
    const x=setup(true);
    const variables=await x.beginReprocess();
    assert.match(x.engine.status,/正在自动重新推进本楼/,'自动推进开启时，缺快照判定应直接进入自动补跑状态');
    assert.doesNotMatch(x.engine.status,/旧楼缺少恢复快照/,'自动推进开启时不应向玩家弹出缺快照停滞提示');
    assert.ok(x.timers.size>0,'缺快照分支必须主动安排自动推进，不能依赖别的 VARIABLE_UPDATE_ENDED 监听兜底');

    // 真实 MVU 的 VARIABLE_UPDATE_ENDED 早于本楼最终写回。第一次补跑检查时如果 stat_data 还没落盘，
    // 任务必须继续等待，不能只留下“正在自动重新推进本楼”的提示后悄悄丢失。
    await x.tick();
    assert.equal(x.calls(),0,'MVU 尚未写回时不得提前请求世界 AI');
    assert.ok(x.timers.size>0,'MVU 尚未写回时缺快照补跑必须继续重试等待');
    assert.equal(x.engine.worldReplayRecoveryPending,true,'等待 MVU 写回期间必须保留明确的补跑排队状态');

    x.persistReprocess(variables);
    await x.flush();
    assert.equal(x.calls(),1,'MVU 写回后，同一已处理楼缺快照应自动重跑一次世界 AI');
    assert.equal(x.read().stat_data.世界.因果轨道.当前阶段,'自动补跑结果#1');
    assert.equal(x.read().__samsaraWorldReplay?.fingerprint,x.fingerprint,'自动补跑成功后必须重新建立 replay');
    assert.equal(x.engine.worldReplayRecoveryPending,false,'真正进入补跑后必须清除等待状态');
    x.engine.dispose();
  }

  {
    const x=setup(false);
    const variables=await x.beginReprocess();
    x.persistReprocess(variables);
    assert.equal(x.calls(),0);
    assert.equal(x.timers.size,0,'自动推进关闭时不得安排补跑');
    assert.match(x.engine.status,/旧楼缺少恢复快照/,'只有自动推进关闭时才提示缺少恢复快照');
    assert.match(x.engine.status,/自动推进已关闭/);
    await x.flush();
    assert.equal(x.calls(),0,'关闭自动推进后保持等待手动推进');
    x.engine.dispose();
  }

  // UI 必须区分“已经排队但尚未进入请求”和普通待命，避免只显示状态文字而按钮毫无变化。
  assert.match(source,/worldReplayRecoveryPending/,'delivery must expose the missing-replay recovery pending state');
  assert.match(source,/等待推进…/,'run button must visibly show the queued recovery state before busy=true');

  console.log('PASS missing replay waits through delayed MVU writeback, visibly queues, then auto-retries when enabled');
})().catch(error=>{console.error(error);process.exitCode=1;});
