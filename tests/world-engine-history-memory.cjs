const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {SamsaraWorldEngine:Engine,emptyState,compactWorldLifecycle,projectWorldContext}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

function filledRumors(){
  return {
    街头巷议:{a:{来源:'旅人',内容:'北门盘查变严。',可信度:'可信'},b:{来源:'商贩',内容:'港口税率未变。',可信度:'可信'}},
    情报交易:{a:{卖家:'斥候',情报评级:'F',摘要:'城外道路畅通。',要价:'10',真实内幕:'属实'},b:{卖家:'脚夫',情报评级:'F',摘要:'西门换岗。',要价:'10',真实内幕:'属实'}},
    布告与檄文:{a:{发布者:'城务厅',内容:'夜间宵禁。',张贴位置:'广场'},b:{发布者:'卫队',内容:'进城须登记。',张贴位置:'城门'}}
  };
}
function historyAnchors(count){
  const out={};
  for(let i=1;i<=count;i++)out['历史'+String(i).padStart(3,'0')]={时间:'第'+i+'日',事实:'第'+i+'件已经确认的世界历史事实。',关联事件:[]};
  return out;
}
function freshState(count=18){
  const backend=emptyState();
  backend.历史=historyAnchors(count);
  return {
    世界:{名称:'长线测试世界',时间:'第200日',地点:'王都',稳定:100,后台:backend,因果轨道:{当前阶段:'长期局势持续演化',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},势力:{},探索:{},法则:[],货币:{},历法:{}},
    设置:{单一世界:true},系统状态:{是否在主神空间:false},资产:{},关系列表:{},传闻:filledRumors()
  };
}
function setup(count=18){
  let current=freshState(count),calls=0;
  const message={message_id:80,role:'assistant',message:'王都今日没有新的公开骚乱，旧有局势仍在延续。'};
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'history-memory-test',getChatMessages:()=>[message],
    Mvu:{getMvuData:()=>({stat_data:clone(current)}),replaceMvuData:async raw=>{current=clone(raw.stat_data);}},
    Samsara:{terminal:{apiReady:()=>true,request:async()=>{
      calls++;
      if(calls===1)return JSON.stringify({摘要:'本轮没有需要改变的世界事实。'});
      return JSON.stringify({摘要:'早期十二件历史事实构成了这一阶段的长期背景，并共同塑造了当前局势。'});
    }},validateWorldState:stat=>clone(stat)},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},toastr:{error:()=>{}}
  };
  const engine=new Engine(host);
  engine.worldbook=async()=>[];
  engine.config.contextTurns=1;
  engine.config.requireMacroBackbone=false;
  engine.config.retryAttempts=1;
  engine.config.enabled=true;
  return {engine,getState:()=>clone(current),getCalls:()=>calls};
}

(async()=>{
  // 正常运行不再因旧 200 条上限丢失历史事实。
  {
    const state=freshState(240);
    compactWorldLifecycle(state);
    assert.equal(Object.keys(state.世界.后台.历史).length,240,'历史锚点不得再按200条业务上限删除');
  }

  // 达到阈值后，世界推进成功运行应额外生成一级历史总结；原始锚点保留且只收纳最旧一批。
  {
    const x=setup(18);
    assert.equal(await x.engine.run(),true);
    assert.equal(x.getCalls(),2,'18个未收纳历史锚点应触发一次独立历史总结请求');
    const state=x.getState(),backend=state.世界.后台;
    assert.equal(Object.keys(backend.历史).length,18,'生成总结不得删除原始历史锚点');
    const summaries=Object.values(backend.历史总结||{});
    assert.equal(summaries.length,1,'应生成一个一级历史总结');
    assert.equal(summaries[0].层级,1);
    assert.equal((summaries[0].子项||[]).length,12,'一级总结应收纳最旧12个未收纳锚点');
    const projected=projectWorldContext(state).世界.后台;
    assert.ok(projected.历史记忆,'世界推进上下文必须读取分层历史记忆');
    assert.equal(Object.keys(projected.历史记忆.近期锚点||{}).length,6,'总结后只应把未收纳的近期原始锚点作为热细节发送');
    assert.equal((projected.历史记忆.长期总结||[]).length,1,'被压缩的远期历史应以总结节点发送');
  }

  // 正文投影与设置页都必须出现显式开关；默认关闭，避免升级后突然增加正文token。
  {
    const vars=fs.readFileSync(path.join(__dirname,'../World Book/[variables]当前变量.txt'),'utf8');
    const ui=fs.readFileSync(path.join(__dirname,'../script/world-engine-src/50-engine-ui.part.js'),'utf8');
    const runtime=fs.readFileSync(path.join(__dirname,'../script/world-engine-src/40-engine-runtime.part.js'),'utf8');
    assert.match(runtime,/sendHistoryToProse\s*:\s*false|sendHistoryToProse[^\n]{0,80}=\s*false/,'正文历史开关必须默认关闭');
    assert.match(vars,/sendHistoryToProse/,'正文变量投影必须读取世界推进的历史开关');
    assert.match(vars,/历史记忆/,'开启后必须向正文投影历史记忆');
    assert.match(ui,/向正文提供历史记忆/,'设置页必须提供明确的历史记忆开关');
  }

  console.log('world-engine history memory regression tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
