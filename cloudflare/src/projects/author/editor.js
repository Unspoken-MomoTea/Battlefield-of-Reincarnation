import { HttpError, json } from '../../http.js';
import { getOwnedProject, parseDependencies, parseTags } from '../core.js';

export async function getOwnedProjectEditor(env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);

  let bundle = { schema_version: 1, artifacts: [] };
  let changelog = '';
  let reviewStatus = 'draft';

  if (Number(project.latest_version || 0) > 0) {
    const version = await env.DB.prepare(
      `SELECT content_key, changelog, review_status
         FROM project_versions
        WHERE project_id = ? AND version = ?`,
    ).bind(project.id, project.latest_version).first();

    if (!version) throw new HttpError(500, 'version_missing', '最新版本记录缺失');
    const object = await env.PROJECTS.get(version.content_key);
    if (!object) throw new HttpError(500, 'bundle_missing', '最新版本作品内容缺失');
    bundle = JSON.parse(await new Response(object.body).text());
    changelog = version.changelog || '';
    reviewStatus = version.review_status || 'draft';
  }

  return json({
    project: {
      id: project.id,
      name: project.name,
      summary: project.summary || '',
      category: project.category,
      tags: parseTags(project.tags),
      dependencies: parseDependencies(project.dependencies),
      has_cover: Boolean(project.cover_key),
      owner_hidden: Boolean(Number(project.owner_hidden || 0)),
      status: project.status,
      latest_version: Number(project.latest_version || 0),
      published_version: Number(project.published_version || 0),
    },
    latest: {
      version: Number(project.latest_version || 0),
      changelog,
      review_status: reviewStatus,
      bundle,
    },
  });
}
