import { HttpError, json } from '../http.js';
import { getOwnedProject } from './core.js';

const MAX_COVER_BYTES = 3 * 1024 * 1024;
const COVER_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

function isPng(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return signature.every((value, index) => bytes[index] === value);
}

function isJpeg(bytes) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes) {
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function bytesMatchType(bytes, contentType) {
  if (contentType === 'image/png') return isPng(bytes);
  if (contentType === 'image/jpeg') return isJpeg(bytes);
  if (contentType === 'image/webp') return isWebp(bytes);
  return false;
}

async function cleanupUnreferencedCover(env, coverKey) {
  if (!coverKey) return;
  const referenced = await env.DB.prepare(
    'SELECT 1 AS used FROM project_versions WHERE cover_key = ? LIMIT 1',
  )
    .bind(coverKey)
    .first();
  if (!referenced) await env.PROJECTS.delete(coverKey);
}

export async function uploadProjectCover(request, env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);
  if (project.status === 'archived') {
    throw new HttpError(409, 'project_archived', '已归档作品不能修改封面');
  }
  if (project.status === 'pending') {
    throw new HttpError(409, 'review_pending', '作品正在审核，审核结束前不能修改封面');
  }

  const contentType = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const extension = COVER_TYPES.get(contentType);
  if (!extension) {
    throw new HttpError(415, 'unsupported_cover_type', '封面仅支持 PNG、JPEG、WebP');
  }

  const declaredSize = Number(request.headers.get('Content-Length') || 0);
  if (declaredSize > MAX_COVER_BYTES) {
    throw new HttpError(413, 'cover_too_large', '封面不能超过 3 MB');
  }

  const buffer = await request.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > MAX_COVER_BYTES) {
    throw new HttpError(buffer.byteLength ? 413 : 400, buffer.byteLength ? 'cover_too_large' : 'invalid_cover', buffer.byteLength ? '封面不能超过 3 MB' : '封面内容为空');
  }

  const bytes = new Uint8Array(buffer);
  if (!bytesMatchType(bytes, contentType)) {
    throw new HttpError(400, 'invalid_cover', '封面文件内容与图片类型不匹配');
  }

  const key = `projects/${project.id}/covers/${crypto.randomUUID()}.${extension}`;
  await env.PROJECTS.put(key, buffer, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  try {
    await env.DB.prepare('UPDATE projects SET cover_key = ?, updated_at = ? WHERE id = ?')
      .bind(key, Math.floor(Date.now() / 1000), project.id)
      .run();

    if (Number(project.latest_version) > 0) {
      const latest = await env.DB.prepare(
        'SELECT review_status FROM project_versions WHERE project_id = ? AND version = ?',
      )
        .bind(project.id, project.latest_version)
        .first();
      if (latest && ['draft', 'rejected'].includes(latest.review_status)) {
        await env.DB.prepare(
          'UPDATE project_versions SET cover_key = ? WHERE project_id = ? AND version = ?',
        )
          .bind(key, project.id, project.latest_version)
          .run();
      }
    }
  } catch (error) {
    await env.PROJECTS.delete(key);
    throw error;
  }

  if (project.cover_key && project.cover_key !== key) {
    await cleanupUnreferencedCover(env, project.cover_key);
  }

  return json({ ok: true, has_cover: true });
}

export async function getPublicProjectCover(env, projectId) {
  const row = await env.DB.prepare(
    `SELECT v.cover_key
       FROM projects p
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
      WHERE p.id = ? AND p.published_version > 0 AND p.status <> 'archived'`,
  )
    .bind(projectId)
    .first();

  if (!row?.cover_key) throw new HttpError(404, 'cover_not_found', '作品没有公开封面');
  const object = await env.PROJECTS.get(row.cover_key);
  if (!object) throw new HttpError(404, 'cover_missing', '作品封面文件不存在');

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': object.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable',
    },
  });
}
