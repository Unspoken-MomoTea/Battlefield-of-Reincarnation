const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));

function setup(){
  const timers=new Map(),handlers=new Map(),runs=[];
  let timerId=0,raw={},id=1,chat='auto-reprocess',calls=0,writes=0,fail=false;
  const addHandler=(event,fn,first=false)=>{
    const list=handlers.get(event)||[];
    if(first)list.unshift(fn);else list.push(fn);
    handlers.set(event,list);
    return()=>{const current=handlers.get(event)||[],next=current.filter(item=>item!==fn);if(next.length)handlers.set(event,next);else handlers.delete(event);};
  };
  const emitEvent=async(event,...args)=>{
    for(const fn of [...(handlers.get(event)||[])])await fn(...args);
  };
  const sandbox={module:{exports:{}},console,AbortController,
    setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},
    clearTimeout:key=>timers.delete(key)};
  vm.runInNewContext(source,sandbox);
  const {SamsaraWorldEngine:Engine,emptyState}=sandbox.module.exports;
  const fresh=()=>({stat_data:{
    世界:{名称:'测试世界',时间:'2026年9月14日',地点:'城镇',稳定:100,后台:emptyState(),势力:{},探索:{},
      因果轨道:{当前阶段:'城镇生活',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
    系统状态:{是否在主神空间:false,是否战斗中:false},设置:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}},资产:{}
  }});
  const host={localStorage:{getItem:()=>null,setItem:()=>{}},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
    eventOn:(event,fn)=>addHandler(event,fn,false),
    eventMakeFirst:(event,fn)=>addHandler(event,fn,true),
    tavern_events:{CHAT_CHANGED:'chat',MESSAGE_SWIPED:'swipe',MESSAGE_DELETED:'delete'},
    getCurrentChatId:()=>chat,
    getChatMessages:()=>[{message_id:id,role:'assistant',message:'第'+id+'轮正文。',swipe_id:0}],
    toastr:{error:()=>{}},
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>{
      calls++;if(fail)throw new Error('模拟接口暂时失败');
      return JSON.stringify({摘要:'本轮世界状态已复核。',因果:{当前阶段:'推进结果#'+calls}});
    }}},
    Mvu:{events:{VARIABLE_UPDATE_ENDED:'mvu'},getMvuData:()=>clone(raw),replaceMvuData:async value=>{
      const before=clone(raw),next=clone(value);writes++;
      await emitEvent('mvu',next,before);
      raw=clone(next);
    }}
  };
  const engine=new Engine(host);
  engine.config.enabled=true;engine.config.autoProgress=true;engine.config.autoProgressInterval=2;
  engine.config.requireMacroBackbone=false;engine.config.retryAttempts=1;engine.worldbook=async()=>[];
  const run=engine.run.bind(engine);
  engine.run=(...args)=>{const promise=run(...args);runs.push(promise);return promise;};
  engine.init();
  return {engine,host,timers,fresh,
    read:()=>clone(raw),write:value=>{raw=clone(value);},next:()=>{id++;},calls:()=>calls,writes:()=>writes,
    fail:value=>{fail=value;},
    async emit(after,before=raw){const next=clone(after);await emitEvent('mvu',next,clone(before));return next;},
    persistReprocess:variables=>{raw=Object.assign({},clone(raw),clone(variables));},
    async switchChat(){chat='other';await emitEvent('chat');},
    async flush(){
      let guard=0;
      while(timers.size&&guard++<20){
        const pending=[...timers];timers.clear();
        for(const [,item] of pending)item.fn();
        await Promise.allSettled(runs.splice(0));
      }
      await Promise.allSettled(runs.splice(0));
    }
  };
}

(async()=>{
  const x=setup();
  const original=x.fresh();

  // 首次正文：VARIABLE_UPDATE_ENDED 仍发生在当前楼层最终 MVU 写回之前。
  const initialEvent=await x.emit(original,{});
  x.write(initialEvent);
  await x.flush();
  assert.equal(x.calls(),1,'首个应推进正文必须调用一次世界 AI');
  const first=x.read();
  const firstFingerprint=x.engine.snapshot().fingerprint;
  assert.equal(first.stat_data.世界.因果轨道.当前阶段,'推进结果#1');
  assert.equal(first.stat_data.世界.后台.已处理楼层,firstFingerprint);
  assert.equal(first.__samsaraWorldCommit,firstFingerprint);
  assert.equal(first.__samsaraWorldReplay?.fingerprint,firstFingerprint,'成功推进必须保存当前正文的恢复包');
  assert.ok(Array.isArray(first.__samsaraWorldReplay?.operations)&&first.__samsaraWorldReplay.operations.length>0,'恢复包必须保存实际成功提交的数据差异');
  assert.match(JSON.stringify(first.__samsaraWorldReplay),/推进结果#1/,'恢复包必须包含世界推进真正写入的业务数据，而不只是处理标记');

  // 真实“重新处理变量”：按钮先清空当前消息 stat_data/schema，但未知 root 字段保留；
  // MVU 再从上一有效变量解析同一正文。这里必须重放成功结果，绝不能再次调用世界 AI。
  x.write({__samsaraWorldCommit:firstFingerprint,__samsaraWorldReplay:clone(first.__samsaraWorldReplay)});
  const rebuilt=x.fresh();
  const replayed=await x.emit(rebuilt,first);
  assert.equal(x.calls(),1,'重新处理变量的事件阶段不得调用世界 AI');
  assert.equal(replayed.stat_data.世界.因果轨道.当前阶段,'推进结果#1','同一正文应直接恢复上一次已确认的世界推进结果');
  assert.equal(replayed.stat_data.世界.后台.已处理楼层,firstFingerprint,'恢复时必须一并恢复本楼已处理标记');
  x.persistReprocess(replayed);
  await x.flush();
  assert.equal(x.calls(),1,'重新处理变量落库以后也不得异步补跑世界 AI');
  assert.equal(x.read().stat_data.世界.因果轨道.当前阶段,'推进结果#1');
  assert.equal(x.engine.autoProgressRoundsSinceRun,0,'恢复旧结果不消耗新的正文轮次');

  // interval=2 的第二个正文是跳过楼。它继承上一楼 root 恢复包也不能误用，因为正文指纹不同。
  x.next();
  const second=x.read();
  const secondEvent=await x.emit(second,x.read());x.write(secondEvent);await x.flush();
  assert.equal(x.calls(),1,'间隔2的第二轮必须跳过');
  assert.equal(x.engine.autoProgressRoundsSinceRun,1);
  const inheritedReplay=clone(x.read().__samsaraWorldReplay);
  x.write({__samsaraWorldCommit:x.read().__samsaraWorldCommit,__samsaraWorldReplay:inheritedReplay});
  const secondRebuilt=x.fresh();
  secondRebuilt.stat_data.世界.因果轨道.当前阶段='第二轮变量重处理结果';
  const skippedReplay=await x.emit(secondRebuilt,second);
  assert.equal(skippedReplay.stat_data.世界.因果轨道.当前阶段,'第二轮变量重处理结果','跳过楼不得套用上一楼的恢复包');
  x.persistReprocess(skippedReplay);await x.flush();
  assert.equal(x.calls(),1,'跳过楼重新处理变量不得提前触发世界推进');
  assert.equal(x.engine.autoProgressRoundsSinceRun,1);

  // 第三个正文再次到期，成功后生成属于第三楼的新恢复包。
  x.next();
  const third=x.read();
  const thirdEvent=await x.emit(third,x.read());x.write(thirdEvent);await x.flush();
  assert.equal(x.calls(),2,'第三轮按间隔正常推进');
  const thirdSaved=x.read(),thirdFingerprint=x.engine.snapshot().fingerprint;
  assert.equal(thirdSaved.stat_data.世界.因果轨道.当前阶段,'推进结果#2');
  assert.equal(thirdSaved.__samsaraWorldReplay?.fingerprint,thirdFingerprint);
  assert.notEqual(thirdSaved.__samsaraWorldReplay?.fingerprint,firstFingerprint);

  // 手动“推进世界”是唯一允许同正文真正重新推演的入口；旧数据必须保留到新请求成功。
  const beforeManual=clone(x.read());
  x.fail(true);
  await assert.rejects(()=>x.engine.run(),/模拟接口暂时失败/);
  assert.equal(x.calls(),3);
  assert.deepEqual(x.read(),beforeManual,'手动重推失败时不能先清空已确认的世界数据与恢复包');
  x.fail(false);
  assert.equal(await x.engine.run(),true,'手动按钮必须允许同一已处理正文强制重推');
  assert.equal(x.calls(),4);
  assert.equal(x.read().stat_data.世界.因果轨道.当前阶段,'推进结果#4');
  assert.equal(x.read().__samsaraWorldReplay?.fingerprint,thirdFingerprint,'手动重推成功后仍绑定同一正文指纹');
  assert.match(JSON.stringify(x.read().__samsaraWorldReplay),/推进结果#4/,'手动重推成功必须覆盖旧恢复结果');
  assert.doesNotMatch(JSON.stringify(x.read().__samsaraWorldReplay),/推进结果#2/,'旧恢复结果不能继续残留为当前权威数据');

  // 普通变量通知、UI 写回、聊天切换仍不能误触发。
  const callsBefore=x.calls();
  await x.emit(x.read());await x.flush();
  assert.equal(x.calls(),callsBefore,'普通重复变量通知不重复推进');
  x.host.__samsaraUIMutation=true;await x.emit(x.read());x.host.__samsaraUIMutation=false;await x.flush();
  assert.equal(x.calls(),callsBefore,'UI 写回不触发世界推进');
  x.next();await x.emit(x.read());await x.switchChat();await x.flush();
  assert.equal(x.calls(),callsBefore,'聊天切换取消旧聊天待执行任务');

  x.engine.dispose();assert.equal(x.timers.size,0);
  console.log('PASS successful world replay on MVU reprocess, skipped-floor isolation, manual force-rerun and rollback safety');
})().catch(error=>{console.error(error);process.exitCode=1;});
