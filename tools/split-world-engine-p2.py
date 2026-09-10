from pathlib import Path

root = Path(__file__).resolve().parents[1]
delivery = root / 'script' / '世界推进系统.js'
source_dir = root / 'script' / 'world-engine-src'
text = delivery.read_text(encoding='utf-8')

markers = [
    ('10-world-state.part.js', '    const RECORDS = {'),
    ('20-world-result.part.js', "    const CURRENCY_FIELDS={体系:'',购买力基准:'',经济波动:''};"),
    ('30-context-protocol.part.js', '    function activation(entry, scan, force) {'),
    ('40-engine-runtime.part.js', '    class SamsaraWorldEngine {'),
    ('50-engine-ui.part.js', '        createPanel() {'),
    ('60-bootstrap.part.js', '    // CommonJS 入口仅供离线测试，浏览器脚本不依赖打包器。'),
]

positions = []
for name, marker in markers:
    count = text.count(marker)
    if count != 1:
        raise SystemExit(f'{name}: expected one boundary marker, got {count}: {marker}')
    positions.append(text.index(marker))
if positions != sorted(positions):
    raise SystemExit('world-engine source boundaries are out of order')

names = ['00-foundation-prompt.part.js'] + [name for name, _ in markers]
bounds = [0] + positions + [len(text)]
source_dir.mkdir(parents=True, exist_ok=True)
for index, name in enumerate(names):
    part = text[bounds[index]:bounds[index + 1]]
    if not part:
        raise SystemExit(f'empty source part: {name}')
    (source_dir / name).write_text(part, encoding='utf-8')
    print(f'{name}: {part.count(chr(10)) + 1} lines, {len(part)} chars')

rebuilt = ''.join((source_dir / name).read_text(encoding='utf-8') for name in names)
if rebuilt != text:
    raise SystemExit('split parts do not reconstruct script/世界推进系统.js exactly')
print(f'split verified: {len(names)} parts reconstruct {len(text)} chars exactly')
