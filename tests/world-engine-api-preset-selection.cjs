const assert=require('node:assert/strict');
const {SamsaraWorldEngine:Engine}=require('../script/世界推进系统.js');

const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  Samsara:{terminal:{apiReady:()=>true}},
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
  getCurrentChatId:()=> 'api-preset-selection-test',
  getChatMessages:()=>[]
};

const engine=new Engine(host);
engine.config.dedicatedApi={enabled:true,apiUrl:'https://one.example/v1',apiKey:'secret-one',model:'model-one',apiPresets:[],fetchedModels:[]};
engine.saveDedicatedApiPreset('Preset A');
engine.setDedicatedApi({apiUrl:'https://two.example/v1',apiKey:'secret-two',model:'model-two'});
engine.saveDedicatedApiPreset('Preset B');

engine.applyDedicatedApiPreset('Preset A');
assert.equal(engine.config.dedicatedApi.apiUrl,'https://one.example/v1','selecting a preset must still load its API values');
assert.equal(engine.dedicatedApiPresetSelection,'Preset A','selected preset must survive the render that follows loading it');

const select={value:'',options:[{value:''},{value:'Preset A'},{value:'Preset B'}]};
const remove={disabled:true};
engine.tab='设置';
engine.panel={
  querySelector(selector){
    if(selector==='[data-dedicated-preset]')return select;
    if(selector==='[data-action="dedicated-preset-delete"]')return remove;
    return null;
  }
};
engine.syncDedicatedApiPresetSelection();
assert.equal(select.value,'Preset A','settings rerender must restore the selected API preset in the dropdown');
assert.equal(remove.disabled,false,'delete must be enabled while a saved preset is selected');

assert.equal(engine.deleteDedicatedApiPreset('Preset A'),true,'the selected preset must be deletable');
assert.equal(engine.dedicatedApiPresetSelection,'','deleting the selected preset must clear the UI selection');
select.options=[{value:''},{value:'Preset B'}];
engine.syncDedicatedApiPresetSelection();
assert.equal(select.value,'','dropdown must return to the placeholder after deleting the selected preset');
assert.equal(remove.disabled,true,'delete must be disabled when no saved preset is selected');

console.log('PASS dedicated API preset selection survives rerender and can be deleted');
