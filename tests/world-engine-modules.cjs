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

const actual=fs.readdirSync(dir).filter(file=>file.endsWith('.part.js')).sort();
assert.deepEqual([...declared].sort(),actual,'every world-engine source part must be registered in the real build pipeline');

const texts=Object.fromEntries(declared.map(file=>{
  const text=fs.readFileSync(path.join(dir,file),'utf8');
  assert.ok(text.length>0,`${file} must not be empty`);
  return [file,text];
}));
const assembled=declared.map(file=>texts[file]).join('');
assert.equal(built,assembled,'script/世界推进系统.js must exactly equal the source parts in build order');

// 本次迁移的关键 seam：replay 随主世界提交一次写入，恢复模块不再额外写第二次。
assert.match(texts['40-engine-runtime.part.js'],/buildWorldReplayPackage/,'primary world commit must carry replay metadata');
assert.match(texts['59-world-replay-persistence.part.js'],/worldReplayReprocessContext/);
assert.match(texts['59-world-replay-persistence.part.js'],/worldReplayLegacyPackage/);
assert.doesNotMatch(texts['59-world-replay-persistence.part.js'],/worldReplayPersistAfterSuccess/,'replay persistence must not create a second MVU write');

console.log(`world-engine modules synchronized through build declaration (${declared.length} parts)`);
