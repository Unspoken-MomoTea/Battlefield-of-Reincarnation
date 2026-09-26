const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const {SamsaraWorldEngine:Engine,emptyState}=require(path.join(root,'script','世界推进系统.js'));

const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  SillyTavern:{name1:'测试玩家'},
  Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
  getCurrentChatId:()=> 'run-orchestrator',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'测试正文。'}],
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
};
host.Mvu={getMvuData:()=>({stat_data:{世界:{名称:'测试世界',时间:'2026年09月27日-上午',地点:'测试地',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},货币:{},历法:{},法则:[]},系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}}}),replaceMvuData:async()=>{}};

(async()=>{
  const engine=new Engine(host);
  assert.equal(engine.services.run?.constructor?.name,'WorldRunOrchestrator');
  engine.config.enabled=false;
  const result=await engine.services.run.execute();
  assert.equal(result,false);
  assert.equal(engine.status,'世界推进已关闭');

  const service=fs.readFileSync(path.join(root,'src','WorldEngine','domains','WorldRunOrchestrator.part.js'),'utf8');
  assert.match(service,/while\(attempt<maxAttempts\)/,'retry/compile/commit loop must live in run orchestrator');
  const runtime=fs.readFileSync(path.join(root,'script','world-engine-src','40-engine-runtime.part.js'),'utf8');
  assert.doesNotMatch(runtime,/while\(attempt<maxAttempts\)/,'runtime facade must no longer own attempt orchestration');
  assert.match(runtime,/runOrchestrator\(\)/,'runtime must delegate run through the class seam');

  console.log('PASS main world advance loop lives in WorldRunOrchestrator');
})().catch(error=>{console.error(error);process.exitCode=1;});
