export function deepSubsetEqual(expected, actual) {
  if (Object.is(expected, actual)) return true;
  if (expected === null || actual === null) return expected === actual;
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) return false;
    return expected.every((value, index) => deepSubsetEqual(value, actual[index]));
  }
  if (typeof expected === 'object') {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
    return Object.entries(expected).every(([key, value]) => deepSubsetEqual(value, actual[key]));
  }
  return false;
}

export function normalizedName(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
}
