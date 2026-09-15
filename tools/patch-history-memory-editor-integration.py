from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def replace_once(path,old,new):
    p=ROOT/path
    text=p.read_text(encoding='utf-8')
    if new in text:
        print(f'already integrated: {path}')
        return
    if old not in text:
        raise SystemExit(f'anchor not found: {path}')
    p.write_text(text.replace(old,new,1),encoding='utf-8')
    print(f'integrated: {path}')

replace_once(
    'tests/world-engine-modules.cjs',
    "  '59-history-memory.part.js',\n  '60-bootstrap.part.js',",
    "  '59-history-memory.part.js',\n  '59-history-memory-editor.part.js',\n  '60-bootstrap.part.js',"
)
replace_once(
    'tests/world-engine-modules.cjs',
    "assert.match(texts['59-history-memory.part.js'], /projectWorldHistoryMemory/);\nassert.match(texts['60-bootstrap.part.js']",
    "assert.match(texts['59-history-memory.part.js'], /projectWorldHistoryMemory/);\nassert.match(texts['59-history-memory-editor.part.js'], /^    \\/\\/ 历史记忆手动维护/);\nassert.match(texts['59-history-memory-editor.part.js'], /setHistoryAnchorRecord/);\nassert.match(texts['59-history-memory-editor.part.js'], /setHistorySummaryRecord/);\nassert.match(texts['60-bootstrap.part.js']"
)
for workflow in ['.github/workflows/task-awareness-build.yml','.github/workflows/task-awareness-check.yml']:
    replace_once(
        workflow,
        "      - name: History memory safety regression\n        run: node tests/world-engine-history-memory-safety.cjs\n",
        "      - name: History memory safety regression\n        run: node tests/world-engine-history-memory-safety.cjs\n      - name: History memory editor regression\n        run: node tests/world-engine-history-memory-editor.cjs\n"
    )
