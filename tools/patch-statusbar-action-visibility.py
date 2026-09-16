from pathlib import Path

# 兼容旧工作流入口。实际修复统一收口到 helper-owned eligibility patch：
# - 结算任务仍保持“副本内非战斗常驻”
# - 申请进阶/源力灌注恢复只读取 系统状态.是否可试炼
# - 辅助计算脚本负责事件更新、世界独立提交、加载态三条路径的资格同步
patch = Path(__file__).with_name('patch-trial-eligibility-owner.py')
exec(compile(patch.read_text(encoding='utf-8'), str(patch), 'exec'))
