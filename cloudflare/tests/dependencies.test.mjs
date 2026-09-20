import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProject,
  getPublicProject,
  reviewProject,
  submitProjectForReview,
  updateProject,
  uploadProjectVersion,
} from '../src/projects.js';
import {
  bundle,
  createWorldbookProject,
  publishVersion,
  request,
  responseJson,
  setup,
} from './support/project-fixture.mjs';

test('published project freezes explicit dependencies into version metadata', async () => {
  const { env, author, admin } = setup();
  const base = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, base.id, bundle('base'));

  const created = await responseJson(
    await createProject(
      request('/api/projects', 'POST', {
        name: '依赖作品',
        summary: '',
        category: 'extension',
        dependencies: [{ project_id: base.id, min_version: 1 }],
      }),
      env,
      author,
    ),
  );
  assert.deepEqual(created.project.dependencies, [{ project_id: base.id, min_version: 1 }]);

  await uploadProjectVersion(
    request(`/api/projects/${created.project.id}/versions`, 'POST', {
      changelog: '',
      bundle: bundle('dependent'),
    }),
    env,
    author,
    created.project.id,
  );
  await submitProjectForReview(env, author, created.project.id);
  await reviewProject(
    request(`/api/admin/projects/${created.project.id}/review`, 'POST', {
      decision: 'approved',
      note: '',
    }),
    env,
    admin,
    created.project.id,
  );

  await updateProject(
    request(`/api/projects/${created.project.id}`, 'PATCH', { dependencies: [] }),
    env,
    author,
    created.project.id,
  );

  const detail = await responseJson(await getPublicProject(created.project.id, env));
  assert.deepEqual(detail.project.dependencies, [{ project_id: base.id, min_version: 1 }]);
});

test('dependency metadata rejects self, unpublished and unavailable versions', async () => {
  const { env, author } = setup();
  const target = await createWorldbookProject(env, author);

  await assert.rejects(
    () =>
      createProject(
        request('/api/projects', 'POST', {
          name: '错误依赖',
          summary: '',
          category: 'extension',
          dependencies: [{ project_id: target.id, min_version: 1 }],
        }),
        env,
        author,
      ),
    error => error?.status === 409 && error?.code === 'dependency_unavailable',
  );
});


test('dependency metadata rejects cycles through published dependency graph', async () => {
  const { env, author, admin } = setup();

  const a = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, a.id, bundle('A'));

  const bCreated = await responseJson(
    await createProject(
      request('/api/projects', 'POST', {
        name: 'B',
        summary: '',
        category: 'extension',
        dependencies: [{ project_id: a.id, min_version: 1 }],
      }),
      env,
      author,
    ),
  );
  const b = bCreated.project;
  await uploadProjectVersion(
    request(`/api/projects/${b.id}/versions`, 'POST', { changelog: '', bundle: bundle('B') }),
    env,
    author,
    b.id,
  );
  await submitProjectForReview(env, author, b.id);
  await reviewProject(
    request(`/api/admin/projects/${b.id}/review`, 'POST', { decision: 'approved', note: '' }),
    env,
    admin,
    b.id,
  );

  await assert.rejects(
    () =>
      updateProject(
        request(`/api/projects/${a.id}`, 'PATCH', {
          dependencies: [{ project_id: b.id, min_version: 1 }],
        }),
        env,
        author,
        a.id,
      ),
    error => error?.status === 409 && error?.code === 'dependency_cycle',
  );
});
