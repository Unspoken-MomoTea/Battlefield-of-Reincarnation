/**
 * 开局宿主适配层。
 *
 * 不强行依赖状态系统实现，优先调用宿主暴露的写入接口。
 * 未接入时只保留事件，方便测试环境运行。
 */

function handleOpeningBuild(event) {
  const detail = event.detail || {};
  const build = detail.build || {};

  const host = window.Samsara || {};

  if (typeof host.applyOpeningBuild === 'function') {
    host.applyOpeningBuild(build);
    return;
  }

  if (typeof window.applyOpeningBuild === 'function') {
    window.applyOpeningBuild(build);
    return;
  }

  window.dispatchEvent(new CustomEvent('samsara:opening-build-unhandled', {
    detail: {
      build,
      reason: 'host-adapter-missing',
    },
  }));
}

window.addEventListener('samsara:opening-build-ready', handleOpeningBuild);

window.SamsaraOpeningHostAdapter = {
  handleOpeningBuild,
};
