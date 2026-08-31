from pathlib import Path
import re

files = [Path('Regular/主神任务美化.html'), Path('Regular/试炼任务美化.html')]
pattern = re.compile(
    r"(?P<i>\s*)const stat = data\.stat_data \|\| data;\n"
    r"(?P=i)if \(!stat \|\| typeof stat !== 'object'\) continue;\n"
    r"(?P=i)const taskRoot = stat\.任务 && typeof stat\.任务 === 'object' \? stat\.任务 : \{\};\n"
    r"(?P=i)return \{"
)
for path in files:
    raw = path.read_bytes()
    crlf = b'\r\n' in raw
    text = raw.decode('utf-8').replace('\r\n', '\n')
    def repl(m):
        i = m.group('i')
        return (
            f"{i}const stat = data.stat_data || data;\n"
            f"{i}if (!stat || typeof stat !== 'object') continue;\n"
            f"{i}if (!stat.任务 || typeof stat.任务 !== 'object') continue;\n"
            f"{i}const taskRoot = stat.任务;\n"
            f"{i}return {{"
        )
    text2, count = pattern.subn(repl, text, count=1)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 semantic match, got {count}')
    if crlf:
        text2 = text2.replace('\n', '\r\n')
    path.write_bytes(text2.encode('utf-8'))
