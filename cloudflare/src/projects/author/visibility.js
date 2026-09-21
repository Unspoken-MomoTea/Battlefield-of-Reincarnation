import { HttpError, json, readJson } from '../../http.js';
import { getOwnedProject, nowSeconds } from '../core.js';

export async function setOwnerProjectVisibility(request, env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);
  if (Number(project.published_version || 0) < 1) {
    throw new HttpError(409, 'published_version_required', '作品尚未发布，无需下架');
  }

  const body = await readJson(request);
  if (typeof body?.hidden !== 'boolean') {
    throw new HttpError(400, 'invalid_visibility', 'hidden 必须是布尔值');
  }

  if (!body.hidden && project.status === 'archived') {
    throw new HttpError(409, 'admin_archived', '作品已被管理员下架，需要管理员恢复后才能重新上架');
  }

  const now = nowSeconds();
  await env.DB.prepare(
    'UPDATE projects SET owner_hidden = ?, updated_at = ? WHERE id = ?',
  ).bind(body.hidden ? 1 : 0, now, project.id).run();

  return json({
    ok: true,
    owner_hidden: body.hidden,
    published_version: Number(project.published_version || 0),
  });
}
