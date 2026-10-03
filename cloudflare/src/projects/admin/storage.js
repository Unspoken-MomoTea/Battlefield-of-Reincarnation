import { json } from '../../http.js';
import {
  D1_FREE_LIMIT_BYTES,
  R2_FREE_LIMIT_BYTES,
  R2_HARD_LIMIT_BYTES,
  readD1Usage,
  scanR2Usage,
} from '../../storage-policy.js';
import { assertAdmin, writeAdminAudit } from '../core.js';
import { rebuildPublicCatalog } from '../catalog.js';
import { cleanupAllHistoricalVersions } from '../version-retention.js';

export async function getAdminStorageUsage(env, user) {
  assertAdmin(user);
  const [r2, d1, projects, versions] = await Promise.all([
    scanR2Usage(env.PROJECTS),
    readD1Usage(env),
    env.DB.prepare('SELECT COUNT(*) AS count FROM projects').first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM project_versions').first(),
  ]);

  return json({
    r2: {
      used_bytes: r2.usedBytes,
      object_count: r2.objectCount,
      hard_limit_bytes: R2_HARD_LIMIT_BYTES,
      free_limit_bytes: R2_FREE_LIMIT_BYTES,
      remaining_bytes: Math.max(0, R2_HARD_LIMIT_BYTES - r2.usedBytes),
      usage_ratio: R2_HARD_LIMIT_BYTES ? r2.usedBytes / R2_HARD_LIMIT_BYTES : 0,
    },
    d1: {
      used_bytes: d1.usedBytes,
      free_limit_bytes: D1_FREE_LIMIT_BYTES,
      remaining_bytes: d1.usedBytes == null ? null : Math.max(0, D1_FREE_LIMIT_BYTES - d1.usedBytes),
      usage_ratio: d1.usedBytes == null ? null : d1.usedBytes / D1_FREE_LIMIT_BYTES,
      page_count: d1.pageCount,
      page_size: d1.pageSize,
    },
    counts: {
      projects: Number(projects?.count || 0),
      versions: Number(versions?.count || 0),
    },
  });
}

export async function cleanupAdminStorage(env, user) {
  assertAdmin(user);
  const before = await scanR2Usage(env.PROJECTS);
  const cleanup = await cleanupAllHistoricalVersions(env);
  await rebuildPublicCatalog(env);
  const after = await scanR2Usage(env.PROJECTS);

  await writeAdminAudit(env, user, {
    action: 'storage_cleanup',
    note: `历史版本清理：版本 ${cleanup.removedVersions}，R2 对象 ${cleanup.deletedObjects}，释放 ${Math.max(0, before.usedBytes - after.usedBytes)} bytes`,
  });

  return json({
    ok: true,
    removed_versions: cleanup.removedVersions,
    deleted_objects: cleanup.deletedObjects,
    freed_bytes: Math.max(0, before.usedBytes - after.usedBytes),
    r2_used_bytes: after.usedBytes,
  });
}
