import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'World Book' / '[variables]当前变量.txt'
text = path.read_text(encoding='utf-8')

if 'const tavernPlayerName = (() => {' not in text:
    pattern = re.compile(
        r"const projectionNameKey = value => .*?\n"
        r"const isPlayerOwnedAsset = asset => \{[\s\S]*?\n\};",
        re.MULTILINE,
    )
    replacement = """const projectionNameKey = value => String(value || '').toLowerCase().replace(/[\\/／·・._\\-\\s]+/g, '');
const tavernPlayerName = (() => {
  try {
    const host = (typeof window !== 'undefined' && window.parent && window.parent !== window)
      ? window.parent
      : (typeof window !== 'undefined' ? window : null);
    const tavern = host?.SillyTavern || (typeof SillyTavern !== 'undefined' ? SillyTavern : null);
    return String(tavern?.name1 || tavern?.getContext?.()?.name1 || host?.name1 || '').trim();
  } catch (_) { return ''; }
})();
const legacyTemplateUser = '{{' + 'user}}';
const playerIdentityKeys = new Set([tavernPlayerName, '<user>', legacyTemplateUser, '玩家'].filter(Boolean).map(projectionNameKey));
const isPlayerOwnedAsset = asset => {
  const owners = Array.isArray(asset?.所属对象)
    ? asset.所属对象
    : (typeof asset?.所属对象 === 'string' ? [asset.所属对象] : []);
  return owners.some(owner => playerIdentityKeys.has(projectionNameKey(owner)));
};"""
    text, count = pattern.subn(lambda _: replacement, text, count=1)
    if count != 1:
        raise SystemExit(f'variable projection compatibility patch expected 1 block, got {count}')
    path.write_text(text, encoding='utf-8')
    print('normalized player asset variable projection')
else:
    print('player asset variable projection already normalized')
