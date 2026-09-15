from pathlib import Path

path = Path('script/悬浮球状态栏.js')
source = path.read_text(encoding='utf-8')
old = "        html += renderTopbar(world, sys, editMode, sd);"
new = "        html += renderTopbar(world, sys, editMode, statData);"

if old not in source:
    if new in source:
        print('statusbar settlement state reference already fixed')
        raise SystemExit(0)
    raise SystemExit('expected renderAll topbar call not found')

if source.count(old) != 1:
    raise SystemExit(f'expected exactly one buggy renderAll call, found {source.count(old)}')

path.write_text(source.replace(old, new, 1), encoding='utf-8')
print('patched renderAll to pass statData into renderTopbar')
