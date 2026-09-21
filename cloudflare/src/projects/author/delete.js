import { HttpError, json } from '../../http.js';
import { getOwnedProject } from '../core.js';
import { permanentlyDeleteProject } from '../delete.js';

export async function deleteProject(env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);
  if (project.status === 'pending') {
    throw new HttpError(409, 'review_pending', '作品正在审核，不能删除');
  }
  if (Number(project.published_version) > 0 && project.status !== 'archived') {
    throw new HttpError(
      409,
      'published_project_delete_forbidden',
      '已发布作品需要先由管理员下架，之后作者才能永久删除',
    );
  }

  const cleanup = await permanentlyDeleteProject(env, project);
  return json({ ok: true, ...cleanup });
}
