from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FOUNDATION = ROOT / 'script' / 'world-engine-src' / '00-foundation-prompt.part.js'
RUNTIME = ROOT / 'script' / 'world-engine-src' / '40-engine-runtime.part.js'
UI = ROOT / 'script' / 'world-engine-src' / '50-engine-ui.part.js'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    return text.replace(old, new, 1)


# 1) Foundation: promote every textual system block to a named default that prompt documents can own.
text = FOUNDATION.read_text(encoding='utf-8')
if 'function defaultCoreWorldRules()' not in text:
    m = re.search(r"    const CORE_WORLD_RULES = `([\s\S]*?)`;\n    const WORLD_STABILITY_DEFENSE_STAGES", text)
    if not m:
        raise SystemExit('CORE_WORLD_RULES block not found')
    core_body = m.group(1)
    replacement = (
        "    function defaultCoreWorldRules() {\n"
        f"        return `{core_body}`;\n"
        "    }\n"
        "    const CORE_WORLD_RULES = defaultCoreWorldRules();\n"
        "    function defaultMacroPrompt() {\n"
        "        return `【本轮宏观骨架交付】\n先完成输入“本轮必须完成的宏观骨架”，再推演近期细节。至少3个可推进宏观节点是合并后的交付底线，进行中+待发生合计。未来规划可以跨越下一宏观边界，实际发生与细节推进不能越界；只输出差分不意味着可以省略尚未建立的骨架。提交前检查事件实体、分类、状态、时间、前因与因果.宏观顺序相互对应。`;\n"
        "    }\n"
        "    const DEFAULT_MACRO_PROMPT = defaultMacroPrompt();\n"
        "    function defaultStabilityPromptTemplate() {\n"
        "        return `【世界自救 · {{阶段}}】\n当前稳定值：{{稳定值}}。{{规则}}\n排异必须借世界观内合理载体发生，优先针对造成异常的轮回者及其据点、关系网、资源与行动路径；NPC仍只能依据自身认知和传播链行动，不得凭空全知。法则越破不代表主动排异越弱。`;\n"
        "    }\n"
        "    const DEFAULT_STABILITY_PROMPT_TEMPLATE = defaultStabilityPromptTemplate();\n"
        "    const WORLD_STABILITY_DEFENSE_STAGES"
    )
    text = text[:m.start()] + replacement + text[m.end():]

text = replace_once(
    text,
    "        version:18,\n        builtin:true,",
    "        version:19,\n        builtin:true,",
    'built-in prompt version'
)
text = replace_once(
    text,
    "        exportedAt:'2026-09-14T12:30:00.000Z',",
    "        exportedAt:'2026-09-14T13:00:00.000Z',",
    'built-in prompt exportedAt'
)
text = replace_once(
    text,
    "        updatedAt:'2026-09-14T12:30:00.000Z',",
    "        updatedAt:'2026-09-14T13:00:00.000Z',",
    'built-in prompt updatedAt'
)
text = replace_once(
    text,
    "            // 直接引用当前 DEFAULT_PRESET，避免以后修改默认提示词却忘记同步“默认设置”文档。\n            preset:normalizeEditablePreset(DEFAULT_PRESET),",
    "            // 内置文档直接引用当前代码默认值，避免新增关键提示词后预设面板仍看不到。\n            corePrompt:defaultCoreWorldRules(),\n            macroPrompt:defaultMacroPrompt(),\n            stabilityPromptTemplate:defaultStabilityPromptTemplate(),\n            preset:normalizeEditablePreset(DEFAULT_PRESET),",
    'built-in prompt settings'
)
old_stability = """    function worldStabilityPrompt(stat) {
        if(stat?.设置?.世界超稳===true)return '';
        const raw=Number(stat?.世界?.稳定),stable=Number.isFinite(raw)?Math.max(0,Math.min(120,raw)):100;
        if(stable>=100)return '';
        const stage=WORLD_STABILITY_DEFENSE_STAGES.find(item=>stable>=item.min)||WORLD_STABILITY_DEFENSE_STAGES.at(-1);
        return `【世界自救 · ${stage.title}】\n当前稳定值：${stable}。${stage.rule}\n排异必须借世界观内合理载体发生，优先针对造成异常的轮回者及其据点、关系网、资源与行动路径；NPC仍只能依据自身认知和传播链行动，不得凭空全知。法则越破不代表主动排异越弱。`;
    }"""
new_stability = """    function worldStabilityPrompt(stat, template=DEFAULT_STABILITY_PROMPT_TEMPLATE) {
        if(stat?.设置?.世界超稳===true)return '';
        const raw=Number(stat?.世界?.稳定),stable=Number.isFinite(raw)?Math.max(0,Math.min(120,raw)):100;
        if(stable>=100)return '';
        const stage=WORLD_STABILITY_DEFENSE_STAGES.find(item=>stable>=item.min)||WORLD_STABILITY_DEFENSE_STAGES.at(-1);
        const source=String(template??DEFAULT_STABILITY_PROMPT_TEMPLATE);
        if(!source.trim())return '';
        return source.split('{{阶段}}').join(stage.title).split('{{稳定值}}').join(String(stable)).split('{{规则}}').join(stage.rule);
    }"""
text = replace_once(text, old_stability, new_stability, 'worldStabilityPrompt')
FOUNDATION.write_text(text, encoding='utf-8')


# 2) Runtime: persist these fields in settings/documents and use them in the actual request.
text = RUNTIME.read_text(encoding='utf-8')
text = replace_once(
    text,
    "                preset:DEFAULT_PRESET,\n                retryAttempts:5,",
    "                preset:DEFAULT_PRESET,\n                corePrompt:CORE_WORLD_RULES,\n                macroPrompt:DEFAULT_MACRO_PROMPT,\n                stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,\n                retryAttempts:5,",
    'runtime default prompt config'
)
text = replace_once(
    text,
    "            this.config.presetEditorVersion=2;\n            if(!Array.isArray(this.config.promptDocuments))this.config.promptDocuments=[];",
    "            this.config.presetEditorVersion=2;\n            if(typeof this.config.corePrompt!=='string')this.config.corePrompt=CORE_WORLD_RULES;\n            if(typeof this.config.macroPrompt!=='string')this.config.macroPrompt=DEFAULT_MACRO_PROMPT;\n            if(typeof this.config.stabilityPromptTemplate!=='string')this.config.stabilityPromptTemplate=DEFAULT_STABILITY_PROMPT_TEMPLATE;\n            if(!Array.isArray(this.config.promptDocuments))this.config.promptDocuments=[];",
    'runtime prompt config migration'
)
text = replace_once(
    text,
    "                const legacySettings={\n                    npcAuditPrompt:typeof this.config.userDefaultPromptSettings.npcAuditPrompt==='string'?this.config.userDefaultPromptSettings.npcAuditPrompt:undefined,",
    "                const legacySettings={\n                    corePrompt:typeof this.config.userDefaultPromptSettings.corePrompt==='string'?this.config.userDefaultPromptSettings.corePrompt:CORE_WORLD_RULES,\n                    macroPrompt:typeof this.config.userDefaultPromptSettings.macroPrompt==='string'?this.config.userDefaultPromptSettings.macroPrompt:DEFAULT_MACRO_PROMPT,\n                    stabilityPromptTemplate:typeof this.config.userDefaultPromptSettings.stabilityPromptTemplate==='string'?this.config.userDefaultPromptSettings.stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,\n                    npcAuditPrompt:typeof this.config.userDefaultPromptSettings.npcAuditPrompt==='string'?this.config.userDefaultPromptSettings.npcAuditPrompt:undefined,",
    'legacy prompt document migration'
)
text = replace_once(
    text,
    "                        const settings=BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings;\n                        this.config.npcAuditPrompt=settings.npcAuditPrompt;\n            this.config.structurePrompt=settings.structurePrompt;",
    "                        const settings=BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings;\n                        this.config.corePrompt=settings.corePrompt??CORE_WORLD_RULES;\n                        this.config.macroPrompt=settings.macroPrompt??DEFAULT_MACRO_PROMPT;\n                        this.config.stabilityPromptTemplate=settings.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE;\n                        this.config.npcAuditPrompt=settings.npcAuditPrompt;\n                        this.config.structurePrompt=settings.structurePrompt;",
    'built-in prompt apply migration'
)
text = replace_once(
    text,
    "            return {\n                preset,\n                npcAuditPrompt:panel?.querySelector('[data-npc-audit-prompt]')?.value??this.config.npcAuditPrompt,",
    "            return {\n                preset,\n                corePrompt:panel?.querySelector('[data-core-prompt]')?.value??this.config.corePrompt??CORE_WORLD_RULES,\n                macroPrompt:panel?.querySelector('[data-macro-prompt]')?.value??this.config.macroPrompt??DEFAULT_MACRO_PROMPT,\n                stabilityPromptTemplate:panel?.querySelector('[data-stability-prompt]')?.value??this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE,\n                npcAuditPrompt:panel?.querySelector('[data-npc-audit-prompt]')?.value??this.config.npcAuditPrompt,",
    'readPromptEditor system prompts'
)
text = replace_once(
    text,
    "            if(!plain(settings)||typeof settings.preset!=='string'||settings.preset.length>30000)throw new Error('预设文档内容无效或超过30000字');\n            if(settings.npcAuditPrompt!==undefined&&(typeof settings.npcAuditPrompt!=='string'||settings.npcAuditPrompt.length>30000))throw new Error('NPC审计提示词限30000字');",
    "            if(!plain(settings)||typeof settings.preset!=='string'||settings.preset.length>30000)throw new Error('预设文档内容无效或超过30000字');\n            for(const [name,value] of [['核心约束',settings.corePrompt],['宏观骨架提示词',settings.macroPrompt],['世界自救提示词',settings.stabilityPromptTemplate]])if(value!==undefined&&(typeof value!=='string'||value.length>30000))throw new Error(name+'限30000字');\n            if(settings.npcAuditPrompt!==undefined&&(typeof settings.npcAuditPrompt!=='string'||settings.npcAuditPrompt.length>30000))throw new Error('NPC审计提示词限30000字');",
    'applyPromptSettings validation'
)
text = replace_once(
    text,
    "            this.config.npcAuditPrompt=settings.npcAuditPrompt;\n            this.config.structurePrompt=settings.structurePrompt;",
    "            this.config.corePrompt=settings.corePrompt===undefined?CORE_WORLD_RULES:settings.corePrompt;\n            this.config.macroPrompt=settings.macroPrompt===undefined?DEFAULT_MACRO_PROMPT:settings.macroPrompt;\n            this.config.stabilityPromptTemplate=settings.stabilityPromptTemplate===undefined?DEFAULT_STABILITY_PROMPT_TEMPLATE:settings.stabilityPromptTemplate;\n            this.config.npcAuditPrompt=settings.npcAuditPrompt;\n            this.config.structurePrompt=settings.structurePrompt;",
    'applyPromptSettings assignments'
)
text = replace_once(
    text,
    "            const normalized={\n                npcAuditPrompt:typeof settings.npcAuditPrompt==='string'?settings.npcAuditPrompt:undefined,",
    "            const normalized={\n                corePrompt:typeof settings.corePrompt==='string'?settings.corePrompt:CORE_WORLD_RULES,\n                macroPrompt:typeof settings.macroPrompt==='string'?settings.macroPrompt:DEFAULT_MACRO_PROMPT,\n                stabilityPromptTemplate:typeof settings.stabilityPromptTemplate==='string'?settings.stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,\n                npcAuditPrompt:typeof settings.npcAuditPrompt==='string'?settings.npcAuditPrompt:undefined,",
    'importPromptDocument prompt fields'
)
old_request = """            const stabilityPrompt=worldStabilityPrompt(state);
            const macroPrompt=macroRequirement?'\n\n【本轮宏观骨架交付】\n先完成输入“本轮必须完成的宏观骨架”，再推演近期细节。至少3个可推进宏观节点是合并后的交付底线，进行中+待发生合计。未来规划可以跨越下一宏观边界，实际发生与细节推进不能越界；只输出差分不意味着可以省略尚未建立的骨架。提交前检查事件实体、分类、状态、时间、前因与因果.宏观顺序相互对应。':'';
            const system=this.config.preset+'\n\n'+CORE_WORLD_RULES+macroPrompt+(stabilityPrompt?'\n\n'+stabilityPrompt:'')+(npcAudit.length?'\n\n'+(this.config.npcAuditPrompt??NPC_BUILD_AUDIT_RULES):'')+'\n\n【WorldResult 业务输出协议】\n'+((this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'\n\n【Canonical WorldResult JSON Schema】\n程序实际字段定义（不可由文字说明改变）：\n'+JSON.stringify(WORLD_RESULT_SCHEMA,null,2));"""
new_request = """            const stabilityPrompt=worldStabilityPrompt(state,this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE);
            const macroPrompt=macroRequirement?(this.config.macroPrompt??DEFAULT_MACRO_PROMPT):'';
            const corePrompt=this.config.corePrompt??CORE_WORLD_RULES;
            const system=this.config.preset+(corePrompt?'\n\n'+corePrompt:'')+(macroPrompt?'\n\n'+macroPrompt:'')+(stabilityPrompt?'\n\n'+stabilityPrompt:'')+(npcAudit.length?'\n\n'+(this.config.npcAuditPrompt??NPC_BUILD_AUDIT_RULES):'')+'\n\n【WorldResult 业务输出协议】\n'+((this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'\n\n【Canonical WorldResult JSON Schema】\n程序实际字段定义（不可由文字说明改变）：\n'+JSON.stringify(WORLD_RESULT_SCHEMA,null,2));"""
text = replace_once(text, old_request, new_request, 'actual system prompt composition')
RUNTIME.write_text(text, encoding='utf-8')


# 3) UI: make the real request blocks visible/editable, even when a conditional block is currently inactive.
text = UI.read_text(encoding='utf-8')
text = replace_once(
    text,
    "                    preset:this.config.preset,\n                    structurePrompt:this.config.structurePrompt,",
    "                    preset:this.config.preset,\n                    corePrompt:this.config.corePrompt??CORE_WORLD_RULES,\n                    macroPrompt:this.config.macroPrompt??DEFAULT_MACRO_PROMPT,\n                    stabilityPromptTemplate:this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE,\n                    structurePrompt:this.config.structurePrompt,",
    'promptView system prompts'
)
text = text.replace(
    '内置“默认设置”始终跟随代码版本；“保存为个人默认”会另存当前分段、结构说明与资料范围，不会覆盖内置模板',
    '内置“默认设置”始终跟随代码版本；“保存为个人默认”会另存全部可编辑提示词、正文窗口与资料范围，不会覆盖内置模板'
)
text = text.replace(
    '这些分段属于可编辑工作层，可以新增、删除或调整顺序。世界引擎的安全边界与 WorldResult 核心协议仍由程序独立注入，不依赖某个可编辑分段是否存在。',
    '这些分段属于主要工作层，可以新增、删除或调整顺序。核心约束与条件提示词在下方单独编辑，并与同一预设文档一起保存。'
)
start = text.find("                html+=section('系统注入',")
end = text.find("                html+=section('WorldResult 输出协议'", start)
if start < 0 or end < 0:
    if "html+=section('系统提示词'" not in text:
        raise SystemExit('system prompt UI section anchors not found')
else:
    replacement = """                html+=section('系统提示词','<div class="we-notice">这里展示的文本都会直接参与实际 system 请求，并随预设文档保存、应用、导入和导出。条件提示词只在对应条件成立时发送；只有程序字段 Schema 保持固定。</div>'+
                    '<details class="we-segment"><summary>世界引擎核心约束 · '+(this.promptEditing?'编辑中':'点击展开')+'</summary><textarea data-core-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.corePrompt??CORE_WORLD_RULES)+'</textarea><p class="we-muted">始终发送。可修改或留空；留空即不额外注入核心约束。</p></details>'+
                    '<details class="we-segment"><summary>宏观骨架交付 · 条件提示词</summary><textarea data-macro-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.macroPrompt??DEFAULT_MACRO_PROMPT)+'</textarea><p class="we-muted">仅在本轮需要建立/补足宏观骨架时发送。</p></details>'+
                    '<details class="we-segment"><summary>世界自救 · 条件提示词模板</summary><textarea data-stability-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE)+'</textarea><p class="we-muted">世界稳定值低于100且未开启世界超稳时发送。可使用 {{阶段}}、{{稳定值}}、{{规则}} 占位符。</p></details>'+
                    '<details class="we-segment"><summary>角色管理 · NPC构筑审计 · '+(this.isNpcBuildAuditEnabled()?'当前启用':'当前关闭')+'</summary><textarea data-npc-audit-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.npcAuditPrompt??NPC_BUILD_AUDIT_RULES)+'</textarea><p class="we-muted">无论开关状态都可编辑并保存；只有开启审计且本轮存在审计对象时才发送。</p></details>','核心与条件提示词均可编辑');
"""
    text = text[:start] + replacement + text[end:]
text = text.replace(
    '协议说明使用上方编辑开关。保存后用于实际 system 请求；Schema 固定只读，核心约束与条件审计见上方“系统注入”，修改说明不会改变变量结构。',
    '协议说明使用上方编辑开关。保存后用于实际 system 请求；Schema 固定只读，修改任何文字提示词都不会改变程序变量结构。'
)
UI.write_text(text, encoding='utf-8')


# 4) Version-only expectations that intentionally track the built-in prompt document.
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
    if path.name == 'world-engine-prompt-pipeline.cjs':
        t = t.replace('built-in prompt version should be 18', 'built-in prompt version should be 19')
    path.write_text(t, encoding='utf-8')

# Keep request-transparency documentation/tests aligned with the new ownership model.
path = ROOT / 'tests' / 'world-engine-request-transparency.cjs'
t = path.read_text(encoding='utf-8')
t = t.replace("assert.match(request.system,/【世界引擎核心约束】/,'core constraints remain mandatory');", "assert.match(request.system,/【世界引擎核心约束】/,'built-in defaults still send core constraints until the user edits them');")
t = t.replace("assert.match(uiSource,/固定系统注入/,'prompt workspace must expose mandatory injected blocks');\n  assert.match(uiSource,/CORE_WORLD_RULES/,'prompt workspace shows core constraints from the real source constant');", "assert.match(uiSource,/系统提示词/,'prompt workspace must expose actual system prompt blocks');\n  assert.match(uiSource,/data-core-prompt/,'prompt workspace must allow editing core constraints');")
path.write_text(t, encoding='utf-8')

print('editable world system prompts synchronized')
