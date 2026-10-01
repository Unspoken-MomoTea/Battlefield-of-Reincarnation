import { exportOpeningBuild } from './commit-flow.js';

/**
 * 开局提交桥接。
 * 不直接修改正式状态，由宿主系统监听事件接管。
 */
export function commitOpening() {
  const build = exportOpeningBuild();

  const detail = {
    source: 'opening',
    build,
    timestamp: Date.now(),
  };

  window.dispatchEvent(new CustomEvent('opening:commit', {
    detail,
  }));

  return detail;
}

window.SamsaraOpeningCommit = { commitOpening };
