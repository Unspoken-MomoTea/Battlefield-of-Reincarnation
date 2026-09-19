import assert from 'node:assert/strict';
import test from 'node:test';

import { createDatabaseCoordinator } from '../services/storage/lifecycle.js';

class FakeChannel {
  static channels = new Map();

  constructor(name) {
    this.name = name;
    this.onmessage = null;
    const list = FakeChannel.channels.get(name) ?? [];
    list.push(this);
    FakeChannel.channels.set(name, list);
  }

  postMessage(data) {
    for (const channel of FakeChannel.channels.get(this.name) ?? []) {
      if (channel !== this) channel.onmessage?.({ data });
    }
  }

  close() {
    const list = FakeChannel.channels.get(this.name) ?? [];
    FakeChannel.channels.set(this.name, list.filter(channel => channel !== this));
  }
}

test('database coordinator closes local and other-tab connections before upgrade', () => {
  const hostA = new EventTarget();
  const hostB = new EventTarget();
  let closedA = 0;
  let closedB = 0;

  const a = createDatabaseCoordinator({
    host: hostA,
    BroadcastChannelCtor: FakeChannel,
    onClose: () => { closedA += 1; },
  });
  const b = createDatabaseCoordinator({
    host: hostB,
    BroadcastChannelCtor: FakeChannel,
    onClose: () => { closedB += 1; },
  });

  a.requestCloseForUpgrade(4);

  assert.equal(closedA, 1);
  assert.equal(closedB, 1);

  a.dispose();
  b.dispose();
});

test('database coordinator ignores unrelated broadcast messages', () => {
  const host = new EventTarget();
  let closed = 0;
  const coordinator = createDatabaseCoordinator({
    host,
    BroadcastChannelCtor: FakeChannel,
    onClose: () => { closed += 1; },
  });
  const foreign = new FakeChannel('reincarnation-workshop-db');
  foreign.postMessage({ type: 'unrelated' });
  assert.equal(closed, 0);
  coordinator.dispose();
  foreign.close();
});
