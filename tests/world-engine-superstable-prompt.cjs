const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');

const root=path.join(__dirname,'..');
const prompt=fs.readFileSync(path.join(root,'script/world-engine-src/00-foundation-prompt.part.js'),'utf8');
const runtime=fs.readFileSync(path.join(root,'script/world-engine-src/40-engine-runtime.part.js'),'utf8');
const aux=fs.readFileSync(path.join(root,'script/辅助计算脚本.js'),'utf8');

assert(!prompt.includes('结算玩家影响与世界自救'),'default preset must not always inject world self-defense');
assert(!prompt.includes('稳定<100时按90警觉/80定向排异'),'core rules must not expose every defense stage');
assert(prompt.includes("version:16,"),'built-in default prompt should be version 16');
assert(runtime.includes("if(state.设置?.世界超稳===true)state.世界.稳定=100;"),'request copy must normalize super-stable world stability to 100');
assert(runtime.includes("const stabilityPrompt=worldStabilityPrompt(state);"),'runtime must build stability prompt from current state');
assert(runtime.includes("(stabilityPrompt?'\\n\\n'+stabilityPrompt:'')"),'stability prompt must be conditionally injected');
assert(/if \(statData\.设置\?\.世界超稳 === true\) \{\s*statData\.世界\.稳定 = 100;\s*return;\s*\}/.test(aux),'auxiliary calculation must hard-lock super-stable worlds to 100');

const stageMatch=prompt.match(/const WORLD_STABILITY_DEFENSE_STAGES = \[[\s\S]*?\n    \];/);
const fnMatch=prompt.match(/function worldStabilityPrompt\(stat\) \{[\s\S]*?\n    \}/);
assert(stageMatch&&fnMatch,'stability prompt source missing');
const context={};
vm.runInNewContext(`${stageMatch[0]}\n${fnMatch[0]}\nthis.worldStabilityPrompt=worldStabilityPrompt;`,context);
const render=context.worldStabilityPrompt;
assert.strictEqual(render({设置:{世界超稳:true},世界:{稳定:20}}),'','super-stable mode must inject no self-defense stage prompt');
assert.strictEqual(render({设置:{世界超稳:false},世界:{稳定:100}}),'','stable baseline must inject no active defense prompt');
assert.match(render({设置:{世界超稳:false},世界:{稳定:99}}),/因果警觉/);
assert.match(render({设置:{世界超稳:false},世界:{稳定:80}}),/定向排异/);
assert.match(render({设置:{世界超稳:false},世界:{稳定:70}}),/因果追猎/);
assert.match(render({设置:{世界超稳:false},世界:{稳定:60}}),/全面围剿/);
assert.match(render({设置:{世界超稳:false},世界:{稳定:50}}),/世界武器化/);
assert.match(render({设置:{世界超稳:false},世界:{稳定:40}}),/猎杀现实/);
assert.match(render({设置:{世界超稳:false},世界:{稳定:30}}),/献祭式清除/);
assert.match(render({设置:{世界超稳:false},世界:{稳定:10}}),/终焉围猎/);
assert.match(render({设置:{世界超稳:false},世界:{稳定:1}}),/同归于尽/);
assert.match(render({设置:{世界超稳:false},世界:{稳定:0}}),/世界毁灭/);
console.log('world-engine super-stable prompt guard passed');
