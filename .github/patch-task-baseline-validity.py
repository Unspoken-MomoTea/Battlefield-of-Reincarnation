from pathlib import Path

files = [Path('Regular/主神任务美化.html'), Path('Regular/试炼任务美化.html')]
old = """                  const stat = data.stat_data || data;
                  if (!stat || typeof stat !== 'object') continue;
                  const taskRoot = stat.任务 && typeof stat.任务 === 'object' ? stat.任务 : {};
                  return {
"""
new = """                  const stat = data.stat_data || data;
                  if (!stat || typeof stat !== 'object') continue;
                  if (!stat.任务 || typeof stat.任务 !== 'object') continue;
                  const taskRoot = stat.任务;
                  return {
"""
for path in files:
    raw = path.read_bytes()
    crlf = b'\r\n' in raw
    text = raw.decode('utf-8').replace('\r\n', '\n')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 match, got {count}')
    text = text.replace(old, new, 1)
    if crlf:
        text = text.replace('\n', '\r\n')
    path.write_bytes(text.encode('utf-8'))
