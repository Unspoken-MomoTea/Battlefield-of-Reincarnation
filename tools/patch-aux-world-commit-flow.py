from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATCH = ROOT / 'tools' / 'patch-aux-turn-message-dedup.py'

# 兼容旧 CI 入口；实际逻辑已迁移为“按 AI 正文楼层防重复”，不再识别世界推进提交来源。
exec(compile(PATCH.read_text(encoding='utf-8'), str(PATCH), 'exec'), {'__name__': '__main__'})
