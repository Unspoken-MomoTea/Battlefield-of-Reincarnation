from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'script' / '悬浮球状态栏.js'
PARTS = (
    '@src/StatusBar/core/StatusBarFoundation.part.js',
    '@src/StatusBar/ui/StatusBarStyles.part.js',
    '@src/StatusBar/ui/StatusBarShell.part.js',
    '@src/StatusBar/domains/StatusBarBloodFusion.part.js',
    '@src/StatusBar/domains/StatusBarTransferLoot.part.js',
    '@src/StatusBar/ui/StatusBarEventBindings.part.js',
    '@src/StatusBar/settings/StatusBarSettings.part.js',
    '@src/StatusBar/ui/StatusBarRenderer.part.js',
    '@src/StatusBar/ui/StatusBarDetailsEditor.part.js',
    '@src/StatusBar/shop/StatusBarShopCatalog.part.js',
    '@src/StatusBar/shop/StatusBarShopView.part.js',
    '@src/StatusBar/shop/StatusBarShopTransaction.part.js',
    '@src/StatusBar/shop/StatusBarShopAi.part.js',
    '@src/StatusBar/domains/StatusBarActions.part.js',
    '@src/StatusBar/core/StatusBarBootstrap.part.js',
)


def part_path(name: str) -> Path:
    if not name.startswith('@'):
        raise SystemExit('status-bar PARTS must use @src paths: ' + name)
    return ROOT / name[1:]


def assembled_source() -> str:
    missing = [name for name in PARTS if not part_path(name).is_file()]
    if missing:
        raise SystemExit('missing status-bar source parts: ' + ', '.join(missing))
    return ''.join(part_path(name).read_text(encoding='utf-8') for name in PARTS)


def main() -> int:
    parser = argparse.ArgumentParser(description='Assemble the single-file Tavern status-bar delivery script.')
    parser.add_argument('--check', action='store_true', help='fail if the checked-in delivery file is not identical to the source parts')
    args = parser.parse_args()
    built = assembled_source()
    if args.check:
        current = OUTPUT.read_text(encoding='utf-8') if OUTPUT.is_file() else ''
        if current != built:
            raise SystemExit('script/悬浮球状态栏.js is out of date; run: python tools/build-status-bar.py')
        print(f'status-bar build is synchronized: {len(PARTS)} parts, {len(built)} chars')
        return 0
    OUTPUT.write_text(built, encoding='utf-8')
    print(f'built {OUTPUT.relative_to(ROOT)} from {len(PARTS)} parts ({len(built)} chars)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
