const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
for(const file of [
  'src/WorldEngine/domains/WorldRuntimeContextService.part.js',
  'src/WorldEngine/domains/WorldKnowledgeService.part.js',
  'src/WorldEngine/domains/WorldRequestBuilder.part.js',
]){
  assert.ok(fs.existsSync(path.join(root,file)),file+' must exist');
}

const {SamsaraWorldEngine:Engine,emptyState}=require(path.join(root,'script','世界推进系统.js'));
const clone=value=>JSON.parse(JSON.stringify(value));
const stat={
  世界:{名称:'测试世界',时间:'2026年09月26日-晚上',地点:'中央区',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'测试阶段',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},货币:{},历法:{},法则:[]},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},关系列表:{},资产:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
let current={stat_data:clone(stat)};
const books={
  主世界书:[
    {uid:1,name:'蓝灯设定',enabled:true,strategy:{type:'constant'},content:'固定世界设定'},
    {uid:2,name:'绿灯设定',enabled:true,strategy:{type:'selective',keys:['钟塔']},content:'钟塔相关设定'},
    {uid:3,name:'[variables]技术条目',enabled:true,strategy:{type:'constant'},content:'不应读取'}
  ]
};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  SillyTavern:{name1:'测试玩家',getContext:()=>({chatId:'runtime-services'})},
  Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
  getCurrentChatId:()=> 'runtime-services',
  getChatMessages:range=>{
    if(range===-1)return [{message_id:3,role:'assistant',message:'钟塔敲响，中央区夜色渐深。'}];
    return [
      {message_id:1,role:'assistant',message:'中央区开始入夜。'},
      {message_id:2,role:'user',message:'我前往钟塔。'},
      {message_id:3,role:'assistant',message:'钟塔敲响，中央区夜色渐深。'}
    ];
  },
  getWorldbook:async name=>clone(books[name]||[]),
  getCharWorldbookNames:async()=>({primary:'主世界书',additional:[]}),
  getChatWorldbookName:async()=> '',
  getGlobalWorldbookNames:async()=>[],
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
};
host.Mvu={
  getMvuData:()=>clone(current),
  replaceMvuData:async data=>{current=clone(data);}
};

(async()=>{
  const engine=new Engine(host);
  engine.config.selectedEntries=null;
  assert.equal(engine.services.context?.constructor?.name,'WorldRuntimeContextService');
  assert.equal(engine.services.knowledge?.constructor?.name,'WorldKnowledgeService');
  assert.equal(engine.services.requestBuilder?.constructor?.name,'WorldRequestBuilder');

  const snap=engine.services.context.snapshot();
  assert.equal(snap.id,3);
  assert.equal(snap.stat.世界.名称,'测试世界');
  assert.equal(engine.services.context.blocked(snap),'');
  assert.equal(engine.blocked(snap),'','public facade must preserve blocked behavior');

  const catalogue=await engine.services.knowledge.catalogue();
  assert.equal(catalogue.length,3);
  assert.equal(catalogue.find(x=>x.title==='[variables]技术条目').technical,true);
  const read=await engine.services.knowledge.worldbook('钟塔');
  assert.deepEqual(read.map(x=>x.名称),['蓝灯设定','绿灯设定']);
  assert.ok(Array.isArray(read.report));
  assert.equal(read.report.find(x=>x.名称==='[variables]技术条目').读取,false);

  engine.config.contextTurns=2;
  engine.config.requireMacroBackbone=false;
  engine.worldbook=async scan=>engine.services.knowledge.worldbook(scan);
  const request=await engine.services.requestBuilder.build(engine.snapshot());
  assert.equal(request.manifest.输出协议,'WorldResult v1');
  assert.equal(request.schema.type,'object');
  const payload=JSON.parse(request.input);
  assert.equal(payload.正文楼层.length,2);
  assert.match(payload.正文楼层.at(-1).正文,/钟塔敲响/);
  assert.ok(Array.isArray(payload.世界书));

  const runtime=fs.readFileSync(path.join(root,'script','world-engine-src','40-engine-runtime.part.js'),'utf8');
  assert.match(runtime,/snapshot\(\)\s*\{\s*return this\.services\?\.context\?\.snapshot/,'runtime snapshot must delegate to context service');
  assert.match(runtime,/async catalogue\(\)\s*\{\s*return this\.services\?\.knowledge\?\.catalogue/,'runtime catalogue must delegate to knowledge service');
  assert.match(runtime,/async buildRequest\(base\)\s*\{\s*return this\.services\?\.requestBuilder\?\.build/,'runtime base request must delegate to request builder');
  assert.doesNotMatch(runtime,/const sources=new Map\(\)/,'worldbook catalogue implementation must leave runtime');
  assert.doesNotMatch(runtime,/const structuralFixes=normalizeEventLayers\(state\)/,'base request construction must leave runtime');

  console.log('PASS runtime context, knowledge and base request construction are real class services');
})().catch(error=>{console.error(error);process.exitCode=1;});
