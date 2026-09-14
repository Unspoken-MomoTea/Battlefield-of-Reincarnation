const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));

function setup(){
  const timers=new Map(),handlers=new Map(),runs=[];
  let timerId=0,raw={},id=1,chat='auto-reprocess',calls=0,writes=0,fail=false;
  const sandbox={module:{exports:{}},console,AbortController,
    setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},
    clearTimeout:key=>timers.delete(key)};
  vm.runInNewContext(source,sandbox);
  const {SamsaraWorldEngine:Engine,emptyState}=sandbox.module.exports;
  const fresh=()=>({stat_data:{
    世界:{名称:'测试世界',时间:'2026年9月14日',地点:'城镇',后台:emptyState(),势力:{},探索:{},
      因果轨道:{当前阶段:'城镇生活',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},
    系统状态:{是否在主神空间:false,是否战斗中:false},设置:{},关系列表:{},传闻:{},资产:{}
  }});
  const host={localStorage:{getItem:()=>null,setItem:()=>{}},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
    eventOn:(event,fn)=>{handlers.set(event,fn);return()=>handlers.delete(event);},
    tavern_events:{CHAT_CHANGED:'chat',MESSAGE_SWIPED:'swipe',MESSAGE_DELETED:'delete'},
    getCurrentChatId:()=>chat,
    getChatMessages:()=>[{message_id:id,role:'assistant',message:'第'+id+'轮正文。'}],
    toastr:{error:()=>{}},
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>{
      calls++;if(fail)throw new Error('模拟接口暂时失败');
      return JSON.stringify({摘要:'本轮世界状态已复核。'});
    }}},
    Mvu:{events:{VARIABLE_UPDATE_ENDED:'mvu'},getMvuData:()=>clone(raw),replaceMvuData:async value=>{
      const before=raw;raw=clone(value);writes++;
      handlers.get('mvu')?.(clone(raw),clone(before));
    }}
  };
  const engine=new Engine(host);
  engine.config.enabled=true;engine.config.autoProgress=true;engine.config.autoProgressInterval=2;
  engine.config.requireMacroBackbone=false;engine.config.retryAttempts=1;engine.worldbook=async()=>[];
  const run=engine.run.bind(engine);
  engine.run=()=>{const promise=run();runs.push(promise);return promise;};
  engine.init();
  const emit=(after,before=raw)=>handlers.get('mvu')(clone(after),clone(before));
  return {engine,host,timers,fresh,emit,
    read:()=>clone(raw),write:value=>{raw=clone(value);},next:()=>{id++;},calls:()=>calls,writes:()=>writes,
    fail:value=>{fail=value;},switchChat:()=>{chat='other';handlers.get('chat')();},
    async flush(){
      const pending=[...timers].filter(([,item])=>item.delay===900);
      for(const [key,item] of pending){timers.delete(key);item.fn();}
      await Promise.allSettled(runs.splice(0));
    }
  };
}

(async()=>{
  // 酒馆开局常见形态：第二楼已经是第一篇正文，但变量里可能继承同聊天旧处理标记；后台本身仍为空。
  // 这时不能把“有已处理楼层”误当成“本轮周期已经推进过”，否则 interval=2 会直接吞掉开局正文。
  const opening=setup();
  const openingState=opening.fresh();
  openingState.stat_data.世界.后台.已处理楼层=JSON.stringify(['auto-reprocess',0,0,'opening-bootstrap']);
  opening.write(openingState);opening.emit(openingState);await opening.flush();
  assert.equal(opening.calls(),1,'第二楼开局：后台为空时，即使继承同聊天旧处理标记也必须立即自动推进');
  opening.engine.dispose();

  const x=setup();
  const original=x.fresh();
  // MVU 发出完成事件时，本楼层 stat_data 尚未写回。
  x.emit(original);x.emit(original);
  assert.equal(x.calls(),0);
  assert.equal(x.timers.size,1,'重复完成事件合并为一个延迟任务');
  x.write(original);await x.flush();
  assert.equal(x.calls(),1,'首次变量稍后写入也必须自动推进');
  assert.equal(x.writes(),1);
  assert.equal(x.timers.size,0,'世界引擎自身写回不能触发下一次自动推进');
  const firstHandled=x.read().stat_data.世界.后台.已处理楼层;
  x.emit(x.read());await x.flush();
  assert.equal(x.calls(),1,'普通重复通知不重算已完成楼层');

  // 点击重新处理：正文不变，后台标记回到上一次变量状态；root 提交标记可能残留。
  const reset={...original,__samsaraWorldCommit:firstHandled};
  x.write({});x.emit(reset,original);x.write(reset);await x.flush();
  assert.equal(x.calls(),2,'同一到期楼层重建变量后自动补跑');
  assert.equal(x.read().stat_data.世界.后台.已处理楼层,firstHandled);
  assert.equal(x.engine.autoProgressRoundsSinceRun,0,'重处理不额外消耗正文轮数');
  x.emit(x.read());await x.flush();
  assert.equal(x.calls(),2);

  x.next();const skipped=x.read();x.emit(skipped);x.write(skipped);await x.flush();
  assert.equal(x.calls(),2,'间隔2的第二轮仍跳过');
  assert.equal(x.engine.autoProgressRoundsSinceRun,1);
  x.write({});x.emit(skipped);x.write(skipped);await x.flush();
  assert.equal(x.calls(),2,'跳过轮重新处理不提前触发');
  assert.equal(x.engine.autoProgressRoundsSinceRun,1);

  x.next();const third=x.read();x.emit(third);x.write(third);await x.flush();
  assert.equal(x.calls(),3,'第三轮按原间隔推进');
  x.engine.config.autoProgress=false;
  x.write(third);x.emit(third);await x.flush();
  assert.equal(x.calls(),3,'自动开关关闭时不补跑');
  x.engine.config.autoProgress=true;
  x.host.__samsaraUIMutation=true;x.emit(third);x.host.__samsaraUIMutation=false;
  assert.equal(x.timers.size,0,'装备等UI写回不能误触发重处理');
  x.emit(third);await x.flush();assert.equal(x.calls(),4,'重新开启后到期楼层仍可补跑');

  x.next();const combat=x.read();combat.stat_data.系统状态.是否战斗中=true;
  x.emit(combat);x.write(combat);await x.flush();
  assert.equal(x.calls(),4);assert.equal(x.engine.autoProgressRoundsSinceRun,0,'战斗轮次不计入间隔');
  x.next();const peaceful=x.read();peaceful.stat_data.系统状态.是否战斗中=false;
  x.emit(peaceful);x.write(peaceful);await x.flush();
  assert.equal(x.calls(),4);assert.equal(x.engine.autoProgressRoundsSinceRun,1);
  x.next();x.fail(true);x.emit(x.read());await x.flush();
  assert.equal(x.calls(),5);
  x.fail(false);x.emit(x.read());await x.flush();
  assert.equal(x.calls(),6,'到期轮失败后，同楼重新处理可以再次尝试');

  x.next();x.emit(x.read());x.switchChat();await x.flush();
  assert.equal(x.calls(),6,'聊天切换取消待执行的旧聊天任务');
  x.engine.dispose();assert.equal(x.timers.size,0);
  console.log('PASS opening bootstrap, automatic progression after MVU reprocessing, persistence timing, cadence and loop guards');
})().catch(error=>{console.error(error);process.exitCode=1;});
