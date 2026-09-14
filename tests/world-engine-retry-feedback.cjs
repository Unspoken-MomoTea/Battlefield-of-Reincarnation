const assert=require('node:assert/strict');
const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const names=['帝都大搜捕收网','安宁道武装起义','革命军总攻序幕'];
const rootCause='帝具使交战与轮回者乱入';
const events=names.map((名称,index)=>({
  名称,描述:'地区政权和战争局势进入新的阶段。',分类:'宏观节点',状态:'待发生',
  时间:`2026年9月${16+index*3}日`,前因:[index?names[index-1]:rootCause]
}));

(async()=>{
  let current={
    世界:{名称:'斩赤红之瞳',时间:'2026年9月14日',地点:'帝都',后台:emptyState(),势力:{},探索:{},
      异端雷达:{名单:{}},因果轨道:{当前阶段:rootCause,故事线:'',下一节点:'',偏移记录:{}}},
    系统状态:{是否在主神空间:false},设置:{},关系列表:{},传闻:{}
  };
  let calls=0,writes=0;
  const inputs=[];
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'retry-feedback',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'帝都正在发生交战。'}],
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async(_system,input)=>{
      inputs.push(JSON.parse(input));calls++;
      return JSON.stringify(calls===1
        ? {摘要:'建立节点',事件:events,人物:[{名称:'卫兵',所属世界:'斩赤红之瞳',行动:'巡逻'}]}
        : {摘要:'修复前因链',事件:events.map((event,index)=>({...event,前因:index?[names[index-1]]:[]})),因果:{宏观顺序:names}});
    }}},
    Mvu:{getMvuData:()=>({stat_data:clone(current)}),replaceMvuData:async data=>{writes++;current=clone(data.stat_data);}}
  };
  const engine=new Engine(host);
  engine.config.enabled=true;
  engine.config.requireMacroBackbone=false;
  engine.config.retryAttempts=2;
  engine.worldbook=async()=>[];
  assert.equal(await engine.run(),true);
  assert.equal(calls,2);
  assert.equal(writes,1);
  const correction=inputs[1].纠错重试;
  assert.equal(correction.上次拒绝原因,'部分业务片段未通过（3项）');
  assert.deepEqual(correction.具体问题,[
    `事件前因不存在：${names[0]} <- ${rootCause}`,
    `事件前因不存在：${names[1]} <- ${names[0]}`,
    `事件前因不存在：${names[2]} <- ${names[1]}`
  ]);
  assert.equal(correction.补充清单.length,1,'三个前因错误只携带一条通用修复要求');
  assert.match(correction.补充清单[0],/先修复链首.*重新提交受影响的后继节点/);
  assert.match(correction.补充清单[0],/无明确前因写 \[\]/);
  const diagnostic=JSON.stringify({原因:correction.上次拒绝原因,问题:correction.具体问题,要求:correction.补充清单});
  assert.equal((diagnostic.match(/事件前因不存在/g)||[]).length,3,'每个失败引用只报告一次');
  assert.equal((diagnostic.match(/前因数组只放/g)||[]).length,1,'公共规则只报告一次');
  assert.ok(diagnostic.length<500,'三条因果错误不应膨胀成重复的规则段落');
  assert.equal(correction.已接受业务结果.人物[0].名称,'卫兵');
  assert.equal(current.世界.后台.人物.卫兵.行动,'巡逻');
  assert.deepEqual(Object.keys(current.世界.后台.事件),names);
  assert.equal(current.世界.后台.事件[rootCause],undefined,'不凭空补造当前阶段对应的事件');
  assert.deepEqual(current.世界.后台.事件[names[1]].前因,[names[0]],'后继有效依赖应保留');
  assert.equal(engine.lastRetryLog[0].片段.length,3,'完整结构化诊断仍保留以供排查');
  assert.equal(engine.lastRetryLog[0].补充清单.length,1);
  console.log('world-engine concise retry feedback passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
