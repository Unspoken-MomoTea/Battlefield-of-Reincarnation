// Read-only diagnostics with synthetic saves; never calls a real API or writes MVU.
const {SamsaraWorldEngine:Engine,emptyState,RECORDS,compactWorldLifecycle,projectWorldContext,applyPatches}=require('../script/世界推进系统.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>({世界:{名称:'副本B',时间:'2026年3月1日上午',后台:emptyState(),势力:{},探索:{},因果轨道:{}},设置:{},系统状态:{是否在主神空间:false},关系列表:{},任务:{列表:{},副本成就:{}}});
(async()=>{
 const state=fresh(),handlers={};
 const host={localStorage:{getItem:()=>null,setItem:()=>{}},getCurrentChatId:()=> 'B',
   getChatMessages:()=>[{message_id:2,role:'assistant',message:'本轮剧情'}],
   Mvu:{events:{VARIABLE_UPDATE_ENDED:'mvu'},getMvuData:()=>({stat_data:clone(state)})},
   eventOn:(name,fn)=>{handlers[name]=fn;return ()=>{};},tavern_events:{CHAT_CHANGED:'chat'},
   document:{addEventListener:()=>{},removeEventListener:()=>{}},Samsara:{}};
 const engine=new Engine(host);engine.worldbook=async()=>[];
 state.世界.后台.已处理时间='2026年2月28日上午';
 const request=await engine.buildRequest(engine.snapshot());
 console.log(JSON.stringify({检查:'跨月时间容量',实际小时:JSON.parse(request.input).本轮时间容量.小时,应为小时:24}));
 const large=fresh();
 for(let i=0;i<301;i++)large.世界.后台.事件['旧事'+i]={...clone(RECORDS.事件),分类:'近期节点',状态:'已完成',时间:'2026年1月1日'};
 large.世界.后台.人物.留档者={...clone(RECORDS.人物),所属世界:'副本B',关联事件:Object.keys(large.世界.后台.事件)};
 const compacted=compactWorldLifecycle(large);
 let validation='通过';try{applyPatches(large,[]);}catch(e){validation=e.message;}
 console.log(JSON.stringify({检查:'仍被人物引用的结束事件',归档数:compacted.归档事件.length,剩余数:Object.keys(large.世界.后台.事件).length,空更新校验:validation}));
 const moved=fresh();
 moved.世界.后台.人物.旧世界人物={...clone(RECORDS.人物),所属世界:'副本A',行动:'旧副本行动'};
 console.log(JSON.stringify({检查:'未经过正常结算的换副本',旧人物仍进入新世界上下文:!!projectWorldContext(moved).世界.后台.人物.旧世界人物}));
 engine.lastRequest={input:'旧聊天资料'};engine.previewRequest={input:'旧聊天预览'};engine.init();handlers.chat();
 console.log(JSON.stringify({检查:'切聊天后请求检查',旧实际请求仍保留:!!engine.lastRequest,旧预览仍保留:!!engine.previewRequest}));
 engine.dispose();
})().catch(e=>{console.error(e);process.exitCode=1;});
