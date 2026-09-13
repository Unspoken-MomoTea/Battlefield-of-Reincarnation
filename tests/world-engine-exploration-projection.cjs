const assert=require('node:assert/strict');
const {
  SamsaraWorldEngine:Engine,
  applyPatches,
  compileWorldResult,
  compactWorldLifecycle,
  emptyState,
  RECORDS
}=require('../script/世界推进系统.js');

const clone=value=>JSON.parse(JSON.stringify(value));
const area=(progress=50)=>({风险:'F',探索度:progress,描述:'测试区域',隐藏真相:''});
function fresh(location='藤美学园·教学楼'){
  return {
    世界:{
      名称:'学园默示录',时间:'2008年07月17日-07:00',地点:location,稳定:100,
      后台:emptyState(),探索:{},势力:{},因果轨道:{当前阶段:'爆发初期',故事线:'',下一节点:'',偏移记录:{}},
      异端雷达:{名单:{}},法则:[],货币:{},历法:{}
    },
    设置:{单一世界:false},系统状态:{是否在主神空间:false},资产:{},角色:{},关系列表:{},任务:{列表:{}},
    传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  };
}
function region(name,description=''){
  return [name,{...RECORDS.势力地区,类型:'地区',描述:description||name,目标:'维持局势',进展:'',公开动态:''}];
}

(async()=>{
  {
    const stat=fresh('藤美学园·教学楼');
    const [name,record]=region('藤美学园','玩家已经进入并穿越校园。');
    stat.世界.后台.势力地区[name]=record;
    const compiled=compileWorldResult(stat,{摘要:'只推进后台地区'});
    const next=applyPatches(stat,compiled.patches);
    assert.ok(next.世界.探索['藤美学园'],'玩家实际位于后台整体区域时必须自动建立探索投影');
    assert.equal(next.世界.探索['藤美学园'].探索度,10,'首次实际到达整体区域至少记为10%浅尝');
  }

  {
    const stat=fresh('床主市市区街道·中央路');
    const compiled=compileWorldResult(stat,{
      摘要:'玩家已经进入市区',
      势力地区:[{名称:'床主市市区街道',类型:'地区',描述:'社会秩序正在快速崩坏。',进展:'玩家已进入市区街道。'}]
    });
    const next=applyPatches(stat,compiled.patches);
    assert.ok(next.世界.后台.势力地区['床主市市区街道'],'本轮新建地区应正常写入后台');
    assert.ok(next.世界.探索['床主市市区街道'],'本轮刚建立且与当前地点匹配的整体地区也必须同步投影');
    assert.equal(next.世界.探索['床主市市区街道'].探索度,10);
  }

  {
    const stat=fresh('藤美学园·校门');
    const [name,record]=region('藤美学园');
    stat.世界.后台.势力地区[name]=record;
    stat.世界.后台.势力地区['远坂宅邸']={...record,描述:'远方后台地区'};
    const next=applyPatches(stat,compileWorldResult(stat,{摘要:'远方也在推进'}).patches);
    assert.ok(next.世界.探索['藤美学园']);
    assert.equal(next.世界.探索['远坂宅邸'],undefined,'玩家未到达的远方后台地区不得自动变成探索奖励');
  }

  {
    const stat=fresh('藤美学园·教学楼');
    const [name,record]=region('藤美学园');
    stat.世界.后台.势力地区[name]=record;
    const next=applyPatches(stat,compileWorldResult(stat,{
      摘要:'玩家已经深入调查校园',
      探索:[{名称:'藤美学园',探索度:30,风险:'D',描述:'已掌握校园主要路线。'}]
    }).patches);
    assert.equal(next.世界.探索['藤美学园'].探索度,30,'AI明确给出的更高探索进度不得被10%兜底覆盖');
    assert.equal(Object.keys(next.世界.探索).length,1,'同一整体区域不得产生重复探索条目');
  }

  {
    const stat=fresh('床主市市区街道');
    stat.世界.探索={'藤美学园':area(30),'床主市市区街道':area(10)};
    const lifecycle=compactWorldLifecycle(stat);
    assert.ok(stat.世界.探索['藤美学园'],'探索台账是玩家长期/结算档案，离开区域后不得被生命周期回收');
    assert.ok(stat.世界.探索['床主市市区街道']);
    assert.deepEqual(lifecycle.回收探索||[],[],'生命周期不得再清除已获得的探索记录');
  }

  {
    const state=fresh('藤美学园·教学楼');
    const [name,record]=region('藤美学园');
    state.世界.后台.势力地区[name]=record;
    const message={message_id:1,role:'assistant',message:'玩家已经进入藤美学园并穿过教学楼。'};
    const host={
      localStorage:{getItem:()=>null,setItem:()=>{}},getCurrentChatId:()=> 'exploration-projection-test',getChatMessages:()=>[message],
      getCharWorldbookNames:()=>({primary:'测试世界书',additional:[]}),getWorldbook:()=>[],
      Mvu:{getMvuData:()=>({stat_data:clone(state)}),replaceMvuData:async()=>{}},
      Samsara:{terminal:{apiReady:()=>true,request:async()=>''},validateWorldState:stat=>clone(stat)},
      document:{addEventListener:()=>{},removeEventListener:()=>{}},toastr:{error:()=>{}}
    };
    const engine=new Engine(host);engine.config.contextTurns=1;engine.config.enabled=true;engine.worldbook=async()=>[];
    const request=await engine.buildRequest(engine.snapshot());
    assert.match(request.system,/【玩家探索投影硬约束】/,'固定请求必须携带探索投影规则');
    assert.match(request.system,/实际到达.*至少.*10/,'提示必须明确实际到达整体区域时建立最低探索进度');
    assert.match(request.system,/不得因离开.*删除|离开区域.*保留/,'提示必须明确探索台账离开后仍保留');
  }

  console.log('world-engine exploration projection regression tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
