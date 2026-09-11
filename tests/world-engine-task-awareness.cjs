const assert=require('node:assert/strict');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS,projectWorldContext,compileWorldResult,WORLD_RESULT_SCHEMA}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

function freshState(){
  const backend=emptyState();
  backend.事件['黑鸦商队失踪']={
    ...clone(RECORDS.事件),分类:'当前事件',描述:'黑鸦商队在北境商路失踪。',时间:'2026年-09月-11日-上午',条件:'连续失联',前因:[],状态:'进行中',
    默认走向:'地方势力继续搜索。',结果:'',公开征兆:'商路检查站开始盘查。',地点:'北境-旧商路',更新时间:'2026年-09月-11日-上午',关联任务:['调查黑鸦商队']
  };
  return {
    世界:{名称:'测试世界',时间:'2026年-09月-11日-上午',地点:'北境-旧商路',稳定:100,后台:backend,因果轨道:{当前阶段:'商路失踪案发酵',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},势力:{},探索:{},法则:[],货币:{体系:'金币',购买力基准:'',经济波动:''},历法:{}},
    设置:{单一世界:false},系统状态:{是否在主神空间:false},资产:{},角色:{},关系列表:{},
    传闻:{街头巷议:{},情报交易:{},布告与檄文:{}},
    任务:{
      列表:{
        调查黑鸦商队:{委托方:'北境商会',目标:'查明黑鸦商队失踪原因并寻找幸存者',隐藏真相:'商队被地方军阀秘密扣押',难度:'D',奖励:'800金币',交付:'北境商会办事处',状态:'进行中',惩罚:'无'}
      },
      副本成就:{秘密观察者:{说明:'发现幕后军阀',难度:'C',奖励:'成就奖励',状态:'未达成'}},
      击杀:{Ⅰ:3}
    }
  };
}

(async()=>{
  const state=freshState();
  const ctx=projectWorldContext(state);
  assert.deepEqual(ctx.任务,{列表:{
    调查黑鸦商队:{委托方:'北境商会',目标:'查明黑鸦商队失踪原因并寻找幸存者',隐藏真相:'商队被地方军阀秘密扣押',难度:'D',交付:'北境商会办事处',状态:'进行中'}
  }},'世界推进只读取任务列表中的因果字段');
  assert.equal(ctx.任务.副本成就,undefined,'副本成就不得进入世界推进上下文');
  assert.equal(ctx.任务.击杀,undefined,'击杀统计不得进入世界推进上下文');
  assert.equal(ctx.任务.列表.调查黑鸦商队.奖励,undefined,'奖励不属于世界后台推演输入');
  assert.equal(ctx.任务.列表.调查黑鸦商队.惩罚,undefined,'结算惩罚不属于世界后台推演输入');
  assert.deepEqual(ctx.世界.后台.事件['黑鸦商队失踪'].关联任务,['调查黑鸦商队'],'事件的任务关联必须保留给世界后台');

  assert.equal(Object.hasOwn(RECORDS,'剧本'),false,'新版世界后台不再定义剧本记录');
  assert.equal(Object.hasOwn(emptyState(),'剧本'),false,'新版世界后台不再初始化剧本字段');
  assert.equal(WORLD_RESULT_SCHEMA.properties.任务,undefined,'WorldResult 不得提供任务写入口');

  const accepted=compileWorldResult(state,{摘要:'任务推动世界变化',事件:[{名称:'黑鸦商队失踪',关联任务:['调查黑鸦商队'],公开征兆:'商会追加了失踪者悬赏。'}]});
  assert.ok(accepted.patches.some(p=>p.path.includes('/事件/黑鸦商队失踪')&&Array.isArray(p.value?.关联任务)&&p.value.关联任务.includes('调查黑鸦商队')),'存在的任务名允许作为事件因果索引');
  assert.throws(
    ()=>compileWorldResult(state,{摘要:'错误关联',事件:[{名称:'黑鸦商队失踪',关联任务:['调查黑龙阴谋']}]}),
    /事件\/黑鸦商队失踪：关联任务不存在：调查黑龙阴谋/,
    '不存在的任务关联必须显式拒绝'
  );
  state.世界.后台.剧本={旧剧本:{描述:'不应进入上下文'}};
  const noLegacyPlot=projectWorldContext(state);
  assert.equal(noLegacyPlot.世界.后台.剧本,undefined,'旧剧本数据不得进入世界推进上下文');

  let stored='';
  const message={message_id:9,role:'assistant',message:'北境商会正在四处打听失踪商队的下落。'};
  const host={
    localStorage:{getItem:()=>null,setItem:(_key,value)=>{stored=String(value||'');}},
    getCurrentChatId:()=> 'task-awareness-test',getChatMessages:()=>[message],
    getCharWorldbookNames:()=>({primary:'轮回战场V3.7.0',additional:[]}),
    getWorldbook:()=>[
      {uid:196248,name:'⚙️任务与委托系统',content:'<任务与委托系统>任务状态机权威规则</任务与委托系统>',enabled:true},
      {uid:915830,name:'世界主设定',content:'世界资料',enabled:true}
    ],
    Mvu:{getMvuData:()=>({stat_data:clone(state)}),replaceMvuData:async()=>{}},
    Samsara:{terminal:{apiReady:()=>true,request:async()=>''},validateWorldState:stat=>clone(stat)},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},toastr:{error:()=>{}}
  };
  const engine=new Engine(host);engine.config.contextTurns=1;engine.config.requireMacroBackbone=false;engine.config.enabled=true;
  const catalogue=await engine.catalogue();
  const taskBook=catalogue.find(item=>item.title==='⚙️任务与委托系统');
  assert.ok(taskBook,'应能发现任务与委托系统条目');
  assert.equal(engine.config.selectedEntries.includes(JSON.stringify(['轮回战场V3.7.0','196248'])),true,'内置默认应重新勾选任务与委托系统');
  assert.equal((engine.config.builtinDefaultWorldbookExclusionsApplied||[]).includes('任务与委托系统'),false,'旧版任务规则排除标记应迁移移除');
  assert.ok(stored,'默认勾选迁移应持久化');

  engine.worldbook=async()=>[];
  const request=await engine.buildRequest(engine.snapshot()),payload=JSON.parse(request.input);
  assert.deepEqual(payload.当前变量.任务,ctx.任务,'实际请求应携带精简任务列表');
  assert.match(request.system,/【任务感知 · 只读】/,'系统提示应声明任务只读边界');
  assert.match(request.system,/任务列表是世界因果来源之一/,'任务列表必须作为只读世界因果来源');
  assert.match(request.system,/事件可用“关联任务”引用当前任务\.列表中已存在的任务名/,'事件应允许关联已有任务');
  assert.match(request.system,/购买、付款与消费性删除由MVU按正文结果处理/,'世界引擎不得抢情报购买结算职责');
  assert.doesNotMatch(request.system,/情报交易有卖家时更新1~2条，购买后移除/,'旧的世界引擎购买后删除指令必须消失');

  console.log('world-engine task awareness regression tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
