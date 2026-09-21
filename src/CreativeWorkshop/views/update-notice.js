export function createWorkshopUpdateNotice({
  element,
  button,
  openModal,
  host,
  selfUpdater,
  currentVersion,
  currentSha = '',
  onHotReload,
}) {
  let activeModal = null;
  let checking = null;
  let promptedSha = '';
  let dismissedSha = '';
  let updating = false;

  function loaderName(item) {
    const name = item.name || item.id || '未命名脚本';
    return item.folder ? `${item.folder} / ${name}` : name;
  }

  function openUpdateModal(result) {
    if (activeModal) return;
    promptedSha = result.latestSha;

    const modal = openModal('创意工坊更新', {
      onClose: () => {
        if (!updating) dismissedSha = result.latestSha;
        if (activeModal === modal) activeModal = null;
      },
    });
    activeModal = modal;

    const wrap = element('div', 'rw-hot-update');
    const hero = element('div', 'rw-hot-update-hero');
    hero.append(
      element('span', 'rw-hot-update-icon', '↻'),
      element('div', 'rw-hot-update-copy'),
    );
    hero.lastElementChild.append(
      element('strong', '', '发现新的创意工坊版本'),
      element(
        'div',
        '',
        `当前运行 v${currentVersion} · 最新提交 ${result.latestShortSha}`,
      ),
    );

    const info = element('div', 'rw-hot-update-info');
    info.append(
      element(
        'div',
        '',
        '点击更新后会自动修改 Tavern Helper 中的创意工坊载入脚本，只替换这个项目的固定提交链接；apiBase 和你写在载入脚本里的其他配置不会被覆盖。',
      ),
      element(
        'div',
        'rw-hot-update-loader',
        `将更新：${result.loaders.map(loaderName).join('、')}`,
      ),
    );

    const status = element('div', 'rw-hot-update-status');
    status.textContent = '更新完成后会尝试直接热载入新版；若浏览器阻止热载入，只需刷新一次酒馆即可。';

    const actions = element('div', 'rw-hot-update-actions');
    const later = button('稍后', '', () => {
      dismissedSha = result.latestSha;
      modal.close({ force: true });
    });
    const update = button('一键热更', 'primary rw-hot-update-primary', async () => {
      updating = true;
      later.disabled = true;
      status.className = 'rw-hot-update-status is-working';
      status.textContent = '正在写入最新载入链接…';

      try {
        const updated = await selfUpdater.updateLoaderLink();
        if (!updated.loaderFound) {
          throw new Error('没有找到可自动修改的创意工坊载入脚本');
        }

        status.textContent = updated.updated
          ? `已更新 ${updated.changedScripts} 个载入脚本到 ${updated.latestShortSha}，正在热载入新版…`
          : `载入脚本已经指向 ${updated.latestShortSha}，正在热载入新版…`;

        try {
          host.toastr?.success?.(
            updated.updated
              ? `已自动改写创意工坊载入脚本到 ${updated.latestShortSha}`
              : '载入脚本已经是最新固定链接',
            '创意工坊更新',
          );
        } catch {}

        await onHotReload(updated);
        status.className = 'rw-hot-update-status is-success';
        status.textContent = '新版已热载入。';
      } catch (error) {
        updating = false;
        later.disabled = false;
        status.className = 'rw-hot-update-status is-error';
        status.textContent = `热更失败：${error instanceof Error ? error.message : String(error)}\n载入脚本若已成功写入，刷新酒馆即可使用新版。`;
        throw error;
      }
    });

    actions.append(later, update);
    wrap.append(hero, info, status, actions);
    modal.body.appendChild(wrap);
  }

  async function check({ force = false } = {}) {
    if (checking) return checking;
    checking = (async () => {
      const result = await selfUpdater.check();
      const runtimeOutdated = Boolean(currentSha && currentSha !== result.latestSha);
      if (
        result.loaderFound &&
        (result.updateAvailable || runtimeOutdated) &&
        (force || (result.latestSha !== promptedSha && result.latestSha !== dismissedSha))
      ) {
        openUpdateModal(result);
      }
      return result;
    })();

    try {
      return await checking;
    } finally {
      checking = null;
    }
  }

  function destroy() {
    activeModal?.close?.({ force: true });
    activeModal = null;
  }

  return {
    check,
    destroy,
  };
}
