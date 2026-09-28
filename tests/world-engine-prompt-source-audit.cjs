const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const registryPath=path.join(root,'src','WorldEngine','prompts','WorldPromptRegistry.part.js');
const registry=fs.readFileSync(registryPath,'utf8');

function filesUnder(dir){
  if(!fs.existsSync(dir))return [];
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...filesUnder(file));
    else if(entry.isFile()&&/\.(?:js|cjs)$/.test(entry.name))out.push(file);
  }
  return out;
}

const sources=[
  ...filesUnder(path.join(root,'script','world-engine-src')),
  ...filesUnder(path.join(root,'src','WorldEngine')),
];
const promptNames=new Map();
const pattern=/\bconst\s+([A-Z][A-Z0-9_]*(?:PROMPT|RULES|GUIDANCE|INSTRUCTION)[A-Z0-9_]*)\s*=/g;
for(const file of sources){
  const text=fs.readFileSync(file,'utf8');
  for(const match of text.matchAll(pattern)){
    const name=match[1];
    // 预设文档 ID / 版本号只是配置元数据，不是发送给 AI 的提示词文本。
    if(/PROMPT_(?:DOCUMENT|VERSION)/.test(name))continue;
    if(name==='DEFAULT_WORLD_RETRY_GUIDANCE_SERVICE')continue; // service singleton metadata, not model-facing prompt text
    if(!promptNames.has(name))promptNames.set(name,[]);
    promptNames.get(name).push(path.relative(root,file));
  }
}
assert.ok(promptNames.size>10,'prompt source audit should discover real prompt constants');

const missing=[];
for(const [name,files] of promptNames){
  if(files.every(file=>file==='src/WorldEngine/prompts/WorldPromptRegistry.part.js'))continue;
  if(!registry.includes(name))missing.push({name,files});
}
assert.deepEqual(missing,[],'every named static AI prompt/rule/guidance constant must be referenced by WorldPromptRegistry');

const retryGuidance=fs.readFileSync(path.join(root,'src','WorldEngine','domains','WorldRetryGuidanceService.part.js'),'utf8');
const retryDefaults=retryGuidance.match(/const WORLD_RETRY_GUIDANCE_DEFAULTS=Object\.freeze\(\{([\s\S]*?)\}\);/);
assert.ok(retryDefaults,'retry guidance defaults must be discoverable');
const retryKeys=Array.from(retryDefaults[1].matchAll(/\b(retryGuide[A-Z][A-Za-z0-9]*)\s*:/g),match=>match[1]);
assert.ok(retryKeys.length>=20,'retry guidance audit should discover every retry template');
for(const key of retryKeys)assert.ok(registry.includes("key:'"+key+"'"),'retry guidance must be editable through WorldPromptRegistry: '+key);

const inline=[];
for(const file of sources){
  if(file===registryPath)continue;
  const text=fs.readFileSync(file,'utf8');
  const lines=text.split(/\r?\n/);
  lines.forEach((line,index)=>{
    if(/request\.system\s*=.*[\x60'"]【/.test(line))inline.push(path.relative(root,file)+':'+(index+1));
  });
}
assert.deepEqual(inline,[],'do not inject new inline system prompt text outside WorldPromptRegistry');

const runtimeNeutralityTargets=[
  ...filesUnder(path.join(root,'src','WorldEngine')),
  path.join(root,'script','世界推进系统.js')
].filter(file=>fs.existsSync(file));
const franchiseTerms=[
  '学园默示录','藤美学园','床主市','高城家','毒岛冴子',
  '斩！赤红之瞳','斩赤红之瞳','塞琉·尤比基塔斯','帝具','狩人部队','夜袭',
  '天台','教室','医务室','校医室','校门','校车'
];
const runtimeFranchiseLeaks=[];
for(const file of runtimeNeutralityTargets){
  const text=fs.readFileSync(file,'utf8');
  for(const term of franchiseTerms){
    if(text.includes(term))runtimeFranchiseLeaks.push({file:path.relative(root,file),term});
  }
}
assert.deepEqual(runtimeFranchiseLeaks,[],'world-engine runtime must stay franchise-neutral; examples belong only in test fixtures or content packs');

const workspace=fs.readFileSync(path.join(root,'src','WorldEngine','ui','WorldPromptWorkspaceController.part.js'),'utf8');
assert.match(workspace,/全部实际提示词/);
assert.match(workspace,/作用范围/);
assert.match(workspace,/发送条件/);

console.log('PASS static prompt source audit keeps AI instructions discoverable through WorldPromptRegistry');
