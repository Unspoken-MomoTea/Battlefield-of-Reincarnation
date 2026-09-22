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

test('Windows release launcher exposes one unambiguous menu and one implementation label per action', () => {
  for (const label of [
    'MENU',
    'UPDATE_STAGING',
    'PUBLISH_STABLE',
    'UPDATE_PRODUCTION',
    'UPDATE_BOTH',
    'CHECK_STAGING',
    'CHECK_PRODUCTION',
    'CHECK_BOTH',
    'PUBLISH_PREVIEW',
    'STATUS',
    'RUN_PUBLISH',
    'RUN_SERVER',
    'AFTER',
  ]) {
    assert.equal(labelCount(label), 1, 'duplicate or missing BAT label: ' + label);
  }

  assert.equal(labelCount('RUN'), 0);
  assert.match(launcher, /创意工坊发布工具/u);
  assert.match(launcher, /发布正式客户端/u);
  assert.match(launcher, /更新正式服务器/u);
  assert.match(launcher, /workshop-stable \+ workshop-vX\.Y\.Z/u);
  assert.doesNotMatch(launcher, /git -C "%ROOT%" fetch/u);
  assert.match(launcher, /choice \/c RQ/u);
  assert.doesNotMatch(launcher, /echo \[0\] 关闭工具/u);
});

test('legacy updater shortcut delegates to the root BAT launcher', () => {
  const wrapper = fs.readFileSync(
    fileURLToPath(new URL('../../src/CreativeWorkshop/update-servers.cmd', import.meta.url)),
    'utf8',
  );
  assert.match(wrapper, /创意工坊更新工具\.bat/u);
});
