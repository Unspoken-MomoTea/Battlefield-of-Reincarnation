import assert from 'node:assert/strict';
import test from 'node:test';

import { createInstalledView } from '../views/installed.js';

class FakeNode {
  constructor(text = '') {
    this.textContent = text;
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.title = '';
    this.className = '';
    this.classList = {
      add() {},
      remove() {},
      toggle() {},
    };
  }

  append(...children) { this.children.push(...children.filter(Boolean)); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children.filter(Boolean); }
  setAttribute() {}
}

function textOf(node) {
  if (!node) return '';
  return [node.textContent, ...node.children.map(textOf)].filter(Boolean).join(' ');
}

test('installed view automatically surfaces a newer remote version on the local card', async () => {
  const calls = [];
  const installedList = new FakeNode();
  const checkAllUpdates = new FakeNode('检查全部更新');

  const view = createInstalledView({
    nodes: {
      installedList,
      checkAllUpdates,
    },
    element: (_tag, className = '', text = '') => {
      const node = new FakeNode(text);
      node.className = className;
      return node;
    },
    button: (label, className = '', onClick = null) => {
      const node = new FakeNode(label);
      node.className = className;
      node.onClick = onClick;
      return node;
    },
    empty: (node, message) => node.replaceChildren(new FakeNode(message)),
    confirmDialog: async () => false,
    openModal: () => ({ body: new FakeNode() }),
    projectService: {
      installed: async () => [{
        id: 'remote-1',
        name: '测试扩展',
        category: 'extension',
        source: 'remote',
        version: 1,
        applied: true,
        appliedVersion: 1,
        updatedAt: 1,
        manifest: { artifact_count: 1 },
        dependencies: [],
      }],
      checkAllUpdates: async force => {
        calls.push(force);
        return {
          checkedAt: 123,
          fromCache: false,
          items: [{
            id: 'remote-1',
            name: '测试扩展',
            localVersion: 1,
            remoteVersion: 2,
            updateAvailable: true,
            unavailable: false,
          }],
        };
      },
    },
    workshopApi: {},
    host: {},
    doc: {},
    categoryLabels: { extension: '扩展' },
  });

  await view.refresh();

  assert.deepEqual(calls, [false]);
  const rendered = textOf(installedList);
  assert.match(rendered, /有更新 v2/u);
  assert.match(rendered, /更新项目 · v2/u);
  assert.equal(checkAllUpdates.textContent, '检查全部更新 · 1');
});


test('background update check records update state without forcing the Installed library to render', async () => {
  let installedCalls = 0;
  const notices = [];
  const checkAllUpdates = new FakeNode('检查全部更新');

  const view = createInstalledView({
    nodes: {
      installedList: new FakeNode(),
      checkAllUpdates,
    },
    element: (_tag, className = '', text = '') => {
      const node = new FakeNode(text);
      node.className = className;
      return node;
    },
    button: (label, className = '', onClick = null) => {
      const node = new FakeNode(label);
      node.className = className;
      node.onClick = onClick;
      return node;
    },
    empty: (node, message) => node.replaceChildren(new FakeNode(message)),
    confirmDialog: async () => false,
    openModal: () => ({ body: new FakeNode() }),
    projectService: {
      installed: async () => {
        installedCalls += 1;
        return [];
      },
      checkAllUpdates: async force => {
        assert.equal(force, false);
        return {
          checkedAt: 456,
          fromCache: false,
          items: [{
            id: 'remote-1',
            name: '测试扩展',
            localVersion: 1,
            remoteVersion: 2,
            updateAvailable: true,
            unavailable: false,
          }],
        };
      },
    },
    workshopApi: {},
    host: {
      toastr: {
        info(message, title) { notices.push({ message, title }); },
      },
    },
    doc: {},
    categoryLabels: { extension: '扩展' },
  });

  await view.checkAllUpdates(false, { automatic: true, refresh: false });

  assert.equal(installedCalls, 0);
  assert.equal(checkAllUpdates.textContent, '检查全部更新 · 1');
  assert.equal(notices.length, 1);
  assert.equal(notices[0].title, '创意工坊 · 发现更新');
});


test('enabled up-to-date project uses stop and restore as its primary action instead of check update', async () => {
  const installedList = new FakeNode();
  const view = createInstalledView({
    nodes: {
      installedList,
      checkAllUpdates: new FakeNode('检查全部更新'),
    },
    element: (_tag, className = '', text = '') => {
      const node = new FakeNode(text);
      node.className = className;
      return node;
    },
    button: (label, className = '', onClick = null) => {
      const node = new FakeNode(label);
      node.className = className;
      node.onClick = onClick;
      return node;
    },
    empty: (node, message) => node.replaceChildren(new FakeNode(message)),
    confirmDialog: async () => false,
    openModal: () => ({ body: new FakeNode() }),
    projectService: {
      installed: async () => [{
        id: 'remote-1',
        name: '测试扩展',
        category: 'extension',
        source: 'remote',
        version: 3,
        applied: true,
        appliedVersion: 3,
        updatedAt: 1,
        manifest: { artifact_count: 1 },
        dependencies: [],
      }],
      checkAllUpdates: async () => ({
        fromCache: false,
        items: [{
          id: 'remote-1',
          name: '测试扩展',
          localVersion: 3,
          remoteVersion: 3,
          updateAvailable: false,
          unavailable: false,
        }],
      }),
    },
    workshopApi: {},
    host: {},
    doc: {},
    categoryLabels: { extension: '扩展' },
  });

  await view.refresh();
  const rendered = textOf(installedList);
  assert.match(rendered, /已启用 v3/u);
  assert.match(rendered, /停用并还原/u);
  assert.doesNotMatch(rendered, /检查更新/u);
});
