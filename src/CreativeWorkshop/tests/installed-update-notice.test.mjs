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
  assert.match(rendered, /升级到 v2/u);
  assert.equal(checkAllUpdates.textContent, '检查全部更新 · 1');
});
