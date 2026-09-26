const assert=require('node:assert/strict');
const {
  SamsaraWorldEngine:Engine,
  emptyState,
  WORLD_EDITABLE_PROMPT_DEFS
}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

function fresh(){
  return {
    世界:{名称:'测试世界',时间:'2026年09月26日-上午',地点:'北门',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'封锁',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},货币:{},历法:{},法则:[]},
    任务:{列表:{}},系统状态:{是否在主神空间:false},设置:{},关系列表:{},资产:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  };
}
function hostFor(ref,calls=[]){
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'all-prompts-visible',
    getChatMessages:()=>[{message_id:9,role:'assistant',message:'北门封锁仍在继续。'}],
    document:{addEventListener:()=>{},removeEventListener:()=>{},createElement:()=>({style:{},click(){},remove(){}}),body:{appendChild:()=>{}}},
    Blob:globalThis.Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}},
    Samsara:{terminal:{apiReady:()=>true,request:async(system,input)=>{calls.push({system:String(system||''),input:String(input||'')});return JSON.stringify({摘要:'压缩完成'});}}}
  };
  host.Mvu={getMvuData:()=>({stat_data:clone(ref.value)}),replaceMvuData:async raw=>{ref.value=clone(raw.stat_data);}};
  return host;
}

(async()=>{
  assert.ok(Array.isArray(WORLD_EDITABLE_PROMPT_DEFS)&&WORLD_EDITABLE_PROMPT_DEFS.length>=25,'all editable runtime prompt text needs a central registry');
  const keys=new Set(WORLD_EDITABLE_PROMPT_DEFS.map(item=>item.key));
  for(const key of [
    'input.currentState','input.taskList','macro.planning','due.review','stage.knowledgePriority','proseProjection.requirement','request.finalNote',
    'worldTime.initializationForbidden','chronology.requirement','rumor.sourceBoundary','worldActivity.primary',
    'retry.acceptedWithPlan','retry.fresh','retry.chronology','retry.integrity','history.system','history.inputInstruction',
    'system.worldResultHeading','system.schemaHeading'
  ])assert.ok(keys.has(key),'missing editable prompt key: '+key);

  const ref={value:fresh()},calls=[],host=hostFor(ref,calls),engine=new Engine(host);
  engine.config.enabled=true;engine.config.contextTurns=1;engine.config.requireMacroBackbone=false;engine.worldbook=async()=>[];
  const customized={...engine.config.requestPrompts,
    'input.currentState':'【自定义当前变量说明】',
    'proseProjection.requirement':'【自定义正文投影】',
    'request.finalNote':'【自定义最终说明】',
    'history.system':'【自定义历史压缩系统】',
    'history.inputInstruction':'【自定义历史压缩输入】',
    'retry.fresh':'【自定义首次纠错】'
  };
  engine.applyPromptTextSettings(customized);
  const request=await engine.buildRequest(engine.snapshot());
  const payload=JSON.parse(request.input);
  assert.equal(payload.输入语义.当前变量,'【自定义当前变量说明】');
  assert.equal(payload.正文可见投影规则.要求,'【自定义正文投影】');
  assert.equal(payload.说明,'【自定义最终说明】');

  const retry=JSON.parse(engine.buildRetryInput(request.input,new Error('测试错误'),'bad',1,3,null,[]));
  assert.equal(retry.纠错重试.要求,'【自定义首次纠错】');

  const batch=[{id:'历史:推进·1',name:'推进·1',level:0,text:'旧事实',timeStart:'第1日',timeEnd:'第1日',lo:1,hi:1}];
  await engine.requestHistoryMemorySummary({名称:'测试世界'},batch,1);
  assert.equal(calls.at(-1).system,'【自定义历史压缩系统】');
  assert.match(calls.at(-1).input,/自定义历史压缩输入/);

  const catalog=engine.promptCatalog();
  assert.ok(catalog.every(item=>typeof item.value==='string'));
  assert.equal(catalog.find(item=>item.key==='input.currentState').value,'【自定义当前变量说明】');

  const ui=require('node:fs').readFileSync('script/world-engine-src/ui/60-prompt-tab.part.js','utf8')
    +require('node:fs').readFileSync('script/world-engine-src/59-all-editable-prompts.part.js','utf8');
  assert.match(ui,/data-request-prompt=/,'prompt preset UI must render every request/history/retry prompt from the registry');
  console.log('PASS every effective AI instruction family is editable through the prompt preset registry');
})().catch(error=>{console.error(error);process.exitCode=1;});
