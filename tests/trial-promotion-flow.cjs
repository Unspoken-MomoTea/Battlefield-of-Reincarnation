const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'script/悬浮球状态栏.js'),'utf8');
const settlement=fs.readFileSync(path.join(root,'Regular/结算任务美化.html'),'utf8');
const trialUi=fs.readFileSync(path.join(root,'Regular/试炼任务美化.html'),'utf8');
const currentVariables=fs.readFileSync(path.join(root,'World Book/[variables]当前变量.txt'),'utf8');
const auxiliary=fs.readFileSync(path.join(root,'script/辅助计算脚本.js'),'utf8').replace(/\r\n/g,'\n');
const clone=x=>JSON.parse(JSON.stringify(x));
function part(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
new vm.Script(ui);
for(const name of ['试炼任务美化.html','结算任务美化.html']){
    const html=fs.readFileSync(path.join(root,'Regular',name),'utf8');
    for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(script[1]);
}
const ranks=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
const normalizeLifeTier=value=>ranks.includes(value)?value:'Ⅰ';
const validate=new Function('normalizeLifeTier','TIER_ROMAN',part(ui,'    function validateTrialAdvancement(', '    function renderTierProgressBar(')+';return validateTrialAdvancement;')(normalizeLifeTier,ranks);
const render=new Function('normalizeLifeTier','TIER_ROMAN','TIER_QUALITY','tierQOfClass','calcTrialScore','TRIAL_SCORE_THRESHOLD','esc',part(ui,'    function renderTierProgressBar(', '    /* 队友段位累计')+';return renderTierProgressBar;')(normalizeLifeTier,ranks,['F','E','D','C','B','A','S','SS','SSS'],()=> 'F',()=>5,24,String);
const fresh=()=>({角色:{层级:'Ⅰ'},系统状态:{是否可试炼:false,试炼已完成:false,是否试炼任务:true,是否战斗中:false},设置:{},世界:{名称:'试炼世界'},任务:{列表:{试炼一:{委托方:'晋升试炼',状态:'进行中'}},副本成就:{}}});
const completed=fresh();completed.系统状态.试炼已完成=true;
assert.match(render(completed.角色,{},completed.系统状态),/data-tier-act="start"/,'completed trial must show promotion even after attribute score drops');
assert.equal(validate(completed,'Ⅱ').nextTier,'Ⅱ');
assert.ok(validate(fresh(),'Ⅱ').error);
assert.ok(validate({...completed,系统状态:{...completed.系统状态,是否战斗中:true}},'Ⅱ').error);
assert.ok(validate(completed,'Ⅲ').error,'stale or forged target must be rejected');
assert.ok(validate({...completed,角色:{层级:'Ⅸ'}},'').error);

const extractTrialTasks=new Function(part(settlement,'          function isTrialTaskCommissioner(value) {','          function readTrialTasks() {')+';return extractTrialTasks;')();
const commissionerMatched={系统状态:{是否试炼任务:true},任务:{列表:{
    试炼一:{委托方:'晋升试炼',状态:'可结算'},
    试炼二:{委托方:'系统晋升试炼',状态:'可结算'},
    普通任务:{委托方:'主神任务',状态:'可结算'}
}}};
assert.deepEqual(extractTrialTasks(commissionerMatched).map(x=>x.key),['试炼一','试炼二'],'trial tasks must be found by commissioner keyword instead of task names');
assert.deepEqual(extractTrialTasks({任务:{列表:{
    甲:{委托方:'主神空间',状态:'可结算'},
    乙:{委托方:'普升试炼',状态:'可结算'},
    丙:{委托方:'本地公会',状态:'可结算'}
}}}).map(x=>x.key),['乙'],'only commissioner values containing the trial keyword belong to the trial set');
assert.match(trialUi,/stat_data\.系统状态\.是否试炼任务['"],true/,'trial beautifier must persist the hidden active-trial marker');
assert.doesNotMatch(trialUi,/试炼任务名单/,'trial beautifier must not persist task-name lists');
assert.match(currentVariables,/是否试炼任务/,'AI variable projection must explicitly hide active-trial marker');
assert.doesNotMatch(currentVariables,/试炼任务名单/,'removed trial task-name list must not remain in AI projection');

const finalizationSource=part(settlement,'          function applySettlementFinalization(', '          async function writeSettlementToMvu(');
function finalizeHarness(tasks,single=false){
    const context={trialTasks:tasks,rawText:'轮回清算协议',hasSettlementHeader:()=>true,isFullSettlement:()=>true,
        isTrialPassed:list=>list.length>0&&list.every(t=>t.status==='可结算'),
        isSettlementTaskTerminal:status=>status==='可结算'||status==='失败',
        readReincarnatorTier:s=>(s.stat_data||s).角色.层级,settlementBaselineTier:'Ⅰ',settlementTaskKeys:['试炼一'],console};
    vm.createContext(context);vm.runInContext(finalizationSource,context);
    const data=fresh();data.设置.单一世界=single;
    return {data,apply:()=>context.applySettlementFinalization(data,true),context};
}
for(const single of [false,true]){
    const x=finalizeHarness([{key:'试炼一',status:'进行中'}],single);
    x.apply();assert.ok(x.data.任务.列表.试炼一,'pending trials must not be erased');
    assert.equal(x.data.系统状态.试炼已完成,false);
    assert.equal(x.data.系统状态.是否试炼任务,true,'pending trial must retain its hidden identity until terminal settlement');
    x.context.trialTasks=[{key:'试炼一',status:'可结算'}];
    x.apply();assert.equal(x.data.系统状态.试炼已完成,true);
    assert.equal(x.data.系统状态.是否试炼任务,false,'terminal settlement must consume active-trial marker');
    assert.equal(Object.keys(x.data.任务.列表).length,0);
    assert.equal(x.data.角色.层级,'Ⅰ','settlement grants eligibility, not a level');
    x.data.角色.层级='Ⅱ';x.data.系统状态.试炼已完成=false;
    x.apply();assert.equal(x.data.系统状态.试炼已完成,false,'replayed settlement cannot regrant spent promotion');
}
const failed=finalizeHarness([{key:'试炼一',status:'失败'}]);failed.apply();assert.equal(failed.data.系统状态.试炼已完成,false);assert.equal(failed.data.系统状态.是否试炼任务,false,'failed terminal trial must also consume active marker');
const partial=finalizeHarness([{key:'试炼一',status:'可交付'}]);partial.apply();assert.ok(partial.data.任务.列表.试炼一);assert.equal(partial.data.系统状态.试炼已完成,false);assert.equal(partial.data.系统状态.是否试炼任务,true);

let current={stat_data:clone(completed)},writes=0;
const host={};
const context={GS_PARENT:host,window:host,_:{cloneDeep:clone},getMvuGlobal:()=>host,setTimeout:()=>{},console:{log:()=>{},warn:()=>{},error:()=>{}}};
host.Mvu={getMvuData:()=>clone(current),replaceMvuData:data=>{
    assert.equal(host.__samsaraUIMutation,true,'synchronous write events must already be marked as UI changes');
    assert.equal(host.__samsaraTierPermit,'Ⅱ','permit must exist before persistence');
    current=clone(data);writes++;
},events:{VARIABLE_UPDATE_ENDED:'mvu'}};
vm.createContext(context);
vm.runInContext(part(ui,'    function writeBackMvu(', '    /* ===== 8. 工具函数'),context);
vm.runInContext(part(auxiliary,'    function tierPermitAllows(', '    /**\n     * 数据守卫'),context);
const promote=()=>context.writeBackMvu(stat=>{
    const check=validate(stat,'Ⅱ');if(check.error)throw new Error(check.error);
    stat.角色.层级=check.nextTier;stat.系统状态.试炼已完成=false;
},{tierPermit:'Ⅱ'});
assert.equal(promote(),true);assert.equal(current.stat_data.角色.层级,'Ⅱ');assert.equal(current.stat_data.系统状态.试炼已完成,false);
assert.equal(host.__samsaraUIMutation,false);
assert.equal(promote(),false,'second click cannot reuse completed trial');
assert.equal(host.__samsaraTierPermit,'Ⅱ','rejected duplicate must not revoke the first promotion permit');
assert.equal(context.tierPermitAllows('Ⅱ'),true,'deferred MVU event must retain its permit');
assert.equal(context.tierPermitAllows('Ⅱ'),false,'permit must be consumed');
assert.equal(writes,2,'one message write and one chat write only');
console.log('PASS trial flow: commissioner-keyword identity, terminal marker cleanup, pending/failed/completed settlement, both world modes, promotion replay protection');