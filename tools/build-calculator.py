#!/usr/bin/env python3
"""
辅助计算脚本构建入口。

目标：与 build-status-bar.py / build-world-engine.py 保持一致，
将 src/Calculator 生成酒馆可直接加载的 script/辅助计算脚本.js。
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src' / 'Calculator'
OUT = ROOT / 'script' / '辅助计算脚本.js'

# 初期迁移阶段保留旧交付文件，后续逐步拆入模块。
# 完整合并器将在迁移原脚本逻辑后补齐。

def main():
    if not SRC.exists():
        raise SystemExit('missing src/Calculator')
    print(f'calculator source: {SRC}')
    print(f'calculator output: {OUT}')

if __name__ == '__main__':
    main()
