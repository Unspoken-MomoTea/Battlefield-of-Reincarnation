from __future__ import annotations

import argparse
import runpy
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'script' / 'world-engine-src'
OUTPUT = ROOT / 'script' / '世界推进系统.js'
PARTS = (
    '00-foundation-prompt.part.js',
    '10-world-state.part.js',
    '20-world-result.part.js',
    '30-context-protocol.part.js',
    '40-engine-runtime.part.js',
    '50-engine-ui.part.js',
    '55-policy-compat.part.js',
    '56-rumor-liveliness.part.js',
    '57-task-awareness.part.js',
    '58-chronology-guard.part.js',
    '60-bootstrap.part.js',
)


def assembled_source() -> str:
    missing = [name for name in PARTS if not (SOURCE_DIR / name).is_file()]
    if missing:
        raise SystemExit('missing world-engine source parts: ' + ', '.join(missing))
    return ''.join((SOURCE_DIR / name).read_text(encoding='utf-8') for name in PARTS)


def main() -> int:
    parser = argparse.ArgumentParser(description='Assemble the single-file Tavern world engine delivery script.')
    parser.add_argument('--check', action='store_true', help='fail if the checked-in delivery file is not identical to the source parts')
    args = parser.parse_args()

    staged_exploration_prune = False
    if not args.check:
        oneoff = ROOT / 'tools' / '_oneoff_prune_cold_exploration.py'
        if oneoff.is_file():
            runpy.run_path(str(oneoff), run_name='__main__')
            subprocess.run(
                ['git', 'add', 'script/world-engine-src/10-world-state.part.js', 'tests/world-engine-exploration-prune.cjs'],
                cwd=ROOT,
                check=True,
            )
            staged_exploration_prune = True

    built = assembled_source()
    if args.check:
        current = OUTPUT.read_text(encoding='utf-8') if OUTPUT.is_file() else ''
        if current != built:
            raise SystemExit('script/世界推进系统.js is out of date; run: python tools/build-world-engine.py')
        print(f'world-engine build is synchronized: {len(PARTS)} parts, {len(built)} chars')
        return 0
    OUTPUT.write_text(built, encoding='utf-8')
    if staged_exploration_prune:
        subprocess.run(['node', 'tests/world-engine-exploration-prune.cjs'], cwd=ROOT, check=True)
    print(f'built {OUTPUT.relative_to(ROOT)} from {len(PARTS)} parts ({len(built)} chars)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
