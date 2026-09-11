from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8', newline='\n')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)


prompt_path = 'script/world-engine-src/00-foundation-prompt.part.js'
prompt = read(prompt_path)
prompt = replace_once(
    prompt,
    'Step 5 · 结算玩家影响与世界自救：只按<user>已确认行为结算探索、势力与重大因果偏移；读取世界.稳定，按当前阶段让排异压力优先收束到造成异常的轮回者及其据点、关系网和行动路径，必要时重构宏观骨架。',
    'Step 5 · 结算玩家影响：只按<user>已确认行为结算探索、势力与重大因果偏移；必要时重构宏观骨架。',
    'default preset step 5',
)
prompt = replace_once(
    prompt,
    '7. 因果与自救：只在关键人物命运、重大事件结果、势力格局或主线可行性实质改变时记偏移；负值=因果破坏，正值=修复/强化。世界超稳不新增偏移。稳定<100时按90警觉/80定向排异/70追猎/60全面围剿/50世界武器化/40猎杀现实/30献祭式清除/10终焉围猎/1同归于尽/0毁灭逐级针对轮回者；必须借世界观内合理载体作用于轮回者及其关系网，不给NPC全知。法则越破不代表主动排异越弱；旧轨道失效时同轮重构宏观顺序。',
    '7. 因果：只在关键人物命运、重大事件结果、势力格局或主线可行性实质改变时记偏移；负值=因果破坏，正值=修复/强化。世界超稳不新增偏移；旧轨道失效时同轮重构宏观顺序。',
    'core causality',
)
prompt = replace_once(prompt, 'version:15,', 'version:16,', 'prompt version')
prompt = replace_once(prompt, "exportedAt:'2026-09-11T11:30:00.000Z',", "exportedAt:'2026-09-11T12:30:00.000Z',", 'prompt exportedAt')
prompt = replace_once(prompt, "updatedAt:'2026-09-11T11:30:00.000Z',", "updatedAt:'2026-09-11T12:30:00.000Z',", 'prompt updatedAt')

marker = '    function splitPresetSegments(value) {'
if marker not in prompt:
    raise SystemExit('prompt insertion marker missing')
stability_code = '''    const WORLD_STABILITY_DEFENSE_STAGES = [
        {min:90,title:'因果警觉',rule:'异常线索、调查、误会与既有敌意开始沿合理因果链向轮回者及其直接关系网汇聚；仍以自然事件表现，不形成公开围剿。'},
        {min:80,title:'定向排异',rule:'藏身处、计划、联系人、资源链与行动路径持续受压；压力优先集中到轮回者本人及其直接关系网。'},
        {min:70,title:'因果追猎',rule:'原生强者、组织与主线冲突逐步被因果收束引向轮回者；据点、盟友、补给与撤退路线开始被系统性破坏。'},
        {min:60,title:'全面围剿',rule:'多个原生势力可基于各自合理动机同时追捕、封锁或攻击轮回者；普通安全生活基本结束。'},
        {min:50,title:'世界武器化',rule:'战争、灾害、怪物潮与原生顶级强者可沿因果链压向轮回者活动区；世界开始接受区域毁灭与大规模误伤作为清除代价。'},
        {min:40,title:'猎杀现实',rule:'环境、空间、时间与残存原生规则都可成为猎杀载体；世界接受永久区域毁灭，只求把入侵源一并埋葬。'},
        {min:30,title:'献祭式清除',rule:'世界进入免疫风暴，可牺牲主线人物、城市、国家乃至文明结构换取清除轮回者。'},
        {min:10,title:'终焉围猎',rule:'毁灭性事件持续向轮回者及其停留区域收束；长期停留会把灾难引向当前位置。'},
        {min:1,title:'同归于尽',rule:'世界放弃自保，主动牺牲法则、时间线与现实结构清除轮回者。'},
        {min:0,title:'世界毁灭',rule:'因果链、世界法则、时间线与现实结构均已终止，不再生成常规世界推进。'}
    ];
    function worldStabilityPrompt(stat) {
        if(stat?.设置?.世界超稳===true)return '';
        const raw=Number(stat?.世界?.稳定),stable=Number.isFinite(raw)?Math.max(0,Math.min(120,raw)):100;
        if(stable>=100)return '';
        const stage=WORLD_STABILITY_DEFENSE_STAGES.find(item=>stable>=item.min)||WORLD_STABILITY_DEFENSE_STAGES.at(-1);
        return `【世界自救 · ${stage.title}】\\n当前稳定值：${stable}。${stage.rule}\\n排异必须借世界观内合理载体发生，优先针对造成异常的轮回者及其据点、关系网、资源与行动路径；NPC仍只能依据自身认知和传播链行动，不得凭空全知。法则越破不代表主动排异越弱。`;
    }
'''
prompt = prompt.replace(marker, stability_code + marker, 1)
write(prompt_path, prompt)

runtime_path = 'script/world-engine-src/40-engine-runtime.part.js'
runtime = read(runtime_path)
runtime = replace_once(
    runtime,
    "            if(state.设置)delete state.设置.API;\n            delete state.商城;",
    "            if(state.设置)delete state.设置.API;\n            if(state.设置?.世界超稳===true)state.世界.稳定=100;\n            delete state.商城;",
    'runtime request stability normalization',
)
old_system = "            const system=this.config.preset+'\\n\\n'+CORE_WORLD_RULES+(npcAudit.length?'\\n\\n'+(this.config.npcAuditPrompt??NPC_BUILD_AUDIT_RULES):'')+'\\n\\n【WorldResult 业务输出协议】\\n'+((this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'\\n\\n【Canonical WorldResult JSON Schema】\\n程序实际字段定义（不可由文字说明改变）：\\n'+JSON.stringify(WORLD_RESULT_SCHEMA,null,2));"
new_system = "            const stabilityPrompt=worldStabilityPrompt(state);\n            const system=this.config.preset+'\\n\\n'+CORE_WORLD_RULES+(stabilityPrompt?'\\n\\n'+stabilityPrompt:'')+(npcAudit.length?'\\n\\n'+(this.config.npcAuditPrompt??NPC_BUILD_AUDIT_RULES):'')+'\\n\\n【WorldResult 业务输出协议】\\n'+((this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'\\n\\n【Canonical WorldResult JSON Schema】\\n程序实际字段定义（不可由文字说明改变）：\\n'+JSON.stringify(WORLD_RESULT_SCHEMA,null,2));"
runtime = replace_once(runtime, old_system, new_system, 'runtime conditional stability prompt')
write(runtime_path, runtime)

aux_path = 'script/辅助计算脚本.js'
aux = read(aux_path)
aux = replace_once(
    aux,
    "    function calcWorldStability(statData) {\n        if (!statData || !statData.世界 || !statData.世界.因果轨道 || statData.设置.世界超稳) return;\n        const records = statData.世界.因果轨道.偏移记录;",
    "    function calcWorldStability(statData) {\n        if (!statData || !statData.世界) return;\n        if (statData.设置?.世界超稳 === true) {\n            statData.世界.稳定 = 100;\n            return;\n        }\n        if (!statData.世界.因果轨道) return;\n        const records = statData.世界.因果轨道.偏移记录;",
    'aux super-stable hard lock',
)
write(aux_path, aux)

test_path = ROOT / 'tests/world-engine-superstable-prompt.cjs'
test_path.write_text('''const fs=require('fs');
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
assert(runtime.includes("(stabilityPrompt?'\\\\n\\\\n'+stabilityPrompt:'')"),'stability prompt must be conditionally injected');
assert(/if \\(statData\\.设置\\?\\.世界超稳 === true\\) \\{\\s*statData\\.世界\\.稳定 = 100;\\s*return;\\s*\\}/.test(aux),'auxiliary calculation must hard-lock super-stable worlds to 100');

const stageMatch=prompt.match(/const WORLD_STABILITY_DEFENSE_STAGES = \\[[\\s\\S]*?\\n    \\];/);
const fnMatch=prompt.match(/function worldStabilityPrompt\\(stat\\) \\{[\\s\\S]*?\\n    \\}/);
assert(stageMatch&&fnMatch,'stability prompt source missing');
const context={};
vm.runInNewContext(`${stageMatch[0]}\\n${fnMatch[0]}\\nthis.worldStabilityPrompt=worldStabilityPrompt;`,context);
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
''', encoding='utf-8', newline='\n')

print('super-stable prompt guard migration applied')
