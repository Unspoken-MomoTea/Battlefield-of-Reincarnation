from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SOURCE_FILES = [
    ROOT / 'script' / 'world-engine-src' / '40-engine-runtime.part.js',
    ROOT / 'script' / 'world-engine-src' / '56-rumor-liveliness.part.js',
    ROOT / 'script' / 'world-engine-src' / '57-task-awareness.part.js',
    ROOT / 'script' / 'world-engine-src' / '58-chronology-guard.part.js',
    ROOT / 'script' / 'world-engine-src' / '59-soft-maintenance.part.js',
]
TEST_FILE = ROOT / 'tests' / 'world-engine-observability.cjs'
DOC_FILE = ROOT / 'docs' / '世界引擎V2审计.md'


def remove_request_cap(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    lines = text.splitlines(keepends=True)
    matches = [
        index for index, line in enumerate(lines)
        if '>240000' in line and '请求超过内部安全上限' in line
    ]
    if not matches:
        print(f'[request-size-cap] already removed: {path.relative_to(ROOT)}')
        return False
    if len(matches) != 1:
        raise RuntimeError(
            f'{path.relative_to(ROOT)}: expected exactly one request-size cap, found {len(matches)}'
        )
    del lines[matches[0]]
    path.write_text(''.join(lines), encoding='utf-8')
    print(f'[request-size-cap] removed: {path.relative_to(ROOT)}')
    return True


def replace_once(path: Path, old: str, new: str, label: str) -> bool:
    text = path.read_text(encoding='utf-8')
    if new in text:
        print(f'[request-size-cap] already patched: {label}')
        return False
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one anchor, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'[request-size-cap] patched: {label}')
    return True


def patch_regression() -> None:
    old = "assert.match(source, /请求超过内部安全上限（'\\+formatTokenCount/, 'oversize error must be token-facing even if internal safety remains character based');\nassert.match(source, /system\\.length\\+input\\.length>240000/, 'existing internal safety ceiling must remain unchanged in P1-C');"
    new = "assert.doesNotMatch(source, /请求超过内部安全上限/, 'world engine must not reject requests by a local size ceiling');\nassert.doesNotMatch(source, /(?:system|request\\.system)\\.length\\+(?:input|request\\.input)\\.length>240000/, 'request size is left to the selected provider/model instead of a local hard cap');"
    replace_once(TEST_FILE, old, new, 'observability request-size regression')


def patch_docs() -> None:
    old = '- `tests/world-engine-observability.cjs` 固定验证 tk 格式、估算/实际 usage 区分、专属 API 结构化降级观测、内存清理及原有 24 万字符内部安全上限不变。'
    new = '- `tests/world-engine-observability.cjs` 固定验证 tk 格式、估算/实际 usage 区分、专属 API 结构化降级观测、内存清理，并确认世界引擎不再设置本地请求体积上限；请求能否接受由玩家选择的模型/提供方决定。'
    replace_once(DOC_FILE, old, new, 'observability documentation')


def main() -> None:
    for path in SOURCE_FILES:
        remove_request_cap(path)
    patch_regression()
    patch_docs()
    print('[request-size-cap] done')


if __name__ == '__main__':
    main()
