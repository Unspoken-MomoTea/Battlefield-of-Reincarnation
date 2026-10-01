from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'script' / '辅助计算脚本.js'
PARTS = (
    '@src/Calculator/core/CalculatorFoundation.part.js',
    '@src/Calculator/core/CalculatorLogic.part.js',
    '@src/Calculator/core/CalculatorBootstrap.part.js',
)


def part_path(name: str) -> Path:
    if not name.startswith('@'):
        raise SystemExit('calculator PARTS must use @src paths: ' + name)
    return ROOT / name[1:]


def assembled_source() -> str:
    missing = [name for name in PARTS if not part_path(name).is_file()]
    if missing:
        raise SystemExit('missing calculator source parts: ' + ', '.join(missing))
    return ''.join(part_path(name).read_text(encoding='utf-8') for name in PARTS)


def main() -> int:
    parser = argparse.ArgumentParser(description='Assemble the Tavern auxiliary calculator delivery script.')
    parser.add_argument('--check', action='store_true', help='fail if delivery is not identical to source parts')
    args = parser.parse_args()
    built = assembled_source()
    if args.check:
        current = OUTPUT.read_text(encoding='utf-8') if OUTPUT.is_file() else ''
        if current != built:
            raise SystemExit('script/辅助计算脚本.js is out of date; run: python tools/build-calculator.py')
        print(f'calculator build is synchronized: {len(PARTS)} parts, {len(built)} chars')
        return 0
    OUTPUT.write_text(built, encoding='utf-8')
    print(f'built {OUTPUT.relative_to(ROOT)} from {len(PARTS)} parts ({len(built)} chars)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
