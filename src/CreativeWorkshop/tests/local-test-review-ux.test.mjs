import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { saveLocalTestProject } from '../services/projects/cache.js';
import { workshopTemplate } from '../ui/template.js';

test('malformed local-test bundle reports a workshop error instead of raw undefined.map TypeError', async () => {
  await assert.rejects(
    () => saveLocalTestProject({
      id: 'draft:broken',
      name: 'Broken local draft',
      category: 'character',
      bundle: { schema_version: 1 },
    }),
    error => (
      /本地测试内容无效/u.test(String(error?.message || ''))
      && !/undefined.*map|reading ['"]map['"]/iu.test(String(error?.message || ''))
    ),
  );
});

test('local-test save shows preparing/saving/saved states and yields a frame before heavy work', () => {
  const create = fs.readFileSync(
    fileURLToPath(new URL('../views/author/create-project.js', import.meta.url)),
    'utf8',
  );
  const editor = fs.readFileSync(
    fileURLToPath(new URL('../views/author/project-editor.js', import.meta.url)),
    'utf8',
  );

  assert.match(create, /正在准备…/u);
  assert.match(create, /正在校验并写入当前浏览器/u);
  assert.match(create, /✓ 已保存本地测试/u);
  assert.match(create, /requestAnimationFrame/u);

  assert.match(editor, /正在准备…/u);
  assert.match(editor, /正在校验并写入当前浏览器/u);
  assert.match(editor, /✓ 本地修改已保存|✓ 已保存到本地测试/u);
  assert.match(editor, /requestAnimationFrame/u);
});

test('workshop refresh action uses the compact label', () => {
  const html = workshopTemplate('test');
  assert.match(html, /data-action="refresh-workshop"[^>]*>刷新<\/button>/u);
  assert.doesNotMatch(html, /data-action="refresh-workshop"[^>]*>刷新工坊<\/button>/u);
});

test('admin review UI shows the project subtype rather than only the top-level character category', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../views/admin/projects.js', import.meta.url)),
    'utf8',
  );
  const views = fs.readFileSync(
    fileURLToPath(new URL('../app/views.js', import.meta.url)),
    'utf8',
  );

  assert.match(source, /function projectKindLabel\(project\)/u);
  assert.match(source, /kindLabels\?\.\[kind\]/u);
  assert.match(source, /detailRow\('作品类型', projectKindLabel\(project\)\)/u);
  assert.match(views, /kindLabels: PROJECT_KIND_LABELS/u);
});
