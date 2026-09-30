import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const launcher = fs.readFileSync(
  fileURLToPath(new URL('../../创意工坊更新工具.bat', import.meta.url)),
  'utf8',
);

function labelCount(label) {
  const pattern = new RegExp('^:' + label + '$', 'gmu');
  return [...launcher.matchAll(pattern)].length;
}

test('Windows launcher separates workshop and world engine release actions', () => {
  for (const label of [
    'MENU',
    'UPDATE_STAGING',
    'PUBLISH_WORKSHOP',
    'PUBLISH_WORLD',
    'UPDATE_PRODUCTION',
    'UPDATE_BOTH',
    'CHECK_STAGING',
    'CHECK_PRODUCTION',
    'PUBLISH_WORKSHOP_PREVIEW',
    'STATUS',
    'RUN_WORKSHOP_PUBLISH',
    'RUN_WORLD_PUBLISH',
    'RUN_SERVER',
    'AFTER',
  ]) {
    assert.equal(labelCount(label), 1, 'duplicate or missing BAT label: ' + label);
  }

  assert.match(launcher, /发布创意工坊正式版/u);
  assert.match(launcher, /workshop-vX\.Y\.Z/u);
  assert.match(launcher, /发布世界推进正式版/u);
  assert.match(launcher, /world-engine-vX\.Y\.Z/u);
  assert.match(launcher, /只读取 WORKSHOP_VERSION，不修改世界推进版本/u);
  assert.match(launcher, /只读取 WORLD_ENGINE_VERSION，不推进 workshop-stable/u);
  assert.doesNotMatch(launcher, /自动读取统一版本/u);
  assert.doesNotMatch(launcher, /workshop-stable \+ VX\.Y\.Z/u);
  assert.doesNotMatch(launcher, /git -C "%ROOT%" fetch/u);
  assert.match(launcher, /choice \/c RQ/u);
});

test('legacy updater shortcut delegates to the root BAT launcher', () => {
  const wrapper = fs.readFileSync(
    fileURLToPath(new URL('../../src/CreativeWorkshop/update-servers.cmd', import.meta.url)),
    'utf8',
  );
  assert.match(wrapper, /创意工坊更新工具\.bat/u);
});
