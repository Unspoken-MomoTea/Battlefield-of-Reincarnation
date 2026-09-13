from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'tests' / 'task-settlement-simplified.cjs'
text = path.read_text(encoding='utf-8')
old = "assert.match(prompt, /success: status === '可结算'/);"
new = "assert.match(prompt, /success: SETTLEMENT_SUCCESS_STATUSES\\.has\\(status\\)/);\nassert.match(prompt, /failed: SETTLEMENT_FAILURE_STATUSES\\.has\\(status\\)/);"
if new not in text:
    if text.count(old) != 1:
        raise SystemExit(f'expected one legacy settlement status assertion, found {text.count(old)}')
    text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')
