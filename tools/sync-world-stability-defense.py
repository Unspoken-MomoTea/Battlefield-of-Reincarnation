from pathlib import Path
import re

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

# 1) 世界推进默认提示词与不可覆盖核心约束。
prompt_path = 'script/world-engine-src/00-foundation-prompt.part.js'
prompt = read(prompt_path)
prompt = replace_once(
    prompt,
    'Step 5 · 结算玩家影响：只按<user>已确认行为结算探索与势力；只有重大因果改变才记偏移，必要时重构宏观骨架。',
    'Step 5 · 结算玩家影响与世界自救：只按<user>已确认行为结算探索、势力与重大因果偏移；读取世界.稳定，按当前阶段让排异压力优先收束到造成异常的轮回者及其据点、关系网和行动路径，必要时重构宏观骨架。',
    'DEFAULT_PRESET Step 5',
)
prompt = replace_once(
    prompt,
    '7. 因果：只在关键人物命运、重大事件结果、势力格局或主线可行性实质改变时记偏移；影响程度负值表示偏离原轨道，正值表示修复/强化。世界超稳时不新增偏移；旧轨道失效时同轮重构宏观顺序。',
    '7. 因果与自救：只在关键人物命运、重大事件结果、势力格局或主线可行性实质改变时记偏移；负值=因果破坏，正值=修复/强化。世界超稳不新增偏移。稳定<100时按90警觉/80定向排异/70追猎/60全面围剿/50世界武器化/40猎杀现实/30献祭式清除/10终焉围猎/1同归于尽/0毁灭逐级针对轮回者；必须借世界观内合理载体作用于轮回者及其关系网，不给NPC全知。法则越破不代表主动排异越弱；旧轨道失效时同轮重构宏观顺序。',
    'CORE_WORLD_RULES causality',
)
prompt = replace_once(prompt, 'version:14,', 'version:15,', 'prompt version')
prompt = replace_once(prompt, "exportedAt:'2026-09-10T00:00:00.000Z',", "exportedAt:'2026-09-11T11:30:00.000Z',", 'prompt exportedAt')
prompt = replace_once(prompt, "updatedAt:'2026-09-10T00:00:00.000Z',", "updatedAt:'2026-09-11T11:30:00.000Z',", 'prompt updatedAt')
write(prompt_path, prompt)

# 2) 世界推进面板：文案与当前《世界因果与法则协议》保持一致。
ui_path = 'script/world-engine-src/50-engine-ui.part.js'
ui = read(ui_path)
pattern = re.compile(
    r'            // 区间标题与效果逐字取自 ⚙️世界因果与法则协议。\n'
    r'            const stabilityStages=\[.*?\];\n'
    r'            const stabilityDescription=stable=>\{.*?\n'
    r'            \};',
    re.S,
)
new_block = '''            // 稳定阶段与防御强度取自 ⚙️世界因果与法则协议；这里只展示当前阶段。
            const stabilityStages=[
                {min:111,max:120,title:'黄金祝福 | 稳定强化',effects:['世界基本消化外来干涉，原生因果处于高强度收束状态','轮回者没有主动围剿压力，但外来力量仍受完整原生法则约束']},
                {min:101,max:110,title:'世界青睐 | 稳定强化',effects:['因果结构优于原始基准，秩序与资源循环趋于健康','世界对轮回者的主动排异很低']},
                {min:100,max:100,title:'原著时间线 | 稳定',effects:['世界按既定轨迹运行，不主动针对轮回者，也不提供额外庇护']},
                {min:90,max:99,title:'因果警觉 | 稳定',effects:['世界开始识别异常源','目击、调查、误会与敌意沿合理因果链向轮回者汇聚']},
                {min:80,max:89,title:'定向排异 | 稳定',effects:['藏身处、计划、联系人与资源链持续受压','压力优先集中到轮回者本人及其直接关系网']},
                {min:70,max:79,title:'因果追猎 | 松动',effects:['原生强者、组织与主线冲突逐步被因果收束引向轮回者','据点、盟友、补给与撤退路线开始被系统性破坏']},
                {min:60,max:69,title:'全面围剿 | 松动',effects:['多个原生势力可从各自合理动机同时追捕、封锁或攻击轮回者','普通安全生活基本结束，逃离一处不代表摆脱追猎']},
                {min:50,max:59,title:'世界武器化 | 松动',effects:['战争、灾害、怪物潮与原生顶级强者可被因果链引向轮回者活动区','世界开始接受区域毁灭与大规模误伤作为清除代价']},
                {min:40,max:49,title:'猎杀现实 | 崩坏',effects:['环境、空间、时间与残存原生规则都可成为猎杀轮回者的载体','世界接受永久区域毁灭，只求把入侵源一并埋葬']},
                {min:30,max:39,title:'献祭式清除 | 崩坏',effects:['世界进入免疫风暴，围剿不再优先保护自身秩序','可牺牲主线人物、城市、国家乃至文明结构换取清除轮回者']},
                {min:10,max:29,title:'终焉围猎 | 混乱',effects:['毁灭性事件持续向轮回者及其停留区域收束','长期停留会把灾难引向当前位置，必须修复因果或持续撤离']},
                {min:1,max:9,title:'同归于尽 | 混乱',effects:['世界放弃自保，主动牺牲法则、时间线与现实结构清除轮回者','只剩修复异常根源或在世界死亡前撤离']},
                {min:0,max:0,title:'世界毁灭',effects:['因果链、世界法则、时间线与现实结构全部终止','所有未撤离实体的生命、意识与灵魂一并被彻底抹除']}
            ];
            const stabilityDescription=stable=>{
                if(s.设置?.世界超稳===true)return '<p class="we-muted">世界超稳 · 稳定值固定100<br>禁止新增因果偏移与主动排异升级</p>';
                if(stable===null)return '<p class="we-muted">世界稳定值未记录</p>';
                const normalized=Math.max(0,Math.min(120,Number(stable)));
                const stage=stabilityStages.find(item=>normalized>=item.min&&normalized<=item.max);
                return stage?'<div class="we-stability-description"><p><b>'+text(stage.title)+'</b></p><ul>'+stage.effects.map(effect=>'<li>'+text(effect)+'</li>').join('')+'</ul></div>':'<p class="we-muted">稳定值超出协议范围</p>';
            };'''
ui, count = pattern.subn(new_block, ui, count=1)
if count != 1:
    raise SystemExit(f'UI stability block: expected 1 match, got {count}')
ui = replace_once(ui, "impact<0?'偏离原轨道':impact>0?'修复 / 强化原轨道'", "impact<0?'因果破坏':impact>0?'因果修复 / 强化'", 'offset labels')
ui = replace_once(ui, "'原轨道基准 100'", "'基准 100 · 失稳将强化世界排异'", 'stability subtitle')
write(ui_path, ui)

# 3) 同步现有回归断言。
test_path = 'tests/world-engine-stability-ui.cjs'
test = read(test_path)
if '世界局部细节开始偏离原著' in test:
    test = test.replace('世界局部细节开始偏离原著', '世界开始识别异常源')
write(test_path, test)

pipeline_path = 'tests/world-engine-prompt-pipeline.cjs'
pipeline = read(pipeline_path)
pipeline = re.sub(
    r'assert\(source\.includes\("version:\d+,\\n        builtin:true,\\n        name:\'默认设置\'"\), \'built-in prompt version should be \d+\'\);',
    'assert(source.includes("version:15,\\n        builtin:true,\\n        name:\'默认设置\'"), \'built-in prompt version should be 15\');',
    pipeline,
    count=1,
)
pipeline = pipeline.replace("  '影响程度负值表示偏离原轨道',", "  '负值=因果破坏',\n  '法则越破不代表主动排异越弱',")
pipeline = pipeline.replace("assert(core.length < 1550,", "assert(core.length < 1850,")
write(pipeline_path, pipeline)

# 4) 轻量一致性检查，不依赖浏览器。
def require(text, marker, label):
    if marker not in text:
        raise SystemExit(f'{label}: missing {marker}')

prompt = read(prompt_path)
ui = read(ui_path)
for marker in ['结算玩家影响与世界自救', '90警觉/80定向排异/70追猎', '法则越破不代表主动排异越弱']:
    require(prompt, marker, 'prompt')
for marker in ['因果警觉 | 稳定', '定向排异 | 稳定', '全面围剿 | 松动', '世界武器化 | 松动', '猎杀现实 | 崩坏', '献祭式清除 | 崩坏', '终焉围猎 | 混乱', '同归于尽 | 混乱', '世界毁灭']:
    require(ui, marker, 'ui')
for stale in ['轻度偏移 | 稳定', '初步警觉 | 稳定', '世界疏离 | 松动', '终焉倒计时 | 法则混乱']:
    if stale in ui:
        raise SystemExit(f'ui: stale stability copy remains: {stale}')

print('world stability defense sync passed')
