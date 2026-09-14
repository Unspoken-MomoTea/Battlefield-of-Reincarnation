from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FOUNDATION = ROOT / 'script' / 'world-engine-src' / '00-foundation-prompt.part.js'
RUNTIME = ROOT / 'script' / 'world-engine-src' / '40-engine-runtime.part.js'
UI = ROOT / 'script' / 'world-engine-src' / '50-engine-ui.part.js'


def sub_once(text, pattern, replacement, label, flags=0):
    if re.search(pattern, text, flags):
        return re.sub(pattern, replacement, text, count=1, flags=flags)
    raise SystemExit(f'{label} anchor not found')


def insert_after_once(text, marker, addition, label):
    if addition.strip() in text:
        return text
    at = text.find(marker)
    if at < 0:
        raise SystemExit(f'{label} anchor not found')
    at += len(marker)
    return text[:at] + addition + text[at:]


# ---------------------------------------------------------------------------
# Foundation: keep the existing CORE_WORLD_RULES single-sourced, but move the
# built-in prompt document below all editable default text constants so the
# document can reference the exact same strings used by runtime.
# ---------------------------------------------------------------------------
text = FOUNDATION.read_text(encoding='utf-8')

if 'const DEFAULT_MACRO_PROMPT' not in text:
    # Remove the old built-in document from its pre-core location. It is
    # re-created below CORE_WORLD_RULES, where all referenced consts exist.
    old_doc = re.search(
        r"    const BUILTIN_DEFAULT_PROMPT_DOCUMENT = \{[\s\S]*?\n    const BUILTIN_DEFAULT_PROMPT_VERSION = BUILTIN_DEFAULT_PROMPT_DOCUMENT\.version;\n",
        text,
    )
    if not old_doc:
        raise SystemExit('built-in prompt document block not found')
    text = text[:old_doc.start()] + text[old_doc.end():]

    core = re.search(r"(    const CORE_WORLD_RULES = `[\s\S]*?`;\n)(    const WORLD_STABILITY_DEFENSE_STAGES)", text)
    if not core:
        raise SystemExit('CORE_WORLD_RULES block not found')

    additions = '''    const DEFAULT_MACRO_PROMPT = `【本轮宏观骨架交付】
先完成输入“本轮必须完成的宏观骨架”，再推演近期细节。至少3个可推进宏观节点是合并后的交付底线，进行中+待发生合计。未来规划可以跨越下一宏观边界，实际发生与细节推进不能越界；只输出差分不意味着可以省略尚未建立的骨架。提交前检查事件实体、分类、状态、时间、前因与因果.宏观顺序相互对应。`;
    const DEFAULT_STABILITY_PROMPT_TEMPLATE = `【世界自救 · {{阶段}}】
当前稳定值：{{稳定值}}。{{规则}}
排异必须借世界观内合理载体发生，优先针对造成异常的轮回者及其据点、关系网、资源与行动路径；NPC仍只能依据自身认知和传播链行动，不得凭空全知。法则越破不代表主动排异越弱。`;
    const BUILTIN_DEFAULT_PROMPT_DOCUMENT = {
        id:'builtin-default',
        type:'samsara-world-prompt-document',
        version:19,
        builtin:true,
        name:'默认设置',
        exportedAt:'2026-09-14T13:00:00.000Z',
        createdAt:'2026-09-08T13:09:45.350Z',
        updatedAt:'2026-09-14T13:00:00.000Z',
        settings:{
            corePrompt:CORE_WORLD_RULES,
            macroPrompt:DEFAULT_MACRO_PROMPT,
            stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,
            preset:normalizeEditablePreset(DEFAULT_PRESET),
            contextTurns:3,
            activationMode:'respect_activation',
            selectedEntries:copy(BUILTIN_DEFAULT_SELECTED_ENTRIES)
        }
    };
    const BUILTIN_DEFAULT_PROMPT_VERSION = BUILTIN_DEFAULT_PROMPT_DOCUMENT.version;
'''
    text = text[:core.end(1)] + additions + core.group(2) + text[core.end(2):]

if 'function worldStabilityPrompt(stat, template=DEFAULT_STABILITY_PROMPT_TEMPLATE)' not in text:
    pattern = r"    function worldStabilityPrompt\(stat\) \{[\s\S]*?\n    \}\n    function splitPresetSegments"
    replacement = '''    function worldStabilityPrompt(stat, template=DEFAULT_STABILITY_PROMPT_TEMPLATE) {
        if(stat?.设置?.世界超稳===true)return '';
        const raw=Number(stat?.世界?.稳定),stable=Number.isFinite(raw)?Math.max(0,Math.min(120,raw)):100;
        if(stable>=100)return '';
        const stage=WORLD_STABILITY_DEFENSE_STAGES.find(item=>stable>=item.min)||WORLD_STABILITY_DEFENSE_STAGES.at(-1);
        const source=String(template??DEFAULT_STABILITY_PROMPT_TEMPLATE);
        if(!source.trim())return '';
        return source.split('{{阶段}}').join(stage.title).split('{{稳定值}}').join(String(stable)).split('{{规则}}').join(stage.rule);
    }
    function splitPresetSegments'''
    text = sub_once(text, pattern, replacement, 'worldStabilityPrompt')

FOUNDATION.write_text(text, encoding='utf-8')


# ---------------------------------------------------------------------------
# Runtime: persist / import / export the editable blocks and use them in the
# actual system message. Nullish fallback is intentional: empty string means
# the user deliberately disabled that injected text.
# ---------------------------------------------------------------------------
text = RUNTIME.read_text(encoding='utf-8')

if 'corePrompt:CORE_WORLD_RULES' not in text:
    text = text.replace(
        '                preset:DEFAULT_PRESET,\n                retryAttempts:5,',
        '                preset:DEFAULT_PRESET,\n                corePrompt:CORE_WORLD_RULES,\n                macroPrompt:DEFAULT_MACRO_PROMPT,\n                stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,\n                retryAttempts:5,',
        1,
    )

migration = "\n            if(typeof this.config.corePrompt!=='string')this.config.corePrompt=CORE_WORLD_RULES;\n            if(typeof this.config.macroPrompt!=='string')this.config.macroPrompt=DEFAULT_MACRO_PROMPT;\n            if(typeof this.config.stabilityPromptTemplate!=='string')this.config.stabilityPromptTemplate=DEFAULT_STABILITY_PROMPT_TEMPLATE;"
if "if(typeof this.config.corePrompt!=='string')" not in text:
    text = insert_after_once(text, '            this.config.presetEditorVersion=2;', migration, 'prompt config migration')

if 'corePrompt:typeof this.config.userDefaultPromptSettings.corePrompt' not in text:
    text = text.replace(
        '                const legacySettings={\n                    npcAuditPrompt:',
        "                const legacySettings={\n                    corePrompt:typeof this.config.userDefaultPromptSettings.corePrompt==='string'?this.config.userDefaultPromptSettings.corePrompt:CORE_WORLD_RULES,\n                    macroPrompt:typeof this.config.userDefaultPromptSettings.macroPrompt==='string'?this.config.userDefaultPromptSettings.macroPrompt:DEFAULT_MACRO_PROMPT,\n                    stabilityPromptTemplate:typeof this.config.userDefaultPromptSettings.stabilityPromptTemplate==='string'?this.config.userDefaultPromptSettings.stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,\n                    npcAuditPrompt:",
        1,
    )

if 'this.config.corePrompt=settings.corePrompt??CORE_WORLD_RULES;' not in text:
    text = text.replace(
        '                        const settings=BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings;\n',
        '                        const settings=BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings;\n                        this.config.corePrompt=settings.corePrompt??CORE_WORLD_RULES;\n                        this.config.macroPrompt=settings.macroPrompt??DEFAULT_MACRO_PROMPT;\n                        this.config.stabilityPromptTemplate=settings.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE;\n',
        1,
    )

if "panel?.querySelector('[data-core-prompt]')" not in text:
    text = text.replace(
        '            return {\n                preset,\n',
        "            return {\n                preset,\n                corePrompt:panel?.querySelector('[data-core-prompt]')?.value??this.config.corePrompt??CORE_WORLD_RULES,\n                macroPrompt:panel?.querySelector('[data-macro-prompt]')?.value??this.config.macroPrompt??DEFAULT_MACRO_PROMPT,\n                stabilityPromptTemplate:panel?.querySelector('[data-stability-prompt]')?.value??this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE,\n",
        1,
    )

if "['核心约束',settings.corePrompt]" not in text:
    marker = "            if(!plain(settings)||typeof settings.preset!=='string'||settings.preset.length>30000)throw new Error('预设文档内容无效或超过30000字');"
    addition = "\n            for(const [name,value] of [['核心约束',settings.corePrompt],['宏观骨架提示词',settings.macroPrompt],['世界自救提示词',settings.stabilityPromptTemplate]])if(value!==undefined&&(typeof value!=='string'||value.length>30000))throw new Error(name+'限30000字');"
    text = insert_after_once(text, marker, addition, 'applyPromptSettings validation')

if 'this.config.corePrompt=settings.corePrompt===undefined?CORE_WORLD_RULES:settings.corePrompt;' not in text:
    text = text.replace(
        '            this.config.npcAuditPrompt=settings.npcAuditPrompt;\n            this.config.structurePrompt=settings.structurePrompt;',
        "            this.config.corePrompt=settings.corePrompt===undefined?CORE_WORLD_RULES:settings.corePrompt;\n            this.config.macroPrompt=settings.macroPrompt===undefined?DEFAULT_MACRO_PROMPT:settings.macroPrompt;\n            this.config.stabilityPromptTemplate=settings.stabilityPromptTemplate===undefined?DEFAULT_STABILITY_PROMPT_TEMPLATE:settings.stabilityPromptTemplate;\n            this.config.npcAuditPrompt=settings.npcAuditPrompt===undefined?NPC_BUILD_AUDIT_RULES:settings.npcAuditPrompt;\n            this.config.structurePrompt=settings.structurePrompt===undefined?protocol().split('【Canonical WorldResult JSON Schema】')[0].trim():settings.structurePrompt;",
        1,
    )

if "corePrompt:typeof settings.corePrompt==='string'" not in text:
    text = text.replace(
        '            const normalized={\n                npcAuditPrompt:',
        "            const normalized={\n                corePrompt:typeof settings.corePrompt==='string'?settings.corePrompt:CORE_WORLD_RULES,\n                macroPrompt:typeof settings.macroPrompt==='string'?settings.macroPrompt:DEFAULT_MACRO_PROMPT,\n                stabilityPromptTemplate:typeof settings.stabilityPromptTemplate==='string'?settings.stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,\n                npcAuditPrompt:",
        1,
    )

# Make exported legacy/built-in documents complete even if they were created
# before v19 and do not physically store the newly editable fields yet.
if 'const exportedSettings=Object.assign' not in text:
    old = "            const payload={type:'samsara-world-prompt-document',version:1,name:doc.name,exportedAt:new Date().toISOString(),settings:copy(doc.settings)};"
    new = "            const exportedSettings=Object.assign({corePrompt:CORE_WORLD_RULES,macroPrompt:DEFAULT_MACRO_PROMPT,stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,npcAuditPrompt:NPC_BUILD_AUDIT_RULES,structurePrompt:protocol().split('【Canonical WorldResult JSON Schema】')[0].trim()},copy(doc.settings));\n            const payload={type:'samsara-world-prompt-document',version:2,name:doc.name,exportedAt:new Date().toISOString(),settings:exportedSettings};"
    if old not in text:
        raise SystemExit('export prompt document anchor not found')
    text = text.replace(old, new, 1)

if 'worldStabilityPrompt(state,this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE)' not in text:
    start = text.find('            const stabilityPrompt=worldStabilityPrompt(state);')
    end = text.find('            if(system.length+input.length>240000)', start)
    if start < 0 or end < 0:
        raise SystemExit('actual system prompt composition anchor not found')
    block = """            const stabilityPrompt=worldStabilityPrompt(state,this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE);
            const macroPrompt=macroRequirement?(this.config.macroPrompt??DEFAULT_MACRO_PROMPT):'';
            const corePrompt=this.config.corePrompt??CORE_WORLD_RULES;
            const system=this.config.preset+(corePrompt?'\\n\\n'+corePrompt:'')+(macroPrompt?'\\n\\n'+macroPrompt:'')+(stabilityPrompt?'\\n\\n'+stabilityPrompt:'')+(npcAudit.length?'\\n\\n'+(this.config.npcAuditPrompt??NPC_BUILD_AUDIT_RULES):'')+'\\n\\n【WorldResult 业务输出协议】\\n'+((this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'\\n\\n【Canonical WorldResult JSON Schema】\\n程序实际字段定义（不可由文字说明改变）：\\n'+JSON.stringify(WORLD_RESULT_SCHEMA,null,2));
"""
    text = text[:start] + block + text[end:]

RUNTIME.write_text(text, encoding='utf-8')


# ---------------------------------------------------------------------------
# UI: expose every real textual block in the preset workspace. Conditional
# blocks remain visible while inactive so users can edit them ahead of time.
# ---------------------------------------------------------------------------
text = UI.read_text(encoding='utf-8')

if 'corePrompt:this.config.corePrompt??CORE_WORLD_RULES' not in text:
    text = text.replace(
        '                    preset:this.config.preset,\n                    structurePrompt:this.config.structurePrompt,',
        '                    preset:this.config.preset,\n                    corePrompt:this.config.corePrompt??CORE_WORLD_RULES,\n                    macroPrompt:this.config.macroPrompt??DEFAULT_MACRO_PROMPT,\n                    stabilityPromptTemplate:this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE,\n                    structurePrompt:this.config.structurePrompt,',
        1,
    )

text = text.replace(
    '内置“默认设置”始终跟随代码版本；“保存为个人默认”会另存当前分段、结构说明与资料范围，不会覆盖内置模板',
    '内置“默认设置”始终跟随代码版本；“保存为个人默认”会另存全部可编辑提示词、正文窗口与资料范围，不会覆盖内置模板',
)
text = text.replace(
    '这些分段属于可编辑工作层，可以新增、删除或调整顺序。世界引擎的安全边界与 WorldResult 核心协议仍由程序独立注入，不依赖某个可编辑分段是否存在。',
    '这些分段属于主要工作层，可以新增、删除或调整顺序。核心约束与条件提示词在下方单独编辑，并与同一预设文档一起保存。',
)

if "html+=section('系统提示词'" not in text:
    start = text.find("                html+=section('系统注入',")
    end = text.find("                html+=section('WorldResult 输出协议'", start)
    if start < 0 or end < 0:
        raise SystemExit('system prompt UI section anchors not found')
    section = '''                html+=section('系统提示词','<div class="we-notice">这里展示的文本都会直接参与实际 system 请求，并随预设文档保存、应用、导入和导出。条件提示词只在对应条件成立时发送；只有程序字段 Schema 保持固定。</div>'+\
                    '<details class="we-segment"><summary>世界引擎核心约束 · '+(this.promptEditing?'编辑中':'点击展开')+'</summary><textarea data-core-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.corePrompt??CORE_WORLD_RULES)+'</textarea><p class="we-muted">始终发送。可修改或留空；留空即不额外注入核心约束。</p></details>'+\
                    '<details class="we-segment"><summary>宏观骨架交付 · 条件提示词</summary><textarea data-macro-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.macroPrompt??DEFAULT_MACRO_PROMPT)+'</textarea><p class="we-muted">仅在本轮需要建立/补足宏观骨架时发送。</p></details>'+\
                    '<details class="we-segment"><summary>世界自救 · 条件提示词模板</summary><textarea data-stability-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE)+'</textarea><p class="we-muted">世界稳定值低于100且未开启世界超稳时发送。可使用 {{阶段}}、{{稳定值}}、{{规则}} 占位符。</p></details>'+\
                    '<details class="we-segment"><summary>角色管理 · NPC构筑审计 · '+(this.isNpcBuildAuditEnabled()?'当前启用':'当前关闭')+'</summary><textarea data-npc-audit-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.npcAuditPrompt??NPC_BUILD_AUDIT_RULES)+'</textarea><p class="we-muted">无论开关状态都可编辑并保存；只有开启审计且本轮存在审计对象时才发送。</p></details>','核心与条件提示词均可编辑');
'''
    text = text[:start] + section + text[end:]

text = text.replace(
    '协议说明使用上方编辑开关。保存后用于实际 system 请求；Schema 固定只读，核心约束与条件审计见上方“系统注入”，修改说明不会改变变量结构。',
    '协议说明使用上方编辑开关。保存后用于实际 system 请求；Schema 固定只读，修改任何文字提示词都不会改变程序变量结构。',
)

UI.write_text(text, encoding='utf-8')


# ---------------------------------------------------------------------------
# Keep tests whose only coupling is built-in prompt version/signature aligned.
# ---------------------------------------------------------------------------
for rel in [
    'tests/world-engine-superstable-prompt.cjs',
    'tests/world-engine-prompt-pipeline.cjs',
    'tests/world-engine-scene-context.cjs',
    'tests/world-engine-asset-multi-owner.cjs',
    'tests/world-engine-asset-writeback.cjs',
]:
    path = ROOT / rel
    t = path.read_text(encoding='utf-8')
    t = t.replace('version:18', 'version:19').replace('version 18', 'version 19').replace('v18', 'v19')
    t = t.replace('built-in prompt version should be 18', 'built-in prompt version should be 19')
    path.write_text(t, encoding='utf-8')

# world-engine-superstable-prompt executes the prompt helper in isolation; add
# the editable template constant to that isolated VM snippet and accept the new
# optional parameter signature.
path = ROOT / 'tests' / 'world-engine-superstable-prompt.cjs'
t = path.read_text(encoding='utf-8')
if 'templateMatch' not in t:
    t = t.replace(
        "const stageMatch=prompt.match(/const WORLD_STABILITY_DEFENSE_STAGES = \\[[\\s\\S]*?\\n    \\];/);\nconst fnMatch=prompt.match(/function worldStabilityPrompt\\(stat\\) \\{[\\s\\S]*?\\n    \\}/);\nassert(stageMatch&&fnMatch,'stability prompt source missing');\nconst context={};\nvm.runInNewContext(`${stageMatch[0]}\\n${fnMatch[0]}\\nthis.worldStabilityPrompt=worldStabilityPrompt;`,context);",
        "const templateMatch=prompt.match(/const DEFAULT_STABILITY_PROMPT_TEMPLATE = `[\\s\\S]*?`;/);\nconst stageMatch=prompt.match(/const WORLD_STABILITY_DEFENSE_STAGES = \\[[\\s\\S]*?\\n    \\];/);\nconst fnMatch=prompt.match(/function worldStabilityPrompt\\(stat, template=DEFAULT_STABILITY_PROMPT_TEMPLATE\\) \\{[\\s\\S]*?\\n    \\}/);\nassert(templateMatch&&stageMatch&&fnMatch,'stability prompt source missing');\nconst context={};\nvm.runInNewContext(`${templateMatch[0]}\\n${stageMatch[0]}\\n${fnMatch[0]}\\nthis.worldStabilityPrompt=worldStabilityPrompt;`,context);",
        1,
    )
path.write_text(t, encoding='utf-8')

# Prompt-pipeline audit used the old direct adjacency of CORE to a later
# function. Capture the constant itself instead, independent of declaration
# layout.
path = ROOT / 'tests' / 'world-engine-prompt-pipeline.cjs'
t = path.read_text(encoding='utf-8')
t = t.replace(
    "const core = capture(/const CORE_WORLD_RULES = `([\\s\\S]*?)`;?\\n    function splitPresetSegments/, 'CORE_WORLD_RULES');",
    "const core = capture(/const CORE_WORLD_RULES = `([\\s\\S]*?)`;/, 'CORE_WORLD_RULES');",
)
path.write_text(t, encoding='utf-8')

path = ROOT / 'tests' / 'world-engine-request-transparency.cjs'
t = path.read_text(encoding='utf-8')
t = t.replace(
    "assert.match(request.system,/【世界引擎核心约束】/,'core constraints remain mandatory');",
    "assert.match(request.system,/【世界引擎核心约束】/,'built-in defaults still send core constraints until the user edits them');",
)
t = t.replace(
    "assert.match(uiSource,/固定系统注入/,'prompt workspace must expose mandatory injected blocks');\n  assert.match(uiSource,/CORE_WORLD_RULES/,'prompt workspace shows core constraints from the real source constant');",
    "assert.match(uiSource,/系统提示词/,'prompt workspace must expose actual system prompt blocks');\n  assert.match(uiSource,/data-core-prompt/,'prompt workspace must allow editing core constraints');",
)
path.write_text(t, encoding='utf-8')

print('editable world system prompts synchronized')
