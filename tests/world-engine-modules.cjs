const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const dir=path.join(root,'script','world-engine-src');
const buildScript=fs.readFileSync(path.join(root,'tools','build-world-engine.py'),'utf8');
const built=fs.readFileSync(path.join(root,'script','世界推进系统.js'),'utf8');

// 以真实构建器声明的 PARTS 作为模块清单，避免测试自己维护第二份、最终与构建流程漂移的文件列表。
const partsBlock=buildScript.match(/PARTS\s*=\s*\(([\s\S]*?)\)\n\n/);
assert.ok(partsBlock,'build-world-engine.py must declare PARTS');
const declared=[...partsBlock[1].matchAll(/'([^']+\.part\.js)'/g)].map(match=>match[1]);
assert.ok(declared.length>=10,'world engine should be assembled from modular source parts');
assert.equal(new Set(declared).size,declared.length,'build PARTS must not contain duplicate modules');
for(const moduleName of ['ui/00-styles.part.js','ui/10-world-tab.part.js','ui/20-people-tab.part.js','ui/30-exploration-tab.part.js','ui/40-archive-tabs.part.js','ui/50-settings-tab.part.js','ui/60-prompt-tab.part.js','ui/70-request-inspector.part.js','editor/00-world-mutations.part.js','editor/10-event-editor.part.js','editor/20-person-editor.part.js']){
  assert.ok(declared.includes(moduleName),`domain module must be registered: ${moduleName}`);
}
for(const moduleName of [
  '@src/WorldEngine/core/WorldEngineServiceContainer.part.js',
  '@src/WorldEngine/core/WorldEngineFeatureRegistry.part.js',
  '@src/WorldEngine/core/WorldEngineClassBridge.part.js',
  '@src/WorldEngine/prompts/WorldPromptRegistry.part.js',
  '@src/WorldEngine/domains/WorldCausalService.part.js',
  '@src/WorldEngine/domains/WorldNpcAuditPromptFeature.part.js',
  '@src/WorldEngine/ui/WorldEditorController.part.js',
  '@src/WorldEngine/ui/WorldApiPresetController.part.js',
  '@src/WorldEngine/ui/WorldCausalOverviewController.part.js'
]){
  assert.ok(declared.includes(moduleName),`class source module must be registered: ${moduleName}`);
}

function sourcePartsUnder(base,relative=''){
  const out=[];
  for(const entry of fs.readdirSync(path.join(base,relative),{withFileTypes:true})){
    const next=relative?path.join(relative,entry.name):entry.name;
    if(entry.isDirectory())out.push(...sourcePartsUnder(base,next));
    else if(entry.isFile()&&entry.name.endsWith('.part.js'))out.push(next.split(path.sep).join('/'));
  }
  return out;
}
const legacyDeclared=declared.filter(file=>!file.startsWith('@'));
const srcDeclared=declared.filter(file=>file.startsWith('@'));
const actual=sourcePartsUnder(dir).sort();
assert.deepEqual([...legacyDeclared].sort(),actual,'every legacy world-engine source part must be registered in the real build pipeline');
for(const file of srcDeclared){
  assert.ok(fs.existsSync(path.join(root,file.slice(1))),`registered src module must exist: ${file}`);
}

const sourcePath=file=>file.startsWith('@')?path.join(root,file.slice(1)):path.join(dir,...file.split('/'));
const texts=Object.fromEntries(declared.map(file=>{
  const text=fs.readFileSync(sourcePath(file),'utf8');
  assert.ok(text.length>0,`${file} must not be empty`);
  return [file,text];
}));
const assembled=declared.map(file=>texts[file]).join('');
assert.equal(built,assembled,'script/世界推进系统.js must exactly equal the source parts in build order');
assert.ok(texts['50-engine-ui.part.js'].length<50000,'main UI class should stay below 50 KB after control-tab extraction');
assert.doesNotMatch(texts['50-engine-ui.part.js'],/this\.style\.textContent\s*=\s*\[/,'base CSS must not grow back into the main UI class');
assert.match(texts['ui/00-styles.part.js'],/function worldEngineBaseStyleText\(/,'base CSS should live in a dedicated UI resource module');

// 本次迁移的关键 seam：replay 随主世界提交一次写入，恢复模块不再额外写第二次。
assert.match(texts['40-engine-runtime.part.js'],/buildWorldReplayPackage/,'primary world commit must carry replay metadata');
assert.match(texts['59-world-replay-persistence.part.js'],/worldReplayReprocessContext/);
assert.match(texts['59-world-replay-persistence.part.js'],/worldReplayLegacyPackage/);
assert.doesNotMatch(texts['59-world-replay-persistence.part.js'],/worldReplayPersistAfterSuccess/,'replay persistence must not create a second MVU write');

console.log(`world-engine modules synchronized through build declaration (${declared.length} parts)`);
