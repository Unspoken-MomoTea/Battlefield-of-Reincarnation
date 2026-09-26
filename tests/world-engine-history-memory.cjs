const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {SamsaraWorldEngine:Engine,emptyState,compactWorldLifecycle,projectWorldContext}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

function filledRumors(){
  return {
    街头巷议:{a:{来源:'旅人',内容:'北门盘查变严。',可信度:'或许可信'},b:{来源:'商贩',内容:'港口税率未变。',可信度:'可疑'}},
    情报交易:{a:{卖家:'斥候',情报评级:'F',摘要:'城外道路畅通。',要价:'10',真实内幕:'属实'},b:{卖家:'脚夫',情报评级:'F',摘要:'西门换岗。',要价:'10',真实内幕:'属实'}},
    布告与檄文:{a:{发布者:'城务厅',内容:'夜间宵禁。',张贴位置:'广场'},b:{发布者:'卫队',内容:'进城须登记。',张贴位置:'城门'}}
  };
}
function historyAnchors(count){
  const out={};
  for(let i=1;i<=count;i++)out['推进·'+i]={时间:'第'+i+'日',事实:'第'+i+'次世界推进已经确认的历史摘要。',关联事件:[]};
  return out;
}
function freshState(count=17){
  const backend=emptyState();
  backend.历史=historyAnchors(count);
  backend.事件['王都例行管制']={描述:'王都维持日常巡逻与城门登记。',时间:'第200日',条件:'',前因:[],状态:'进行中',默认走向:'继续例行巡逻',结果:'',公开征兆:'巡逻队正常换岗。',地点:'王都',分类:'当前事件',更新时间:'第200日'};
  backend.势力地区['王都中央区']={类型:'地区',描述:'王都核心城区。',目标:'维持日常秩序',进展:'例行巡逻持续。',下次检查:'',关联事件:['王都例行管制'],公开动态:'巡逻队按计划执勤。'};
  backend.势力地区['王都卫队']={类型:'势力',描述:'负责王都日常治安的守备组织。',目标:'维持王都秩序',进展:'维持常规轮值。',下次检查:'',关联事件:['王都例行管制'],公开动态:'卫队正常换岗。'};
  return {
    世界:{名称:'长线测试世界',时间:'第200日',地点:'王都',稳定:100,后台:backend,因果轨道:{当前阶段:'长期局势持续演化',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},势力:{王都卫队:{实力:'C',领地:'王都',描述:'负责王都日常治安的守备组织。',声望:0}},探索:{},法则:[],货币:{},历法:{}},
    设置:{单一世界:true},系统状态:{是否在主神空间:false},资产:{},关系列表:{},传闻:filledRumors()
  };
}
function setup(state=freshState(17),historyReplies=[]){
  let current=clone(state),calls=[];
  const message={message_id:80,role:'assistant',message:'王都今日没有新的公开骚乱，旧有局势仍在延续。'};
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'history-memory-test',getChatMessages:()=>[message],
    Mvu:{getMvuData:()=>({stat_data:clone(current)}),replaceMvuData:async raw=>{current=clone(raw.stat_data);}},
    Samsara:{terminal:{apiReady:()=>true,request:async(system,input)=>{
      calls.push({system:String(system||''),input:String(input||'')});
      if(calls.length===1)return JSON.stringify({
        摘要:'本轮没有需要改变的世界事实。',
        势力地区:[{名称:'王都中央区',操作:'更新',类型:'地区',描述:'王都核心城区。',目标:'维持日常秩序',进展:'本轮完成一次例行巡逻换岗。',关联事件:['王都例行管制'],公开动态:'巡逻队按计划完成换岗。'}]
      });
      const next=historyReplies[calls.length-2]||('第'+(calls.length-1)+'次长期历史总结：确认这些既有事实共同塑造了后续局势。');
      return JSON.stringify({摘要:next});
    }},validateWorldState:stat=>clone(stat)},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},toastr:{error:()=>{}}
  };
  const engine=new Engine(host);
  engine.worldbook=async()=>[];
  engine.config.contextTurns=1;
  engine.config.requireMacroBackbone=false;
  engine.config.retryAttempts=1;
  engine.config.enabled=true;
  return {
    engine,
    getState:()=>clone(current),
    getCalls:()=>clone(calls),
    change:fn=>{const next=clone(current);fn(next);current=next;}
  };
}
function summary(level,seq,children,lo,hi){
  return {层级:level,摘要:`L${level}-${seq} 已确认历史概括`,子项:children,起始时间:`第${lo}日`,结束时间:`第${hi}日`,起始序位:lo,结束序位:hi,创建时间:`第${hi}日`};
}

(async()=>{
  // 正常运行不再因旧 200 条上限丢失历史事实。
  {
    const state=freshState(240);
    compactWorldLifecycle(state);
    assert.equal(Object.keys(state.世界.后台.历史).length,240,'历史锚点不得再按200条业务上限删除');
  }

  // 每次成功世界推进都必须立即把本轮 WorldResult.摘要写成一条 L0 近期叶子，不等待事件结束/归档。
  {
    const x=setup(freshState(0));
    assert.equal(await x.engine.run(),true);
    const backend=x.getState().世界.后台;
    assert.equal(backend.历史['推进·80']?.事实,'本轮没有需要改变的世界事实。','首次推进就必须产生近期历史叶子');
    const projected=projectWorldContext(x.getState()).世界.后台.历史记忆;
    assert.equal(Object.keys(projected.近期锚点||{}).length,1,'首次推进后近期历史不得继续显示0');
    assert.equal(projected.统计.原始锚点总数,1);
    assert.equal(Object.hasOwn(backend,'运行记录'),false,'每轮摘要只应保留为 L0 历史，不再重复持久化推演记录');
  }

  // 事件生命周期冷归档不是摘要森林叶子，不能冒充每轮近期记忆。
  {
    const state=freshState(0);
    state.世界.后台.历史['归档·旧战役']={时间:'第1日',事实:'旧战役已经结束。',关联事件:[]};
    const x=setup(state);
    assert.equal(await x.engine.run(),true);
    const memory=projectWorldContext(x.getState()).世界.后台.历史记忆;
    assert.equal(Object.keys(memory.近期锚点||{}).length,1,'近期历史只应展示世界推进叶子');
    assert.equal(memory.统计.原始锚点总数,1);
    assert.equal(memory.统计.冷归档事实数,1);
  }

  // 同一楼层重推/重roll必须覆盖该楼叶子，并递归失效依赖旧叶子的长期总结。
  {
    const x=setup(freshState(0));
    assert.equal(await x.engine.run(),true);
    x.change(state=>{
      state.世界.后台.历史总结={
        'H1-000001':summary(1,1,['历史:推进·80'],80,80),
        'H2-000001':summary(2,1,['总结:H1-000001'],80,80)
      };
    });
    const rerun=x.getState();
    assert.equal(x.engine.beforeWorldCommit(rerun,{messageId:80,worldResult:{摘要:'同一楼层重推后的新世界摘要。'},baseStat:rerun}),true);
    const backend=rerun.世界.后台;
    assert.equal(backend.历史['推进·80'].事实,'同一楼层重推后的新世界摘要。');
    assert.deepEqual(backend.历史总结,{},'重推叶子后所有依赖旧叶子的祖先总结都必须失效');
  }

  // 第18次推进完成后应额外生成一级历史总结；原始推进叶子保留且只收纳最旧一批。
  {
    const x=setup(freshState(17),['早期十二次推进构成了这一阶段的长期背景，并共同塑造了当前局势。']);
    assert.equal(await x.engine.run(),true);
    const calls=x.getCalls();
    assert.equal(calls.length,2,'第18个未收纳推进叶子应触发一次独立历史总结请求');
    assert.match(calls[1].system,/只总结已确认历史事实/,'历史总结必须使用专用事实压缩约束');
    assert.match(calls[1].input,/第1日/,'总结请求必须把真实时间锚点连同事实发送，避免编造日期');
    const state=x.getState(),backend=state.世界.后台;
    assert.equal(Object.keys(backend.历史).length,18,'生成总结不得删除原始推进叶子');
    const summaries=Object.values(backend.历史总结||{});
    assert.equal(summaries.length,1,'应生成一个一级历史总结');
    assert.equal(summaries[0].层级,1);
    assert.equal((summaries[0].子项||[]).length,12,'一级总结应收纳最旧12个未收纳推进叶子');
    const projected=projectWorldContext(state).世界.后台;
    assert.ok(projected.历史记忆,'世界推进上下文必须读取分层历史记忆');
    assert.equal(projected.历史,undefined,'世界推进不应再同时重复发送旧的历史热尾巴');
    assert.equal(Object.keys(projected.历史记忆.近期锚点||{}).length,6,'总结后只应把未收纳的近期推进叶子作为热细节发送');
    assert.equal((projected.历史记忆.长期总结||[]).length,1,'被压缩的远期历史应以总结节点发送');
  }

  // 已经被一级总结收纳的推进叶子不能在下一轮被重复总结。
  {
    const state=freshState(18),keys=Object.keys(state.世界.后台.历史).slice(0,12);
    state.世界.后台.历史总结={'H1-000001':summary(1,1,keys.map(key=>'历史:'+key),1,12)};
    const x=setup(state);
    assert.equal(await x.engine.run(),true);
    assert.equal(x.getCalls().length,1,'旧12叶已收纳后，加上本轮也只有7个未收纳叶子，不得重复总结');
    assert.equal(Object.keys(x.getState().世界.后台.历史总结).length,1);
  }

  // 六个未收纳 L1 应继续压成 L2；已有子节点保留，不破坏可追溯树。
  {
    const state=freshState(6);state.世界.后台.历史总结={};
    for(let i=1;i<=6;i++)state.世界.后台.历史总结['H1-'+String(i).padStart(6,'0')]=summary(1,i,['历史:推进·'+i],i,i);
    const x=setup(state,['六个一级历史总结进一步压缩成长期篇章。']);
    assert.equal(await x.engine.run(),true);
    assert.equal(x.getCalls().length,2,'六个L1根节点应触发一次L2总结');
    const summaries=Object.values(x.getState().世界.后台.历史总结);
    assert.equal(summaries.filter(item=>item.层级===1).length,6,'L1子节点必须继续保留');
    const l2=summaries.find(item=>item.层级===2);assert.ok(l2,'应生成L2总结');
    assert.equal(l2.子项.length,6);assert.ok(l2.子项.every(id=>id.startsWith('总结:H1-')));
  }

  // 三个未收纳 L2 应继续压成更高层，证明单一世界可以持续递归而不是停在二级。
  {
    const state=freshState(3);state.世界.后台.历史总结={};
    for(let i=1;i<=3;i++)state.世界.后台.历史总结['H2-'+String(i).padStart(6,'0')]=summary(2,i,['历史:推进·'+i],i,i);
    const x=setup(state,['三个二级历史总结压缩成更长期的世界史。']);
    assert.equal(await x.engine.run(),true);
    const l3=Object.values(x.getState().世界.后台.历史总结).find(item=>item.层级===3);
    assert.ok(l3,'L2达到3个后必须继续生成L3，而不是存在固定最高层');
  }

  // 正文投影与设置页都必须出现显式开关；默认关闭，避免升级后突然增加正文token。
  {
    const vars=fs.readFileSync(path.join(__dirname,'../World Book/[variables]当前变量.txt'),'utf8');
    const ui=[
      path.join(__dirname,'../script/world-engine-src/50-engine-ui.part.js'),
      path.join(__dirname,'../script/world-engine-src/ui/40-archive-tabs.part.js'),
    ].map(file=>fs.readFileSync(file,'utf8')).join('\n');
    const runtime=fs.readFileSync(path.join(__dirname,'../script/world-engine-src/40-engine-runtime.part.js'),'utf8');
    const zod=fs.readFileSync(path.join(__dirname,'../script/ZOD脚本.js'),'utf8');
    assert.doesNotMatch(zod,/运行记录\s*:/,'MVU schema must not keep the removed duplicate run-record field');
    assert.match(runtime,/sendHistoryToProse\s*:\s*false|sendHistoryToProse[^\n]{0,80}=\s*false/,'正文历史开关必须默认关闭');
    assert.match(vars,/sendHistoryToProse/,'正文变量投影必须读取世界推进的历史开关');
    assert.match(vars,/历史记忆/,'开启后必须向正文投影历史记忆');
    assert.match(ui,/向正文提供历史记忆/,'设置页必须提供明确的历史记忆开关');
    assert.doesNotMatch(ui,/section\('推演记录'/,'历史记忆页不得再重复展示推演摘要');
    assert.match(ui,/\['运行记录','≋','历史记忆'\]/,'玩家侧导航应显示为历史记忆');
    const recentLine=ui.split('\n').find(line=>line.includes("section('近期历史锚点'"))||'';
    assert.doesNotMatch(recentLine,/<h3>'\+text\(n\)/,'近期历史不得暴露推进·楼层这类内部索引');
    const recentIndex=ui.indexOf("section('近期历史锚点'");
    const longIndex=ui.indexOf("section('长期历史总结'");
    assert.ok(recentIndex>=0&&longIndex>=0&&recentIndex<longIndex,'历史记忆页应先展示近期历史锚点，再展示长期历史总结');
  }

  console.log('world-engine history memory regression tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
