const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));

function setup(autoProgress){
  let raw={},firstMvuHandler=null,calls=0;
  const sandbox={module:{exports:{}},console,AbortController,setTimeout,clearTimeout};
  vm.runInNewContext(source,sandbox);
  const {SamsaraWorldEngine:Engine,emptyState}=sandbox.module.exports;
  const fresh=()=>({stat_data:{世界:{名称:'测试世界',时间:'2026年09月14日',地点:'城镇',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'重处理后的原始变量',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}}},系统状态:{是否在主神空间:false,是否战斗中:false},设置:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}},资产:{}}});
  const host={localStorage:{getItem:()=>null,setItem:()=>{}},document:{addEventListener:()=>{},removeEventListener:()=>{}},eventOn:()=>()=>{},eventMakeFirst:(event,fn)=>{if(event==='mvu')firstMvuHandler=fn;return()=>{};},tavern_events:{},getCurrentChatId:()=> 'missing-replay-policy',getChatMessages:()=>[{message_id:1,role:'assistant',message:'这一楼正文保持不变。',swipe_id:0}],toastr:{error:()=>{}},Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>{calls++;return JSON.stringify({摘要:'不应重新调用AI。'});}}},Mvu:{events:{VARIABLE_UPDATE_ENDED:'mvu'},getMvuData:()=>clone(raw),replaceMvuData:async value=>{raw=clone(value);}}};
  raw=fresh();
  const engine=new Engine(host);engine.config.enabled=true;engine.config.autoProgress=autoProgress;engine.config.requireMacroBackbone=false;engine.config.retryAttempts=1;engine.worldbook=async()=>[];engine.init();
  const fingerprint=engine.snapshot().fingerprint;
  const previous=fresh();
  previous.stat_data.世界.后台.已处理楼层=fingerprint;
  previous.stat_data.世界.因果轨道.当前阶段='已提交的旧世界结果';
  raw={};
  return {
    engine,
    calls:()=>calls,
    runReprocess:async()=>{
      const variables=fresh();
      const result=await firstMvuHandler(variables,previous);
      return {result,variables};
    }
  };
}

(async()=>{
  for(const autoProgress of [true,false]){
    const x=setup(autoProgress);
    const {result,variables}=await x.runReprocess();
    assert.equal(result,true,'before 快照足以恢复缺失 replay 时应直接恢复');
    assert.equal(x.calls(),0,'恢复旧楼不得重新调用世界 AI');
    assert.equal(variables.stat_data.世界.因果轨道.当前阶段,'已提交的旧世界结果');
    assert.ok(variables.__samsaraWorldReplay,'从 before 恢复后应重建 replay 根快照');
    assert.match(x.engine.status,/已从旧楼状态重建并恢复世界推进结果|已恢复本楼世界推进结果/);
  }
  console.log('PASS missing replay recovers from VARIABLE_UPDATE_ENDED before snapshot without rerunning world AI');
})().catch(error=>{console.error(error);process.exitCode=1;});
