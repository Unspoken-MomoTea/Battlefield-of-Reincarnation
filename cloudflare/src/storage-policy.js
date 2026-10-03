import { HttpError } from './http.js';

export const R2_FREE_LIMIT_BYTES = 10_000_000_000;
export const R2_HARD_LIMIT_BYTES = 9_500_000_000;
export const R2_UPLOAD_LIMIT_BYTES = 9_450_000_000;
export const D1_FREE_LIMIT_BYTES = 500_000_000;

export async function scanR2Usage(bucket) {
  if (!bucket || typeof bucket.list !== 'function') {
    return { usedBytes: 0, objectCount: 0, unavailable: true };
  }
  let cursor;
  let usedBytes = 0;
  let objectCount = 0;
  do {
    const page = await bucket.list({ ...(cursor ? { cursor } : {}), limit: 1000 });
    for (const object of page?.objects || []) {
      usedBytes += Number(object?.size || 0);
      objectCount += 1;
    }
    cursor = page?.truncated ? page.cursor : undefined;
  } while (cursor);
  return { usedBytes, objectCount };
}

async function reclaimableBytes(bucket, keys = []) {
  let total = 0;
  for (const key of new Set((keys || []).filter(Boolean))) {
    try {
      const object = await bucket.head(key);
      total += Number(object?.size || 0);
    } catch {}
  }
  return total;
}

export async function assertR2Capacity(env, incomingBytes, { reclaimKeys = [], limitBytes = R2_UPLOAD_LIMIT_BYTES } = {}) {
  const usage = await scanR2Usage(env.PROJECTS);
  const reclaim = await reclaimableBytes(env.PROJECTS, reclaimKeys);
  const projectedBytes = Math.max(0, usage.usedBytes - reclaim) + Math.max(0, Number(incomingBytes || 0));
  if (projectedBytes > limitBytes) {
    throw new HttpError(
      507,
      'r2_storage_limit',
      '工坊对象存储已接近免费额度上限，当前上传会突破安全预算，请先清理内容后再试',
    );
  }
  return { ...usage, reclaimableBytes: reclaim, projectedBytes, limitBytes };
}

export async function readD1Usage(env) {
  try {
    const [count, size] = await Promise.all([
      env.DB.prepare('PRAGMA page_count').first(),
      env.DB.prepare('PRAGMA page_size').first(),
    ]);
    const pageCount = Number(count?.page_count ?? Object.values(count || {})[0] ?? 0);
    const pageSize = Number(size?.page_size ?? Object.values(size || {})[0] ?? 0);
    return { usedBytes: pageCount * pageSize, pageCount, pageSize };
  } catch {
    return { usedBytes: null, pageCount: null, pageSize: null };
  }
}
