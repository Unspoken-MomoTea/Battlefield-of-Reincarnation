from pathlib import Path

path = Path('script/世界推进系统.js')
lines = path.read_text(encoding='utf-8').splitlines()
needles = [
    'lastRequest', 'previewRequest', 'resetInspection', 'lastRetryLog', 'lastAttemptCount',
    '请求检查', '副 API 原始回复', 'lastWorldResult', 'structured', 'json_schema',
    'readWorldbook', 'worldbook', 'contextTurns', 'lastFailure'
]
seen = set()
for needle in needles:
    print(f'\n===== {needle} =====')
    hits = [i for i, line in enumerate(lines) if needle in line]
    for i in hits[:10]:
        start=max(0,i-5); end=min(len(lines),i+10)
        key=(start,end)
        if key in seen: continue
        seen.add(key)
        print(f'--- lines {start+1}-{end} ---')
        for n in range(start,end):
            print(f'{n+1}: {lines[n]}')
