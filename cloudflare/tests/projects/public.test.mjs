import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProject,
  downloadPublicProject,
  getPublicProject,
  getPublicProjectVersion,
  getPendingProjectReview,
  listAdminAuditLogs,
  listAdminProjects,
  listOwnProjects,
  listPublicProjects,
  reviewProject,
  setAdminProjectState,
  submitProjectForReview,
  uploadProjectVersion,
  updateProject,
  validateBundle,
} from '../../src/projects.js';

import {
  bundle,
  createWorldbookProject,
  publishVersion,
  request,
  responseJson,
  setup,
} from '../support/project-fixture.mjs';

test('published project appears in public catalog and can be downloaded', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'));

  const list = await responseJson(await listPublicProjects(request('/api/projects'), env));
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].id, project.id);
  assert.equal(list.items[0].version, 1);

  const detail = await responseJson(await getPublicProject(project.id, env));
  assert.equal(detail.project.version, 1);
  assert.equal(detail.manifest.artifacts[0].name, 'v1');

  const download = await responseJson(await downloadPublicProject(project.id, env));
  assert.equal(download.artifacts[0].content.entries['0'].comment, 'v1');
});

test('new draft version does not replace the last approved public version', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'));
  await uploadProjectVersion(request(`/api/projects/${project.id}/versions`, 'POST', { changelog: 'v2', bundle: bundle('v2') }), env, author, project.id);

  const version = await responseJson(await getPublicProjectVersion(project.id, env));
  assert.equal(version.version, 1);
  const download = await responseJson(await downloadPublicProject(project.id, env));
  assert.equal(download.artifacts[0].name, 'v1');
});

test('rejected update keeps the previously approved version public', async () => {
  const { env, author, admin } = setup();
  const project = await createWorldbookProject(env, author);
  await publishVersion(env, author, admin, project.id, bundle('v1'));
  await uploadProjectVersion(request(`/api/projects/${project.id}/versions`, 'POST', { changelog: 'v2', bundle: bundle('v2') }), env, author, project.id);
  await submitProjectForReview(env, author, project.id);
  await reviewProject(request(`/api/admin/projects/${project.id}/review`, 'POST', { decision: 'rejected', note: '格式需要修改' }), env, admin, project.id);

  const version = await responseJson(await getPublicProjectVersion(project.id, env));
  assert.equal(version.version, 1);
  const projectRow = env.DB.db.prepare('SELECT status, latest_version, published_version FROM projects WHERE id = ?').get(project.id);
  assert.equal(projectRow.status, 'rejected');
  assert.equal(Number(projectRow.latest_version), 2);
  assert.equal(Number(projectRow.published_version), 1);
});

test('author can assign normalized tags and public catalog can filter by tag', async () => {
  const { env, author, admin } = setup();
  const created = await responseJson(
    await createProject(
      request('/api/projects', 'POST', {
        name: '标签测试',
        summary: '测试标签筛选',
        category: 'extension',
        tags: [' 剧情 ', 'BOSS', '剧情'],
      }),
      env,
      author,
    ),
  );
  assert.deepEqual(created.project.tags, ['剧情', 'boss']);

  await publishVersion(env, author, admin, created.project.id, bundle('tagged'));

  const matching = await responseJson(
    await listPublicProjects(request('/api/projects?tag=boss'), env),
  );
  assert.equal(matching.items.length, 1);
  assert.deepEqual(matching.items[0].tags, ['剧情', 'boss']);

  const missing = await responseJson(
    await listPublicProjects(request('/api/projects?tag=不存在'), env),
  );
  assert.equal(missing.items.length, 0);
});

test('published metadata remains frozen until a new version is approved', async () => {
  const { env, author, admin } = setup();
  const created = await responseJson(
    await createProject(
      request('/api/projects', 'POST', {
        name: '公开名称 v1',
        summary: '公开简介 v1',
        category: 'extension',
        tags: ['v1'],
      }),
      env,
      author,
    ),
  );
  const project = created.project;
  await publishVersion(env, author, admin, project.id, bundle('v1'));

  await updateProject(
    request(`/api/projects/${project.id}`, 'PATCH', {
      name: '草稿名称 v2',
      summary: '草稿简介 v2',
      tags: ['v2'],
    }),
    env,
    author,
    project.id,
  );

  let detail = await responseJson(await getPublicProject(project.id, env));
  assert.equal(detail.project.name, '公开名称 v1');
  assert.equal(detail.project.summary, '公开简介 v1');
  assert.deepEqual(detail.project.tags, ['v1']);

  await uploadProjectVersion(
    request(`/api/projects/${project.id}/versions`, 'POST', {
      changelog: 'metadata v2',
      bundle: bundle('v2'),
    }),
    env,
    author,
    project.id,
  );
  await submitProjectForReview(env, author, project.id);

  detail = await responseJson(await getPublicProject(project.id, env));
  assert.equal(detail.project.name, '公开名称 v1');
  assert.deepEqual(detail.project.tags, ['v1']);

  await reviewProject(
    request(`/api/admin/projects/${project.id}/review`, 'POST', {
      decision: 'approved',
      note: '元数据与内容一起通过',
    }),
    env,
    admin,
    project.id,
  );

  detail = await responseJson(await getPublicProject(project.id, env));
  assert.equal(detail.project.name, '草稿名称 v2');
  assert.equal(detail.project.summary, '草稿简介 v2');
  assert.deepEqual(detail.project.tags, ['v2']);
});


test('project type filters character and extension independently from artifact kinds', async () => {
  const { env, author, admin } = setup();

  const extension = await responseJson(
    await createProject(
      request('/api/projects', 'POST', {
        name: '扩展作品',
        summary: '',
        category: 'extension',
      }),
      env,
      author,
    ),
  );
  await publishVersion(env, author, admin, extension.project.id, bundle('extension-book'));

  const character = await responseJson(
    await createProject(
      request('/api/projects', 'POST', {
        name: '角色作品',
        summary: '',
        category: 'character',
      }),
      env,
      author,
    ),
  );
  await publishVersion(env, author, admin, character.project.id, bundle('character-book'));

  const characterList = await responseJson(
    await listPublicProjects(request('/api/projects?category=character'), env),
  );
  assert.equal(characterList.items.length, 1);
  assert.equal(characterList.items[0].id, character.project.id);
  assert.equal(characterList.items[0].category, 'character');

  const extensionList = await responseJson(
    await listPublicProjects(request('/api/projects?category=extension'), env),
  );
  assert.equal(extensionList.items.length, 1);
  assert.equal(extensionList.items[0].id, extension.project.id);
  assert.equal(extensionList.items[0].category, 'extension');
});


test('public catalog supports server-side sorting by engagement counters', async () => {
  const { env, author, admin } = setup();

  const first = await createWorldbookProject(env, author, { name: '较早作品' });
  await publishVersion(env, author, admin, first.id, bundle('first'));

  const second = await createWorldbookProject(env, author, { name: '热门作品' });
  await publishVersion(env, author, admin, second.id, bundle('second'));

  env.DB.db.prepare(
    'UPDATE projects SET downloads_count = 3, likes_count = 1, favorites_count = 0 WHERE id = ?',
  ).run(first.id);
  env.DB.db.prepare(
    'UPDATE projects SET downloads_count = 12, likes_count = 5, favorites_count = 4 WHERE id = ?',
  ).run(second.id);

  const downloads = await responseJson(
    await listPublicProjects(request('/api/projects?sort=downloads'), env),
  );
  assert.equal(downloads.items[0].id, second.id);

  const popular = await responseJson(
    await listPublicProjects(request('/api/projects?sort=popular'), env),
  );
  assert.equal(popular.items[0].id, second.id);
});

test('public catalog rejects unknown sort modes', async () => {
  const { env } = setup();
  await assert.rejects(
    () => listPublicProjects(request('/api/projects?sort=drop-table'), env),
    error => error?.status === 400 && error?.code === 'invalid_project_sort',
  );
});
