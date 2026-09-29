const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'../script/世界推进系统.js');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS}=require(file);
const clone=value=>JSON.parse(JSON.stringify(value));

function baseState({withFaction=true}={}){
  const backend=emptyState();
  backend.事件['港口警戒']={...RECORDS.事件,描述:'港口正在实施临时警戒。',分类:'当前事件',状态:'进行中',地点:'海港',时间:'2026年9月29日',更新时间:'2026年9月29日'};
  backend.势力地区['海港城区']={...RECORDS.势力地区,类型:'地区',描述:'海港城区维持警戒。',更新时间:'2026年9月29日'};
  if(withFaction)backend.势力地区['海港守备队']={...RECORDS.势力地区,类型:'势力',描述:'守备队正在维持港区秩序。',更新时间:'2026年9月29日'};
  return {
    世界:{名称:'测试海港',时间:'2026年9月29日',地点:'海港',稳定:100,后台:backend,
      势力:withFaction?{海港守备队:{实力:'C',领地:'海港',描述:'本地守备力量',声望:0}}:{},
      探索:{},异端雷达:{名单:{}},因果轨道:{当前阶段:'港口警戒',故事线:'',下一节点:'',偏移记录:{}}},
    系统状态:{是否在主神空间:false},设置:{},关系列表:{},资产:{},
    传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  };
}
function validReply(){
  return JSON.stringify({摘要:'港口警戒继续推进',事件:[{名称:'港口警戒',操作:'更新',描述:'港口警戒扩大到外港检查线。'}]});
}
function setup(request,initial=baseState()){
  let current=clone(initial),calls=0,writes=0;const options=[],inputs=[];
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'resilience',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'港口警戒线向外港推进。'}],
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async(system,input,opt)=>{calls++;inputs.push(input);options.push(clone(opt||{}));return request(calls,system,input,opt);}}},
    Mvu:{getMvuData:()=>({stat_data:clone(current)}),replaceMvuData:async data=>{writes++;current=clone(data.stat_data);}}
  };
  const engine=new Engine(host);engine.config.enabled=true;engine.config.requireMacroBackbone=false;engine.worldbook=async()=>[];
  return {engine,calls:()=>calls,writes:()=>writes,current:()=>clone(current),options,inputs};
}

(async()=>{
  {
    const engine=new Engine({localStorage:{getItem:()=>null,setItem:()=>{}},Samsara:{}});
    const before=baseState({withFaction:false});
    const requirement=engine.services.activityPolicy.requirement(before);
    assert.equal(requirement.初始化缺口.势力,true);
    const next=clone(before);
    next.世界.后台.事件['港口警戒'].描述='港口警戒已经扩展到外港。';
    assert.doesNotThrow(()=>engine.services.activityPolicy.ensureDelivery(next,requirement),'势力初始化缺口应作为软目标，不得拖垮已有真实世界推进');
    assert.equal(engine.services.activityPolicy.repairRequired(next),false,'只有势力缺失时不得把已处理楼层持续标记成强制修复');
  }

  {
    const x=setup(calls=>{if(calls===1)throw new Error('HTTP 503: upstream unavailable');return validReply();});
    x.engine.config.retryAttempts=2;
    assert.equal(await x.engine.run(),true,'HTTP/网络类请求错误应进入自动重试');
    assert.equal(x.calls(),2);
    assert.equal(x.writes(),1);
    assert.equal(x.engine.lastRetryLog[0].类型,'请求失败');
  }

  {
    const x=setup(calls=>calls===1?'':validReply());
    x.engine.config.retryAttempts=2;
    assert.equal(await x.engine.run(),true,'模型空回应进入自动重试');
    assert.equal(x.calls(),2);
    assert.equal(x.writes(),1);
  }

  {
    const reply=JSON.stringify({
      摘要:'事件有效但势力声望越界',
      事件:[{名称:'港口警戒',操作:'更新',描述:'港口警戒已经推进到外港检查线。'}],
      势力:[{名称:'海军本部',操作:'更新',实力:'S',领地:'大海',描述:'世界政府直属海军',声望:5000}]
    });
    const x=setup(()=>reply,baseState({withFaction:false}));
    x.engine.config.retryAttempts=2;
    assert.equal(await x.engine.run(),true,'局部片段连续失败时，最终应丢弃失败项并提交累计通过项');
    assert.equal(x.calls(),2,'先给失败势力片段一次纠错机会，最终仍失败才丢弃');
    assert.equal(x.writes(),1);
    assert.equal(x.current().世界.后台.事件['港口警戒'].描述,'港口警戒已经推进到外港检查线。');
    assert.equal(x.current().世界.势力?.海军本部,undefined,'声望越界势力片段不得写入');
    assert.ok(x.engine.lastRetryLog.some(item=>item.类型==='局部片段已丢弃'));
  }

  {
    const x=setup(calls=>{if(calls<=2)throw new Error('HTTP 503: primary model unavailable');return validReply();});
    x.engine.config.retryAttempts=2;
    x.engine.config.temperature=0.65;
    x.engine.config.fallbackModel='backup-model';
    assert.equal(await x.engine.run(),true,'主模型达到本模型尝试上限后应切换 fallback 模型继续');
    assert.equal(x.calls(),3);
    assert.equal(x.options[0].temperature,0.65);
    assert.equal(x.options[1].model,undefined);
    assert.equal(x.options[2].model,'backup-model');
    assert.equal(x.engine.lastAttemptCount,3);
  }

  const source=fs.readFileSync(file,'utf8');
  assert.match(source,/每个模型最大尝试次数/);
  assert.match(source,/data-world-temperature/);
  assert.match(source,/data-fallback-model/);
  const statusbar=fs.readFileSync(path.join(__dirname,'../script/悬浮球状态栏.js'),'utf8');
  assert.match(statusbar,/options\.model/,'主神终端额外模型调用必须允许世界推进指定 fallback 模型');

  console.log('PASS world-engine resilient retry, soft faction bootstrap, temperature and fallback model');
})().catch(error=>{console.error(error);process.exitCode=1;});
