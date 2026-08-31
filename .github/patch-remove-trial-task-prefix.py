from pathlib import Path

path = Path('Regular/试炼任务美化.html')
raw = path.read_bytes()
crlf = b'\r\n' in raw
text = raw.decode('utf-8').replace('\r\n', '\n')
old = """            const safeName = String(task.name || '位格跃迁').replace(/[.。]/g,'·');
            const taskPath = ['stat_data','任务','列表','【晋升试炼·'+(index+1)+'】'+safeName];
"""
new = """            // 数据库键直接使用任务原名；试炼身份只由 委托方=晋升试炼 判定。
            // 不再把【晋升试炼·N】塞进任务名，列表展示与数据库保持干净。
            const safeName = String(task.name || ('位格跃迁·' + (index + 1))).replace(/[.。]/g,'·').trim();
            const taskPath = ['stat_data','任务','列表',safeName];
"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected 1 task-key match, got {count}')
text = text.replace(old, new, 1)
if crlf:
    text = text.replace('\n', '\r\n')
path.write_bytes(text.encode('utf-8'))

check = path.read_bytes().decode('utf-8')
if "['stat_data','任务','列表','【晋升试炼·'" in check:
    raise SystemExit('legacy prefixed task key still exists')
if "const taskPath = ['stat_data','任务','列表',safeName];" not in check:
    raise SystemExit('new clean task key missing')
