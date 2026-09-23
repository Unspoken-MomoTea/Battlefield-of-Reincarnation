export const CHARACTER_ASSET_VERSION = 1;

export const CHARACTER_ASSET_KINDS = Object.freeze({
  WORLD_CHARACTER: 'world_character',
  OPENING_CHARACTER: 'opening_character',
  OPENING_PARTNER: 'opening_partner',
  HERETIC: 'heretic',
});

const clone = value => structuredClone(value ?? {});

export function sanitizeCombatBuild(source = {}) {
  const value = clone(source);
  const build = {
    种族: value.种族 ?? '人类',
    身份: clone(value.身份 ?? []),
    职业: clone(value.职业 ?? {}),
    层级: value.层级 ?? 'Ⅰ',
    血统: clone(value.血统 ?? {}),
    技能: clone(value.技能 ?? {}),
    装备: clone(value.装备 ?? {}),
    状态: clone(value.状态 ?? {}),
    形态库: clone(value.形态库 ?? {}),
    当前形态: clone(value.当前形态 ?? { 激活: false, 名称: '' }),
  };
  return stripDerivedFields(build);
}

export function stripDerivedFields(value) {
  if (Array.isArray(value)) return value.map(stripDerivedFields);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (['最终属性', '真属性', 'HP', 'HP_MAX', 'THP', 'EP', 'EP_MAX'].includes(key)) continue;
    out[key] = stripDerivedFields(child);
  }
  return out;
}

export function createHereticAsset(character, profile = {}) {
  return {
    schema_version: CHARACTER_ASSET_VERSION,
    kind: CHARACTER_ASSET_KINDS.HERETIC,
    name: String(profile.name ?? character?.姓名 ?? '').trim(),
    profile: {
      性格: String(profile.personality ?? '').trim(),
      喜爱: String(profile.likes ?? '').trim(),
      背景故事: String(profile.background ?? '').trim(),
    },
    build: sanitizeCombatBuild(character),
  };
}
