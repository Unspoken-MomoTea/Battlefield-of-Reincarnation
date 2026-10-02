import { normalizedName } from './compare.js';

const VERSION_SUFFIX_RE =
  /(?:^|[\s·_|/\\\-–—])(?:v(?:ersion)?|ver(?:sion)?|版本)\s*\.?\s*\d+(?:\.\d+){1,3}(?:[-+_.]?[a-z0-9]+)*\s*$/iu;

function versionedIdentity(value) {
  const raw = String(value ?? '').normalize('NFKC').trim();
  if (!raw) return { raw: '', family: '', versioned: false };

  const match = raw.match(VERSION_SUFFIX_RE);
  if (!match || match.index === undefined) {
    return { raw, family: normalizedName(raw), versioned: false };
  }

  const familyRaw = raw
    .slice(0, match.index)
    .replace(/[\s·_|/\\\-–—]+$/gu, '')
    .trim();

  return {
    raw,
    family: normalizedName(familyRaw),
    versioned: Boolean(familyRaw),
  };
}

export function characterTargetRelation(expected, actual) {
  const left = versionedIdentity(expected);
  const right = versionedIdentity(actual);
  if (!left.raw || !right.raw) return 'mismatch';
  if (normalizedName(left.raw) === normalizedName(right.raw)) return 'exact';
  if (left.versioned && right.versioned && left.family && left.family === right.family) {
    return 'version_migration';
  }
  return 'mismatch';
}

export function hasCharacterLocalTargets(targets = {}) {
  return Boolean(
    targets.regexIds?.length ||
    targets.scripts?.character?.length ||
    targets.originalRegexChanges?.length ||
    targets.originalScriptChanges?.some(item => item?.scope === 'character')
  );
}

export function canMigrateCharacterTarget(installed, actualCharacter) {
  if (!installed?.applied || !installed.targetCharacterName) return false;
  return characterTargetRelation(installed.targetCharacterName, actualCharacter) === 'version_migration';
}

export function characterTargetMatches(installed, actualCharacter) {
  if (!installed?.targetCharacterName) return true;
  const relation = characterTargetRelation(installed.targetCharacterName, actualCharacter);
  return relation === 'exact' || canMigrateCharacterTarget(installed, actualCharacter);
}
