const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

const stat={
  世界:{名称:'校验服务测试',时间:'2026年09月26日-下午',地点:'北门',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},货币:{},历法:{},法则:[],异端雷达:{名单:{}}},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  SillyTavern:{name1:'测试玩家'},
  Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
  getCurrentChatId:()=> 'validation-service',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'北门仍然平静。'}],
  document:{addEventListener:()=>{},removeEventListener:()=>{}}
};
host.Mvu={getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async()=>{}};

const engine=new Engine(host);
assert.equal(engine.services.validationPolicy?.constructor?.name,'WorldValidationPolicy');
assert.equal(engine.services.validation?.constructor?.name,'WorldValidationService');
assert.equal(engine.services.validation.policy,engine.services.validationPolicy);

const request={
  due:[],unscheduled:[],staleActive:[],timeAnomalies:[],alienActivity:[],npcAudit:[],
  timeline:{},seedPatches:[]
};
assert.equal(engine.services.validation.validate(clone(stat),request,null,stat),true);
assert.equal(engine.services.validation.progressionAnchorChanged(stat,clone(stat)),false);

const policy=fs.readFileSync(path.join(root,'src','WorldEngine','domains','WorldValidationPolicy.part.js'),'utf8');
const validationService=fs.readFileSync(path.join(root,'src','WorldEngine','domains','WorldValidationService.part.js'),'utf8');
const orchestrator=fs.readFileSync(path.join(root,'src','WorldEngine','domains','WorldRunOrchestrator.part.js'),'utf8');
assert.match(policy,/class\s+WorldValidationPolicy\b/,'validation base rules must live in a policy class');
assert.match(validationService,/this\.policy\.progressionAnchorChanged\(before,current\)/,'non-decorated progression anchor validation should delegate directly to the policy');
assert.match(validationService,/ensureDueHandled\(/,'decorated validation checks must continue through the global compatibility seams during migration');
assert.ok(orchestrator.includes('this.services.validation.validate(')||orchestrator.includes('this.services?.validation?.validate('),'run orchestrator must use one validation service seam');
assert.ok(orchestrator.includes('services?.validation?.progressionAnchorChanged(')||orchestrator.includes('services.validation.progressionAnchorChanged('),'run orchestrator must route progression anchor checks through validation service');

console.log('PASS runtime post-compile validation is class-based');
