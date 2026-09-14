from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / 'tests' / 'world-engine-superstable-prompt.cjs',
    ROOT / 'tests' / 'world-engine-prompt-pipeline.cjs',
    ROOT / 'tests' / 'world-engine-scene-context.cjs',
    ROOT / 'tests' / 'world-engine-asset-multi-owner.cjs',
    ROOT / 'tests' / 'world-engine-asset-writeback.cjs',
]

changed = []
for path in FILES:
    text = path.read_text(encoding='utf-8')
    next_text = text.replace('version:17', 'version:18').replace('version 17', 'version 18').replace('v17', 'v18')
    if path.name == 'world-engine-prompt-pipeline.cjs':
        next_text = next_text.replace('built-in prompt version should be 11', 'built-in prompt version should be 18')
    if next_text != text:
        path.write_text(next_text, encoding='utf-8')
        changed.append(path.name)

print('migrated prompt v18 assertions: ' + (', '.join(changed) if changed else 'already synchronized'))
