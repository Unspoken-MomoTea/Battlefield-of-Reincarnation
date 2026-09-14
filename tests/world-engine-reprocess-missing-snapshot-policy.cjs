const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));

function setup(autoProgress){
  let raw={},firstMvuHandler=null,calls=0,resolveRequest=null;
  const sandbox={module:{exports:{}},console,AbortController,setTimeout,clearTimeout};
  vm.runInNewContext(source,sandbox);
  const {SamsaraWorldEngine:Engine,emptyState}=sandbox.module.exports;
  const fresh=()=>({stat_data:{世界:{名称:'测试世界',时间:'2026年09月14日',地点:'城镇',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'旧变量结果',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},系统状态:{是否在主神空间:false,是否战斗中:false},设置:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}},资产:{}}});
  const host={localStorage:{getItem:()=>null,setItem:()=>{}},document:{addEventListener:()=>{},removeEventListener:()=>{}},eventOn:()=>()=>{},eventMakeFirst:(event,fn)=>{if(event==='mvu')firstMvuHandler=fn;return()=>{};},tavern_events:{},getCurrentChatId:()=> 'missing-replay-policy',getChatMessages:()=>[{message_id:1,role:'assistant',message:'这一楼正文保持不变。',swipe_id:0}],toastr:{error:()=>{}},Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>{calls++;return await new Promise(resolve=>{resolveRequest=()=>resolve(JSON.stringify({摘要:'重新建立本楼世界结果。',因果:{当前阶段:'自动补跑结果#'+calls}}));});}}},Mvu:{events:{VARIABLE_UPDATE_ENDED:'mvu'},getMvuData:()=>clone(raw),replaceMvuData:async value=>{raw=clone(value);}}};
  raw=fresh();
  const engine=new Engine(host);engine.config.enabled=true;engine.config.autoProgress=autoProgress;engine.config.requireMacroBackbone=false;engine.config.retryAttempts=1;engine.worldbook=async()=>[];engine.init();
  const fingerprint=engine.snapshot().fingerprint;raw={__samsaraWorldCommit:fingerprint};
  return {engine,fresh,calls:()=>calls,runReprocess:()=>firstMvuHandler(fresh(),{}),resolve:()=>resolveRequest?.(),read:()=>clone(raw)};
}

(async()=>{
  const x=setup(true);
  const pending=x.runReprocess();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(x.calls(),1,'缺 replay 时 VARIABLE_UPDATE_ENDED 应当立即发送世界推进请求，不经过 schedule 等待');
  assert.equal(x.engine.busy,true,'请求发出后按钮所依赖的 busy 必须立即进入运行态');
  assert.match(x.engine.status,/正在读取世界资料|正在重新推进本楼/);
  x.resolve();
  await pending;
  assert.equal(x.read().stat_data.世界.因果轨道.当前阶段,'自动补跑结果#1');
  assert.ok(x.read().__samsaraWorldReplay,'立即补跑成功后必须重新建立 replay');

  const y=setup(false);
  const result=await y.runReprocess();
  assert.equal(result,false);assert.equal(y.calls(),0);assert.match(y.engine.status,/自动推进已关闭/);
  console.log('PASS missing replay reruns immediately from VARIABLE_UPDATE_ENDED when auto progress is enabled');
})().catch(error=>{console.error(error);process.exitCode=1;});
