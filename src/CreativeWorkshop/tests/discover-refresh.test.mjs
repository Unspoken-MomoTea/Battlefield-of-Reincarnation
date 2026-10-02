import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createProjectApi } from '../services/api/projects.js';
import { workshopTemplate } from '../ui/template.js';
import { filterProjectsForScope } from '../views/discover.js';

test('discover scope rejects projects leaked from another subtype', () => {
  const items = [
    { id: 'world', category: 'character', kind: 'world_character' },
    { id: 'opening', category: 'character', kind: 'opening_character' },
    { id: 'partner', category: 'character', kind: 'opening_partner' },
    { id: 'store', category: 'extension', kind: 'store_catalog' },
  ];

  assert.deepEqual(
    filterProjectsForScope(items, 'character', 'opening_partner').map(item => item.id),
    ['partner'],
  );
  assert.deepEqual(
    filterProjectsForScope(items, 'extension', 'store_catalog').map(item => item.id),
    ['store'],
  );
});

test('workshop exposes a manual refresh that clears discovery cache and reloads the active view', () => {
  const html = workshopTemplate('test');
  const events = readFileSync(
    fileURLToPath(new URL('../app/events.js', import.meta.url)),
    'utf8',
  );
  const discover = readFileSync(
    fileURLToPath(new URL('../views/discover.js', import.meta.url)),
    'utf8',
  );

  assert.match(html, /data-action="refresh-workshop"[^>]*>刷新工坊<\/button>/u);
  assert.match(events, /views\.discover\.invalidate\(\)/u);
  assert.match(events, /views\.discover\.refreshCurrent\(\{ force: true \}\)/u);
  assert.match(discover, /async function refreshCurrent\(\{ force = false \} = \{\}\)/u);
});

test('public catalog requests bypass browser HTTP cache', async () => {
  const calls = [];
  const api = createProjectApi((path, init) => {
    calls.push({ path, init });
    return Promise.resolve({ items: [], next_offset: null });
  }, async () => { throw new Error('unused'); });

  await api.listProjects('', 'character', 0, '', 'latest', 'opening_character');
  assert.match(calls[0].path, /category=character/u);
  assert.match(calls[0].path, /kind=opening_character/u);
  assert.equal(calls[0].init?.cache, 'no-store');
});
