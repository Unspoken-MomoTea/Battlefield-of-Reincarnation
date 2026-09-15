from pathlib import Path

path = Path('script/悬浮球状态栏.js')
data = path.read_bytes()
old = "        html += renderTopbar(world, sys, editMode, sd);".encode('utf-8')
new = "        html += renderTopbar(world, sys, editMode, statData);".encode('utf-8')

if old not in data:
    if new in data:
        print('statusbar settlement state reference already fixed')
        raise SystemExit(0)
    raise SystemExit('expected renderAll topbar call not found')

if data.count(old) != 1:
    raise SystemExit(f'expected exactly one buggy renderAll call, found {data.count(old)}')

path.write_bytes(data.replace(old, new, 1))
print('patched renderAll to pass statData into renderTopbar without changing line endings')
