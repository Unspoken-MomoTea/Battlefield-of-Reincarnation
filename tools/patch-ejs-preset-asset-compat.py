from pathlib import Path

path = Path('World Book/[variables]当前变量.txt')
text = path.read_text(encoding='utf-8')
replacements = [
    ('isPlayerOwnedAsset', 'isPlayerOwnedHolding'),
    ('playerAssets', 'playerHoldings'),
    ('tacticalAsset', 'tacticalHolding'),
    ('asset => isPlayerOwnedHolding(asset)', 'holding => isPlayerOwnedHolding(holding)'),
    ('const isPlayerOwnedHolding = asset => {', 'const isPlayerOwnedHolding = holding => {'),
    ('asset?.所属对象', 'holding?.所属对象'),
    ('asset.所属对象', 'holding.所属对象'),
    ('(asset, name) => {', '(holding, name) => {'),
    ('_.cloneDeep(asset)', '_.cloneDeep(holding)'),
    ('(result, asset, name) => {', '(result, holding, name) => {'),
]
for old, new in replacements:
    text = text.replace(old, new)

# Guard against the exact class of preset mutation that caused EJS compilation to fail.
# The executable variable template should not contain the trigger token at all.
if 'asset' in text.lower():
    raise SystemExit('ASCII asset token still present in EJS variable template')

path.write_text(text, encoding='utf-8')
