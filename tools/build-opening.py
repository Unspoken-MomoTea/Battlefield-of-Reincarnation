#!/usr/bin/env python3
"""Build the self-contained Opening delivery artifact from src/opening sources."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OPENING = ROOT / "src" / "opening"
TEMPLATE = OPENING / "page" / "template.html"
CORE_CSS = OPENING / "styles" / "core.css"
EXTRA_CSS = OPENING / "styles" / "extra.css"
RUNTIME_PARTS = [
    OPENING / "runtime" / "00-database.js",
    OPENING / "runtime" / "10-core-assets.js",
    OPENING / "runtime" / "20-variable-init.js",
    OPENING / "runtime" / "30-character.js",
    OPENING / "runtime" / "40-store.js",
    OPENING / "runtime" / "50-partner-plot.js",
    OPENING / "runtime" / "60-navigation-presets.js",
    OPENING / "runtime" / "70-journey.js",
]
OUTPUTS = [
    ROOT / "dist" / "opening" / "entry.html",
    ROOT / "Regular" / "开局.html",
]
STYLE_CORE_MARKER = "/*__OPENING_STYLE_CORE__*/"
STYLE_EXTRA_MARKER = "/*__OPENING_STYLE_EXTRA__*/"
SCRIPT_MARKER = "//__OPENING_SCRIPT_BUNDLE__"

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def render() -> str:
    template = read(TEMPLATE)
    if template.startswith("```") or template.rstrip().endswith("```"):
        raise RuntimeError("Opening template must be raw HTML without Markdown fences")
    for marker in (STYLE_CORE_MARKER, STYLE_EXTRA_MARKER, SCRIPT_MARKER):
        if template.count(marker) != 1:
            raise RuntimeError(f"Opening template marker must occur exactly once: {marker}")
    runtime = "\n".join(read(path).removesuffix("\n") for path in RUNTIME_PARTS)
    return (
        template
        .replace(STYLE_CORE_MARKER, read(CORE_CSS))
        .replace(STYLE_EXTRA_MARKER, read(EXTRA_CSS))
        .replace(SCRIPT_MARKER, runtime)
    )

def check_output(path: Path, expected: str) -> bool:
    if not path.exists():
        print(f"OUT OF DATE: missing {path.relative_to(ROOT)}", file=sys.stderr)
        return False
    if read(path) != expected:
        print(f"OUT OF DATE: {path.relative_to(ROOT)}", file=sys.stderr)
        return False
    return True

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    built = render()
    if args.check:
        ok = all(check_output(path, built) for path in OUTPUTS)
        if ok:
            print(f"opening build check: OK ({len(built)} chars)")
            return 0
        return 1
    for path in OUTPUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(built, encoding="utf-8")
        print(f"opening build: wrote {path.relative_to(ROOT)} ({len(built)} chars)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
