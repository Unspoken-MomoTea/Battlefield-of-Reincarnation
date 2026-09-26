const assert=require('node:assert/strict');
const fs=require('node:fs');

const files=[
  'script/world-engine-src/core/00-services.part.js',
  'script/world-engine-src/ui/10-world-tab.part.js',
  'script/world-engine-src/ui/20-people-tab.part.js',
  'script/world-engine-src/ui/30-exploration-tab.part.js',
  'script/world-engine-src/ui/40-archive-tabs.part.js',
  'script/world-engine-src/ui/50-settings-tab.part.js',
  'script/world-engine-src/ui/60-prompt-tab.part.js',
  'script/world-engine-src/ui/70-request-inspector.part.js',
  'script/world-engine-src/editor/00-world-mutations.part.js',
  'script/world-engine-src/editor/10-event-editor.part.js',
  'script/world-engine-src/editor/20-person-editor.part.js',
  'script/world-engine-src/prompt/00-prompt-service.part.js',
];
for(const file of files)assert.ok(fs.existsSync(file),file+' must exist');

const source=files.map(file=>fs.readFileSync(file,'utf8')).join('\n');
for(const name of [
  'WorldEngineServices',
  'WorldMutationService',
  'WorldEventService',
  'WorldPersonActivityService',
  'WorldPromptService',
  'WorldTabView',
  'PeopleTabView',
  'ExplorationTabView',
  'ArchiveTabsView',
  'SettingsTabView',
  'PromptTabView',
  'RequestInspectorView',
]){
  assert.match(source,new RegExp('class\\s+'+name+'\\b'),name+' must be a real class');
}

const editorSource=[
  fs.readFileSync('script/world-engine-src/editor/00-world-mutations.part.js','utf8'),
  fs.readFileSync('script/world-engine-src/editor/10-event-editor.part.js','utf8'),
  fs.readFileSync('script/world-engine-src/editor/20-person-editor.part.js','utf8'),
].join('\n');
assert.doesNotMatch(editorSource,/SamsaraWorldEngineBefore|SamsaraWorldEngine\s*=\s*class/,'editor modules must use composition instead of inheritance patch chains');

const ui=fs.readFileSync('script/world-engine-src/50-engine-ui.part.js','utf8');
assert.match(ui,/this\.services\./,'main engine UI must delegate domain behavior through composed services');
assert.match(ui,/this\.views\./,'main engine UI must delegate rendering through composed view classes');

console.log('PASS world engine domain architecture uses composition classes');
