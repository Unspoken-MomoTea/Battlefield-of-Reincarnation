const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../script/世界推进系统.js');
const source = fs.readFileSync(file, 'utf8');
const {SamsaraWorldEngine: Engine, emptyState} = require(file);
const clone = value => JSON.parse(JSON.stringify(value));

function baseState(){
  return {
    世界:{名称:'测试世界',时间:'2026年9月10日晚',地点:'测试城',后台:emptyState(),势力:{},探索:{},异端雷达:{名单:{}},因果轨道:{当前阶段:'',故事线:'',下一节点:'',偏移记录:{}}},
    系统状态:{是否在主神空间:false},设置:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  };
}

function setupAlwaysRejected(){
  let current=baseState(),calls=0,inputs=[];
  const response=JSON.stringify({摘要:'测试拒绝',人物:[{名称:'卫兵',操作:'更新',地点:'城门',目标:'警戒',行动:'含糊行动',状态:'活跃',更新时间:'2026年9月10日晚'}]});
  const validate=stat=>{
    const next=clone(stat);
    const person=next.世界?.后台?.人物?.卫兵;
    if(person?.行动==='含糊行动')person.行动='规范行动';
    return next;
  };
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    Samsara:{validateWorldState:validate,terminal:{apiReady:()=>true,request:async (_system,input)=>{inputs.push(input);calls++;return response;}}},
    getCurrentChatId:()=> 'request-budget-retry-ui',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'测试正文。'}]
  };
  host.Mvu={getMvuData:()=>({stat_data:clone(current)}),replaceMvuData:async data=>{current=clone(data.stat_data);}};
  const engine=new Engine(host);engine.config.enabled=true;engine.config.requireMacroBackbone=false;engine.worldbook=async()=>[];
  return {engine,calls:()=>calls,inputs};
}

(async()=>{
  const x=setupAlwaysRejected();
  x.engine.config.retryAttempts=5;
  await assert.rejects(()=>x.engine.run(),/部分业务片段未通过/);
  assert.equal(x.calls(),5,'配置 5 必须表示最多总尝试 5 次，首次请求包含在内');
  assert.equal(x.engine.lastAttemptCount,5);
  assert.equal(x.engine.lastRetryLog.length,5,'最终一次业务拒绝也必须进入失败列表');
  assert.deepEqual(x.engine.lastRetryLog.map(x=>x.尝试),[1,2,3,4,5]);
  assert.ok(x.engine.lastRetryLog.every(x=>Array.isArray(x.片段)&&x.片段.length===1),'每次业务拒绝都应保留结构化原因');
  const retryPayload=JSON.parse(x.inputs[1]).纠错重试;
  assert.equal(retryPayload.当前尝试,2);
  assert.equal(retryPayload.最大尝试次数,5);
  for(const oldKey of ['当前总尝试','最大总尝试','当前额外重试','额外重试上限'])assert.equal(retryPayload[oldKey],undefined,'不再发送歧义重试字段 '+oldKey);

  assert.match(source,/setTimeout\(\(\)=>\{timedOut=true;this\.controller\.abort\(\);\},300000\)/,'世界推进请求超时应为 300 秒');
  assert.match(source,/请求超时（300秒）/);
  assert.match(source,/最大尝试次数 <input data-retries type="number" min="1" max="5"/,'UI 次数包含首次请求，范围应为 1~5');
  assert.doesNotMatch(source,/失败后额外重试/);
  assert.doesNotMatch(source,/每次尝试观测（点击展开）/,'删除重复的逐次 token 观测折叠区');
  assert.doesNotMatch(source,/User:tokenLabel\(obs\.User估算Tokens/,'Token 构成不再显示与子项重复的 User 总项');
  assert.doesNotMatch(source,/Schema子项:tokenLabel/,'Token 构成不再把 System 内的 Schema 当平级可加项');
  assert.match(source,/userTokenFields=.*obs\.User分段/,'Token 构成应直接展示 User 内各实际顶层组成');
  assert.match(source,/总输入 = System \+ 下列 User 分项/,'UI 应明确各项的包含关系');

  console.log('world-engine request budget/retry UI acceptance passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
