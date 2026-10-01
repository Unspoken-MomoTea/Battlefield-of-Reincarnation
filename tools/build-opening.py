#!/usr/bin/env python3
"""Build opening delivery entry from src/opening."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src' / 'opening'
OUTPUT = ROOT / 'dist' / 'opening'


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    files = list(SOURCE.rglob('*'))
    (OUTPUT / 'manifest.txt').write_text(
        '\n'.join(str(p.relative_to(SOURCE)) for p in files if p.is_file()),
        encoding='utf-8',
    )
    print(f'opening build: {len(files)} files')


if __name__ == '__main__':
    main()
