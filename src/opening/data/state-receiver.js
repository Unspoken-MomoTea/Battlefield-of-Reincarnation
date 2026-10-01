/**
 * 开局提交接收桥。
 *
 * 开局模块只负责产生 opening:commit。
 * 正式状态系统可以监听该事件并接管写入。
 * 这里提供统一入口，避免组件直接污染全局状态。
 */

function normalizeOpeningBuild(detail = {}) {
  return detail.build || detail;
}

export function applyOpeningCommit(detail = {}) {
  const build = normalizeOpeningBuild(detail);

  window.dispatchEvent(new CustomEvent('samsara:opening-build-ready', {
    detail: {
      source: 'opening',
      build,
      timestamp: Date.now(),
    },
  }));

  return build;
}

function registerReceiver() {
  window.addEventListener('opening:commit', event => {
    applyOpeningCommit(event.detail);
  });
}

registerReceiver();

window.SamsaraOpeningReceiver = { applyOpeningCommit };
