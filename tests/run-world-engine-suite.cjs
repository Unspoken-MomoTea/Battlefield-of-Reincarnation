const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.join(__dirname,'..');
const testsDir=__dirname;
const integrationTests=[
  'world-time-lifecycle.cjs',
  'asset-harvest-lifecycle.cjs',
  'offstage-knowledge-boundary.cjs',
];

const worldEngineTests=fs.readdirSync(testsDir,{withFileTypes:true})
  .filter(entry=>entry.isFile()&&/^world-engine-.*\.cjs$/.test(entry.name))
  .map(entry=>entry.name)
  .sort();
const missingIntegration=integrationTests.filter(file=>!fs.existsSync(path.join(testsDir,file)));
if(missingIntegration.length){
  console.error('[world-engine-suite] missing integration tests: '+missingIntegration.join(', '));
  process.exit(1);
}
const suite=[...worldEngineTests,...integrationTests];
console.log(`[world-engine-suite] running ${worldEngineTests.length} world-engine regressions + ${integrationTests.length} integration regressions`);

const failures=[];
for(const file of suite){
  console.log(`\n[world-engine-suite] ▶ ${file}`);
  const run=spawnSync(process.execPath,[path.join(testsDir,file)],{
    cwd:root,
    stdio:'inherit',
    env:process.env,
  });
  if(run.error||run.status!==0){
    failures.push({file,status:run.status,error:run.error?.message||''});
  }
}
if(failures.length){
  console.error(`\n[world-engine-suite] ${failures.length}/${suite.length} tests failed:`);
  for(const failure of failures){
    console.error(`- ${failure.file}${failure.status===null?'':` (exit ${failure.status})`}${failure.error?`: ${failure.error}`:''}`);
  }
  process.exit(1);
}
console.log(`\n[world-engine-suite] PASS ${suite.length}/${suite.length}`);
