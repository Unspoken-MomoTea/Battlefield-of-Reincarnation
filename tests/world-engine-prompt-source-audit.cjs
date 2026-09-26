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

const workspace=fs.readFileSync(path.join(root,'src','WorldEngine','ui','WorldPromptWorkspaceController.part.js'),'utf8');
assert.match(workspace,/全部实际提示词/);
assert.match(workspace,/作用范围/);
assert.match(workspace,/发送条件/);

console.log('PASS static prompt source audit keeps AI instructions discoverable through WorldPromptRegistry');
