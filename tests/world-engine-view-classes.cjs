const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const viewFiles=[
  'src/WorldEngine/ui/views/WorldOverviewView.part.js',
  'src/WorldEngine/ui/views/WorldPeopleView.part.js',
  'src/WorldEngine/ui/views/WorldExplorationView.part.js',
  'src/WorldEngine/ui/views/WorldAssetView.part.js',
  'src/WorldEngine/ui/views/WorldEventArchiveView.part.js',
  'src/WorldEngine/ui/views/WorldRumorView.part.js',
  'src/WorldEngine/ui/views/WorldHistoryView.part.js',
  'src/WorldEngine/ui/views/WorldSettingsView.part.js',
  'src/WorldEngine/ui/views/WorldPromptView.part.js',
  'src/WorldEngine/ui/views/WorldRequestInspectorView.part.js',
];
for(const file of viewFiles)assert.ok(fs.existsSync(path.join(root,file)),file+' must exist');
for(const file of viewFiles){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  assert.doesNotMatch(source,/return\s+worldEngineRender[A-Za-z]+\(/,file+' must own its render implementation instead of delegating to a legacy function');
}
for(const file of [
  'script/world-engine-src/ui/10-world-tab.part.js',
  'script/world-engine-src/ui/20-people-tab.part.js',
  'script/world-engine-src/ui/30-exploration-tab.part.js',
  'script/world-engine-src/ui/40-archive-tabs.part.js',
  'script/world-engine-src/ui/50-settings-tab.part.js',
  'script/world-engine-src/ui/60-prompt-tab.part.js',
  'script/world-engine-src/ui/70-request-inspector.part.js',
])assert.equal(fs.existsSync(path.join(root,file)),false,file+' should be removed after its implementation moves into the view class');

const registry=fs.readFileSync(path.join(root,'src/WorldEngine/ui/WorldEngineViewRegistry.part.js'),'utf8');
for(const name of [
  'WorldOverviewView','WorldPeopleView','WorldExplorationView','WorldAssetView','WorldEventArchiveView',
  'WorldRumorView','WorldHistoryView','WorldSettingsView','WorldPromptView','WorldRequestInspectorView'
]){
  assert.match(registry,new RegExp('new\\s+'+name+'\\b'),name+' must be registered');
}

const legacyUi=fs.readFileSync(path.join(root,'script/world-engine-src/50-engine-ui.part.js'),'utf8');
assert.doesNotMatch(legacyUi,/const ownersOf=asset=>/,'asset rendering must leave the application shell');
assert.doesNotMatch(legacyUi,/for\(const category of \['街头巷议','情报交易','布告与檄文'\]\)/,'rumor rendering must leave the application shell');
assert.match(legacyUi,/services(?:\?\.|\.)views(?:\?\.|\.)render\('assets'/,'asset tab must route through view registry');
assert.match(legacyUi,/services(?:\?\.|\.)views(?:\?\.|\.)render\('rumors'/,'rumor tab must route through view registry');

const {SamsaraWorldEngine:Engine}=require(path.join(root,'script','世界推进系统.js'));
const host={localStorage:{getItem:()=>null,setItem:()=>{}},document:{addEventListener:()=>{},removeEventListener:()=>{}}};
const engine=new Engine(host);
const keys=engine.services.views.keys();
for(const key of ['world','people','exploration','assets','events','rumors','history','settings','prompts','requestInspector']){
  assert.ok(keys.includes(key),'view registry missing '+key);
}
assert.equal(engine.services.views.get('assets').constructor.name,'WorldAssetView');
assert.equal(engine.services.views.get('rumors').constructor.name,'WorldRumorView');

console.log('PASS every world-engine business tab is a dedicated view class');
