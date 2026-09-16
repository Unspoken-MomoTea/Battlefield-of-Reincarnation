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
  const host={localStorage:{getItem:()=>null,setItem:()=>{}},document:{addEventListener:()=>{},removeEventListener:()=>{}},eventOn:()=>()=>{},eventMakeFirst:(event,fn)=>{if(event==='mvu')firstMvuHandler=fn;return()=>{};},tavern_events:{},getCurrentChatId:()=> 'missing-replay-policy',getChatMessages:()=>[{message_id:1,role:'assistant',message:'这一楼正文保持不变。',swipe_id:0}],toastr:{error:()=>{}},Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>{calls++;return JSON.stringify({摘要:'不应重新调用AI。'});}}},Mvu:{events:{VARIABLE_UPDATE_ENDED:'mvu'},getMvuData:()=>clone(raw),replaceMvuData:async value=>{raw=clone(value);}}};
  raw=fresh();
  const engine=new Engine(host);engine.config.enabled=true;engine.config.autoProgress=autoProgress;engine.config.requireMacroBackbone=false;engine.config.retryAttempts=1;engine.worldbook=async()=>[];engine.init();
  const fingerprint=engine.snapshot().fingerprint;
  const previous=fresh();previous.stat_data.世界.后台.已处理楼层=fingerprint;raw={};
  return {engine,fresh,calls:()=>calls,runReprocess:()=>firstMvuHandler(fresh(),previous),resolve:()=>resolveRequest?.(),read:()=>clone(raw)};
}

(async()=>{
  for(const autoProgress of [true,false]){
    const x=setup(autoProgress);
    const result=await x.runReprocess();
    assert.equal(result,true,'before 中的已处理楼层足以证明旧结果，应直接恢复而不是重新推演');
    assert.equal(x.calls(),0,'缺 replay 但 before 可恢复时不得重新调用世界 AI');
    assert.match(x.engine.status,/已从旧楼状态重建并恢复世界推进结果|已恢复本楼世界推进结果/);
  }
  console.log('PASS missing replay recovers from VARIABLE_UPDATE_ENDED before snapshot without rerunning world AI');
})().catch(error=>{console.error(error);process.exitCode=1;});
