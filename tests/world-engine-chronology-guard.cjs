const assert=require('node:assert/strict');
const {SamsaraWorldEngine:Engine,emptyState,compileWorldResult}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

function freshState(){
  return {
    世界:{
      名称:'刀剑神域',时间:'2022年11月6日上午',地点:'起始之城',稳定:100,后台:emptyState(),
      因果轨道:{当前阶段:'SAO正式运营初期',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},势力:{},探索:{},法则:[],货币:{体系:'珂尔',购买力基准:'',经济波动:''},历法:{}
    },
    设置:{单一世界:false},系统状态:{是否在主神空间:false},资产:{},角色:{},关系列表:{},任务:{列表:{}},
    传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  };
}

(async()=>{
  const state=freshState();
  const message={message_id:1,role:'assistant',message:'玩家刚进入艾恩葛朗特，仍在起始区域熟悉战斗。'};
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},getCurrentChatId:()=> 'chronology-guard-test',getChatMessages:()=>[message],
    getCharWorldbookNames:()=>({primary:'测试世界书',additional:[]}),getWorldbook:()=>[],
    Mvu:{getMvuData:()=>({stat_data:clone(state)}),replaceMvuData:async()=>{}},
    Samsara:{terminal:{apiReady:()=>true,request:async()=>''},validateWorldState:stat=>clone(stat)},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},toastr:{error:()=>{}}
  };
  const engine=new Engine(host);engine.config.contextTurns=1;engine.config.enabled=true;
  const chronology=[{世界书:'测试世界书',条目ID:'timeline',名称:'原著年表',内容:'<原著年表>2022年11月6日 SAO正式运营。2022年12月4日 第一层Boss攻略战正式开始。</原著年表>'}];
  chronology.report=[{世界书:'测试世界书',条目ID:'timeline',名称:'原著年表',读取:true,原因:'宏观资料补充'}];
  engine.worldbook=async()=>chronology;

  const request=await engine.buildRequest(engine.snapshot()),payload=JSON.parse(request.input);
  assert.match(request.system,/【原著\/数据库时间轴硬约束】/,'固定系统约束必须明确原著/数据库时间轴优先');
  assert.match(request.system,/不得为了推动剧情.*主动提前关键事件/,'必须明确禁止为推进剧情提前宏观事件');
  assert.match(engine.config.preset,/定边界与日期/,'内置默认 Step 2 应先确定宏观节点日期与跨度');
  assert.equal(payload.时间线基准.当前世界时间,'2022年11月6日上午');
  assert.match(payload.时间线基准.要求,/明确日期必须服从/);
  assert.ok(payload.世界书.some(text=>text.includes('2022年12月4日 第一层Boss攻略战')),'即使已有宏观骨架逻辑变化，明确年表仍应进入请求上下文');
  assert.equal(request.manifest.原著时间轴.强制校准,true);

  assert.throws(
    ()=>compileWorldResult(state,{摘要:'错误压缩时间线',事件:[{名称:'第一层Boss攻略战',分类:'宏观节点',状态:'待发生',时间:'2022年11月7日'}]}),
    /宏观节点日期与原著\/数据库时间锚点冲突.*2022年11月7日.*2022年12月4日/,
    '数据库已有明确日期时不得把关键宏观节点压缩到次日'
  );
  assert.throws(
    ()=>compileWorldResult(state,{摘要:'错误模糊时间',事件:[{名称:'第一层Boss攻略战',分类:'宏观节点',状态:'待发生',时间:'明天'}]}),
    /宏观节点日期未服从原著\/数据库时间锚点.*2022年12月4日/,
    '数据库已有明确日期时不得退化成模糊相对时间'
  );

  console.log('world-engine chronology guard regression tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
