import { isProjectWorldbookEntry, provenance } from './ownership.js';
import { record } from './utils.js';

export const CHARACTER_ORDER_BASE = 600;
export const CHARACTER_ORDER_FIRST = 601;
export const CHARACTER_ORDER_LAST = 699;

export function isCharacterWorldbookSlot(entry) {
  const source = record(provenance(entry));
  if (!source?.sourceId) return false;
  if (source.characterSlot === true) return true;
  return entry?.position?.type === 'after_character_definition'
    && /^\[角色\]\s*/u.test(String(entry?.name || ''));
}

function characterProjectId(entry) {
  return String(record(provenance(entry))?.sourceId || '');
}

export function mergeProjectWorldbookEntries(existing = [], planned = [], projectId = '') {
  const firstOwnedIndex = existing.findIndex(entry => isProjectWorldbookEntry(entry, projectId));
  const remaining = existing.filter(entry => !isProjectWorldbookEntry(entry, projectId));
  if (firstOwnedIndex < 0) return [...remaining, ...planned];

  const insertionIndex = existing
    .slice(0, firstOwnedIndex)
    .filter(entry => !isProjectWorldbookEntry(entry, projectId))
    .length;
  return [
    ...remaining.slice(0, insertionIndex),
    ...planned,
    ...remaining.slice(insertionIndex),
  ];
}

export function compactCharacterWorldbookOrders(entries = []) {
  const projectOrders = new Map();
  let nextOrder = CHARACTER_ORDER_FIRST;

  return entries.map(entry => {
    if (!isCharacterWorldbookSlot(entry)) return entry;
    const projectId = characterProjectId(entry);
    if (!projectOrders.has(projectId)) {
      if (nextOrder > CHARACTER_ORDER_LAST) {
        throw new Error(`角色类世界书已达到上限：最多 ${CHARACTER_ORDER_LAST - CHARACTER_ORDER_BASE} 个 MOD`);
      }
      projectOrders.set(projectId, nextOrder);
      nextOrder += 1;
    }
    return {
      ...entry,
      position: {
        ...(entry.position || {}),
        type: 'after_character_definition',
        role: 'system',
        order: projectOrders.get(projectId),
      },
    };
  });
}

export function characterOrderForProject(entries = [], projectId = '') {
  const entry = entries.find(item =>
    isProjectWorldbookEntry(item, projectId) && isCharacterWorldbookSlot(item)
  );
  const order = Number(entry?.position?.order);
  return Number.isFinite(order) ? order : null;
}
