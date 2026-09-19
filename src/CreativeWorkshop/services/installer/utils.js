export function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export function strings(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
}

export function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function positiveOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function parseJsonLike(value, label) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); }
  catch { throw new Error(`${label} 不是有效 JSON`); }
}

export function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export async function maybe(value) {
  return Promise.resolve(value);
}
