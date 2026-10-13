import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const plotSource=readFileSync(new URL('../runtime/50-partner-plot.js',import.meta.url),'utf8');
const journeySource=readFileSync(new URL('../runtime/70-journey.js',import.meta.url),'utf8');
function harness(){
  const items=new Map();
  const element=id=>{
    if(!items.has(id)){
      const classes=new Set();
      items.set(id,{
        value:'',style:{display:'none'},textContent:'',focus(){this.focused=true;},
        classList:{
          add(name){classes.add(name);},
          remove(name){classes.delete(name);},
          toggle(name,force){
            if(force===true)classes.add(name);
            else if(force===false)classes.delete(name);
            else if(classes.has(name))classes.delete(name);
            else classes.add(name);
            return classes.has(name);
          },
          contains(name){return classes.has(name);},
        },
      });
    }
    return items.get(id);
  };
  const start=plotSource.indexOf('    function syncPlotModeForms() {');
  const end=plotSource.indexOf('    function renderPlots() {',start);
  assert.ok(start>=0&&end>start,'分栏模式应有独立表单可见性处理');
  const setup=[
    "let activePlotCat='multi',singleWorldEnabled=false,customMultiWorldEnabled=false,selectedPlot=null;",
    "const DB={plotCategories:[{key:'multi'},{key:'workshop'},{key:'single'}],plots:[{id:'w1',cat:'multi'},{id:'workshop1',cat:'workshop'}]};",
    "const $=el;const prompts=[];",
    "function alert(t){prompts.push(t);}",
    "function applySingleWorldIdentityOverride(){el('identity').value='穿越者';}",
    "function restoreOriginalIdentity(){el('identity').value='原身份';}",
    "function renderPlotTabs(){} function renderPlots(){} function updateBgSummary(){}",
  ].join('\n');
  const result=[
    'return {switchPlotCat,selectCustomMultiWorld,toggleCustomMultiWorld,syncPlotModeForms,',
    'setPlot(id){selectedPlot=id;},',
    'state(){return {activePlotCat,singleWorldEnabled,customMultiWorldEnabled,selectedPlot,prompts:[...prompts]}}};',
  ].join('\n');
  return {api:new Function('el',setup+plotSource.slice(start,end)+result)(element),el:element};
}
test('单一世界表单只在单一栏目，多元自定义只在多元栏目，工坊两者都不显示',()=>{
  const {api,el}=harness();
  api.syncPlotModeForms();
  assert.equal(el('single-world-form').style.display,'none');
  assert.equal(el('custom-multi-world-form').style.display,'');
  api.switchPlotCat('single');
  assert.equal(api.state().singleWorldEnabled,true);
  assert.equal(el('single-world-form').style.display,'');
  assert.equal(el('custom-multi-world-form').style.display,'none');
  api.switchPlotCat('workshop');
  assert.equal(api.state().singleWorldEnabled,false);
  assert.equal(el('single-world-form').style.display,'none');
  assert.equal(el('custom-multi-world-form').style.display,'none');
  assert.equal(el('identity').value,'原身份');
});
test('多元自定义选择不启用单一世界、不保留其他分类的幽灵选中',()=>{
  const {api,el}=harness();
  api.setPlot('w1');
  api.selectCustomMultiWorld();
  assert.equal(api.state().customMultiWorldEnabled,false);
  assert.equal(api.state().selectedPlot,'w1');
  el('mw-name').value='艾泽拉斯';
  api.selectCustomMultiWorld();
  assert.equal(api.state().customMultiWorldEnabled,true);
  assert.equal(api.state().singleWorldEnabled,false);
  assert.equal(api.state().selectedPlot,null);
  assert.match(el('mw-select-btn').textContent,/已选择/);
  api.switchPlotCat('workshop');
  assert.equal(api.state().customMultiWorldEnabled,false);
  api.setPlot('workshop1');
  api.switchPlotCat('multi');
  assert.equal(api.state().selectedPlot,null);
});
test('多元表单有独立输入，MVU 和预设都从多元分支处理',()=>{
  const template=readFileSync(new URL('../page/template.html',import.meta.url),'utf8');
  assert.match(template,/id="custom-multi-world-form"/);
  assert.match(template,/id="single-world-form"/);
  const store=readFileSync(new URL('../runtime/40-store.js',import.meta.url),'utf8');
  for(const id of ['mw-name','mw-time','mw-identity','mw-mainstate'])assert.ok(store.includes(id));
  assert.match(journeySource,/else if \(customMultiWorldEnabled && activePlotCat==='multi'\)/);
  assert.match(journeySource,/stat_data\.设置\.单一世界', singleWorldEnabled/);
  assert.match(journeySource,/stat_data\.世界\.名称', worldName/);
  const presets=readFileSync(new URL('../runtime/60-navigation-presets.js',import.meta.url),'utf8');
  assert.match(presets,/customMultiWorldEnabled, customMultiWorld:/);
  assert.match(presets,/syncPlotModeForms\(\)/);
});
