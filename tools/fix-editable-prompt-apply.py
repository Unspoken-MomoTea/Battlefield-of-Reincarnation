from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'script' / 'world-engine-src' / '40-engine-runtime.part.js'
text = path.read_text(encoding='utf-8')
start = text.find('        applyPromptSettings(settings) {')
end = text.find('        getPromptDocuments()', start)
if start < 0 or end < 0:
    raise SystemExit('applyPromptSettings block not found')
block = text[start:end]
old = "            this.config.npcAuditPrompt=settings.npcAuditPrompt;\n            this.config.structurePrompt=settings.structurePrompt;"
new = "            this.config.corePrompt=settings.corePrompt===undefined?CORE_WORLD_RULES:settings.corePrompt;\n            this.config.macroPrompt=settings.macroPrompt===undefined?DEFAULT_MACRO_PROMPT:settings.macroPrompt;\n            this.config.stabilityPromptTemplate=settings.stabilityPromptTemplate===undefined?DEFAULT_STABILITY_PROMPT_TEMPLATE:settings.stabilityPromptTemplate;\n            this.config.npcAuditPrompt=settings.npcAuditPrompt===undefined?NPC_BUILD_AUDIT_RULES:settings.npcAuditPrompt;\n            this.config.structurePrompt=settings.structurePrompt===undefined?protocol().split('【Canonical WorldResult JSON Schema】')[0].trim():settings.structurePrompt;"
if new not in block:
    if old not in block:
        raise SystemExit('prompt assignment anchor not found inside applyPromptSettings')
    block = block.replace(old, new, 1)
    text = text[:start] + block + text[end:]
    path.write_text(text, encoding='utf-8')
    print('patched applyPromptSettings system prompt assignments')
else:
    print('applyPromptSettings system prompt assignments already synchronized')
