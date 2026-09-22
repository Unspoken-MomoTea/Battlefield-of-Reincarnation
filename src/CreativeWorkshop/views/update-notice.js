export function createWorkshopUpdateNotice({
  element,
  button,
  openModal,
  host,
  selfUpdater,
  currentVersion,
  currentSha = '',
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

  function setProgress(progress, state, title, description = '') {
    progress.hidden = false;
    progress.className = `rw-hot-update-progress rw-hot-update-progress--${state}`;

    const icon = progress.querySelector('[data-role="hot-update-progress-icon"]');
    const titleNode = progress.querySelector('[data-role="hot-update-progress-title"]');
    const descriptionNode = progress.querySelector('[data-role="hot-update-progress-description"]');

    icon.textContent = state === 'error' ? '!' : state === 'success' ? '✓' : '↻';
    titleNode.textContent = title;
    descriptionNode.textContent = description;
    descriptionNode.hidden = !description;
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

    const closeButton = modal.panel.querySelector('.rw-modal-close');
    const wrap = element('div', 'rw-hot-update');

    const hero = element('section', 'rw-hot-update-card');
    const heading = element('div', 'rw-hot-update-heading');
    const copy = element('div', 'rw-hot-update-title-copy');
    copy.append(
      element('span', 'rw-hot-update-badge', '发现新版本'),
      element('strong', '', '新版创意工坊已就绪'),
      element('p', '', '无需复制链接，点击一次即可完成更新。'),
    );
    heading.append(
      element('span', 'rw-hot-update-mark', '↑'),
      copy,
    );

    const versionLine = element('div', 'rw-hot-update-version');
    const current = element('div', 'rw-hot-update-version-item');
    current.append(
      element('span', '', '当前版本'),
      element('strong', '', `v${currentVersion}`),
    );
    const next = element('div', 'rw-hot-update-version-item rw-hot-update-version-item--next');
    next.append(
      element('span', '', '更新到'),
      element('strong', '', '最新版本'),
    );
    versionLine.append(
      current,
      element('span', 'rw-hot-update-version-arrow', '→'),
      next,
    );

    const promises = element('div', 'rw-hot-update-promises');
    promises.append(
      element('span', '', '✓ 自动更新载入脚本'),
      element('span', '', '✓ 保留现有配置'),
      element('span', '', '✓ 下次载入自动使用新版'),
    );

    hero.append(heading, versionLine, promises);

    const progress = element('div', 'rw-hot-update-progress');
    progress.hidden = true;
    const progressIcon = element('span', 'rw-hot-update-progress-icon', '↻');
    progressIcon.dataset.role = 'hot-update-progress-icon';
    const progressCopy = element('div', 'rw-hot-update-progress-copy');
    const progressTitle = element('strong', '', '');
    progressTitle.dataset.role = 'hot-update-progress-title';
    const progressDescription = element('span', '', '');
    progressDescription.dataset.role = 'hot-update-progress-description';
    progressCopy.append(progressTitle, progressDescription);
    progress.append(progressIcon, progressCopy);

    const details = element('details', 'rw-hot-update-details');
    const detailsSummary = element('summary', '', '更新详情');
    const detailsBody = element('div', 'rw-hot-update-details-body');
    const channelLabel = result.channel === 'testing' ? '测试版' : '正式版';
    detailsBody.append(
      element('div', '', `更新通道：${channelLabel} · ${result.ref || '未知引用'}`),
      element('div', '', `目标版本：${result.latestShortSha}`),
      currentSha ? element('div', '', `当前运行：${currentSha.slice(0, 8)}`) : element('div', '', `当前运行：v${currentVersion}`),
      element('div', '', `载入脚本：${result.loaders.map(loaderName).join('、')}`),
      element('div', '', '只会替换创意工坊的固定提交链接，apiBase 与脚本里的其他配置会保留。'),
      element('div', '', '更新完成后会直接保存新的固定提交链接；重新载入酒馆后使用新版。'),
    );
    details.append(detailsSummary, detailsBody);

    const actions = element('div', 'rw-hot-update-actions');
    const later = button('稍后', 'rw-hot-update-later', () => {
      dismissedSha = result.latestSha;
      modal.close({ force: true });
    });
    const update = button('立即更新创意工坊', 'primary rw-hot-update-primary', async () => {
      if (updating) return;

      updating = true;
      update.disabled = true;
      later.disabled = true;
      if (closeButton) closeButton.disabled = true;
      update.textContent = '正在更新…';
      setProgress(progress, 'working', '正在更新载入脚本', '请保持创意工坊打开，通常只需要几秒。');

      try {
        const updated = await selfUpdater.updateLoaderLink();
        if (!updated.loaderFound) {
          throw new Error('没有找到可自动修改的创意工坊载入脚本');
        }

        if (currentSha && updated.latestSha === currentSha) {
          setProgress(progress, 'success', '更新完成', '载入脚本已同步，当前运行的就是最新版。');
          update.textContent = '已是最新版本';
          later.textContent = '完成';
          later.disabled = false;
          if (closeButton) closeButton.disabled = false;
          updating = false;
          return;
        }

        updating = false;
        later.disabled = false;
        if (closeButton) closeButton.disabled = false;
        update.disabled = true;
        update.textContent = '更新完成';
        later.textContent = '关闭';
        setProgress(
          progress,
          'success',
          '载入脚本已更新',
          `新版 ${updated.latestShortSha} 已写入 Tavern Helper。重新载入酒馆后自动使用新版。`,
        );

        try {
          host.toastr?.success?.(
            `载入脚本已更新到 ${updated.latestShortSha}；重新载入酒馆后生效。`,
            '创意工坊',
          );
        } catch {}
      } catch (error) {
        updating = false;
        update.disabled = false;
        later.disabled = false;
        if (closeButton) closeButton.disabled = false;
        update.textContent = '重试更新';

        setProgress(
          progress,
          'error',
          '更新没有完成',
          `${error instanceof Error ? error.message : String(error)}\n未能完成载入脚本写入。`,
        );
      }
    });

    actions.append(later, update);
    wrap.append(hero, progress, details, actions);
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
