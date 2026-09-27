const assert=require('node:assert/strict');
const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

const backend=emptyState();
const stat={
  世界:{
    名称:'渲染测试世界',
    地点:'测试地点',
    时间:'2026年09月27日-下午',
    稳定:100,
    后台:backend,
    因果轨道:{当前阶段:'测试阶段',故事线:'',下一节点:'',偏移记录:{}},
    异端雷达:{名单:{}},
    势力:{},探索:{},历法:{},法则:[],货币:{}
  },
  设置:{},
  系统状态:{是否在主神空间:false,游玩天数:1},
  关系列表:{},任务:{列表:{}},资产:{},
  传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};

const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  getCurrentChatId:()=> 'panel-renderer-test',
  getChatMessages:()=>[],
  Mvu:{getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async()=>{}},
  Samsara:{terminal:{apiReady:()=>false}},
  document:{addEventListener:()=>{},removeEventListener:()=>{}}
};
const engine=new Engine(host);
engine.snapshot=()=>({stat:clone(stat),fingerprint:'["panel-renderer-test",1,0,"x"]'});
engine.blocked=()=> '';

const main={
  scrollTop:17,
  innerHTML:'',
  querySelector:()=>null,
  querySelectorAll:()=>[]
};
const nav={innerHTML:''};
const footer={textContent:''};
const runButton={
  disabled:false,textContent:'',attributes:{},
  setAttribute(name,value){this.attributes[name]=String(value);}
};
engine.panel={
  hidden:false,
  dataset:{},
  querySelector(selector){
    if(selector==='main')return main;
    if(selector==='nav')return nav;
    if(selector==='footer span')return footer;
    if(selector==='[data-action=run]')return runButton;
    return null;
  },
  querySelectorAll:()=>[]
};

engine.services.features.beforeRender=()=>{};
engine.services.features.afterRender=()=>{};
engine.services.editorController.afterRender=()=>{};
engine.promptWorkspace={mount:()=>{},syncEditableState:()=>{}};

let renderedKey='',renderContext=null;
engine.services.views.render=(key,context)=>{
  renderedKey=key;renderContext=context;
  return '<article data-rendered="'+key+'">'+context.text(context.w?.名称||'missing')+'</article>';
};

engine.tab='总览';
const result=engine.render(true);

assert.equal(result,undefined,'renderer keeps the existing void render contract');
assert.equal(engine.services.panelRenderer?.constructor?.name,'WorldPanelRenderer');
assert.equal(renderedKey,'world','legacy 总览 alias must normalize to the world view');
assert.equal(engine.tab,'世界推进');
assert.equal(renderContext.w.名称,'渲染测试世界');
assert.match(nav.innerHTML,/data-tab="世界推进"/,'navigation must include the world tab');
assert.match(nav.innerHTML,/data-tab="设置"/,'navigation must include the settings tab');
assert.match(main.innerHTML,/渲染测试世界/,'rendered shell must include the world name');
assert.match(main.innerHTML,/data-rendered="world"/,'renderer must append the selected business view');
assert.equal(main.scrollTop,0,'forced render must reset main scroll');
assert.equal(runButton.textContent,'推进世界');
assert.equal(runButton.attributes['aria-label'],'推进世界');
assert.equal(engine.panel.dataset.fontScale,'standard');
assert.equal(engine.panel.dataset.tone,'night');
assert.equal(footer.textContent,engine.status);

console.log('world-engine panel renderer regression tests passed');
