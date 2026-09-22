import { formatInstallHealth } from '../ui/install-messages.js';

export function createMaintenanceView({
  element,
  button,
  empty,
  openModal,
  confirmDialog,
  notifyError,
  host,
  projectService,
  selfUpdater,
  version,
  currentSha = '',
  hotUpdateClient,
}) {
  let activeModal = null;

  function statusBox(text, className = '') {
    return element('div', `rw-status ${className}`.trim(), text);
  }

  async function renderClientSection(container) {
    container.replaceChildren();
    container.className = 'rw-maintenance-section rw-maintenance-client';

    const head = element('div', 'rw-maintenance-section-head');
    const copy = element('div', '');
    copy.append(
      element('strong', '', '创意工坊更新'),
      element('div', 'rw-muted', `当前版本 v${version}`),
    );
    head.appendChild(copy);
    container.appendChild(head);

    const state = statusBox('正在检查更新…');
    container.appendChild(state);

    try {
      const result = await selfUpdater.check();
      state.remove();

      if (!result.loaderFound) {
        container.classList.add('rw-maintenance-client--problem');
        const problem = element('div', 'rw-update-state rw-update-state--problem');
        problem.append(
          element('strong', '', '未找到创意工坊载入脚本'),
          element('span', '', '无法自动更新。请确认工坊是通过 Tavern Helper 脚本加载。'),
        );
        container.appendChild(problem);
        return;
      }

      const loaderNames = result.loaders
        .map(item => item.folder ? `${item.folder} / ${item.name || item.id}` : (item.name || item.id || '未命名脚本'))
        .join('、');
      const channelLabel = result.channel === 'testing' ? '测试版' : '正式版';
      const runtimeOutdated = Boolean(currentSha && currentSha !== result.latestSha);
      const hasUpdate = result.updateAvailable || runtimeOutdated;

      if (hasUpdate) {
        container.classList.add('rw-maintenance-client--update');

        const updateState = element('div', 'rw-update-state rw-update-state--available');
        const badge = element('span', 'rw-update-badge', '发现新版本');
        const versions = element('div', 'rw-update-version-line');
        versions.append(
          element('strong', '', `v${version}`),
          element('span', '', '→'),
          element('strong', '', '最新版'),
        );
        updateState.append(
          badge,
          versions,
          element('div', 'rw-update-summary', '点击下面的按钮即可自动更新创意工坊。'),
        );
        container.appendChild(updateState);

        const updateButton = button('立即更新创意工坊', 'primary rw-maintenance-update-cta', async () => {
          updateButton.textContent = '正在更新…';
          const updated = typeof hotUpdateClient === 'function'
            ? await hotUpdateClient()
            : await selfUpdater.updateLoaderLink();
          if (!updated.loaderFound) throw new Error('没有找到可自动更新的创意工坊载入脚本');

          if (updated.alreadyRunningLatest) {
            try { host.toastr?.success?.('创意工坊已经是最新版本', '创意工坊'); } catch {}
            await renderClientSection(container);
            return;
          }

          updateButton.disabled = true;
          updateButton.textContent = '已更新 · 重新载入后生效';
          const done = statusBox(
            `载入脚本已写入 ${updated.latestShortSha}。重新载入酒馆后自动使用新版。`,
            'ok',
          );
          updateButton.insertAdjacentElement('afterend', done);

          try {
            host.toastr?.success?.(
              `载入脚本已更新到 ${updated.latestShortSha}；重新载入酒馆后生效。`,
              '创意工坊',
            );
          } catch {}
        });
        container.appendChild(updateButton);

        const details = element('details', 'rw-update-details');
        const summary = element('summary', '', '查看载入信息');
        const detailBody = element('div', 'rw-update-details-body');
        detailBody.appendChild(element('div', '', `更新通道：${channelLabel} · ${result.ref || '未知引用'}`));
        detailBody.appendChild(element('div', '', `目标提交：${result.latestShortSha}`));
        if (currentSha) {
          detailBody.appendChild(element('div', '', `当前运行：${currentSha.slice(0, 8)}`));
        }
        detailBody.appendChild(element('div', '', `载入脚本：${loaderNames}`));
        details.append(summary, detailBody);
        container.appendChild(details);
        return;
      }

      container.classList.add('rw-maintenance-client--latest');
      const latest = element('div', 'rw-update-state rw-update-state--latest');
      latest.append(
        element('strong', '', '✓ 已是最新版本'),
        element('span', '', `v${version}`),
      );
      container.appendChild(latest);

      const actions = element('div', 'rw-row rw-maintenance-client-actions');
      actions.appendChild(button('重新检查', '', () => renderClientSection(container)));

      const details = element('details', 'rw-update-details');
      const summary = element('summary', '', '高级');
      const detailBody = element('div', 'rw-update-details-body');
      detailBody.append(
        element('div', '', `更新通道：${channelLabel} · ${result.ref || '未知引用'}`),
        element('div', '', `载入脚本：${loaderNames}`),
        button('重新写入最新固定链接', '', async () => {
          const updated = await selfUpdater.updateLoaderLink();
          if (!updated.loaderFound) throw new Error('没有找到可自动更新的创意工坊载入脚本');
          try { host.toastr?.info?.('已重新写入最新固定链接', '创意工坊'); } catch {}
          await renderClientSection(container);
        }),
      );
      details.append(summary, detailBody);
      actions.appendChild(details);
      container.appendChild(actions);
    } catch (error) {
      container.classList.add('rw-maintenance-client--problem');
      const failed = element('div', 'rw-update-state rw-update-state--problem');
      failed.append(
        element('strong', '', '检查更新失败'),
        element('span', '', error.message),
      );
      container.appendChild(failed);
    }
  }

  async function renderInstalledSection(container) {
    container.replaceChildren();
    const head = element('div', 'rw-maintenance-section-head');
    const copy = element('div', '');
    copy.append(
      element('strong', '', '已安装内容与恢复点'),
      element('div', 'rw-muted', '检查工坊资源是否缺失，并确认世界书/酒馆助手脚本的原版屏蔽状态仍可安全恢复。'),
    );
    head.appendChild(copy);

    const scanButton = button('重新扫描', '', () => renderInstalledSection(container));
    head.appendChild(scanButton);
    container.appendChild(head);

    const projects = (await projectService.installed()).filter(item => item.applied);
    if (!projects.length) {
      container.appendChild(statusBox('当前没有已安装到酒馆的工坊作品。', 'ok'));
      return;
    }

    const list = element('div', 'rw-maintenance-list');
    container.appendChild(list);
    for (const item of projects) {
      const row = element('article', 'rw-maintenance-item');
      const title = element('div', 'rw-maintenance-item-title');
      title.append(
        element('strong', '', item.name),
        element('span', 'rw-pill', `v${item.appliedVersion || item.version}`),
      );
      row.appendChild(title);
      const body = element('div', 'rw-muted', '正在检查…');
      row.appendChild(body);
      list.appendChild(row);

      try {
        const result = await projectService.inspectInstallation(item.id);
        if (result.health.healthy) {
          body.className = 'rw-status ok';
          body.textContent = '安装状态正常 · 恢复记录可用';
          continue;
        }
        body.className = result.health.repairable ? 'rw-status' : 'rw-status bad';
        body.textContent = formatInstallHealth(result.health);
        if (result.health.repairable) {
          row.appendChild(button('修复这个作品', 'primary', async () => {
            const repaired = await projectService.repair(item.id);
            if (!repaired.health.healthy) {
              throw new Error(`修复后仍有异常：\n${formatInstallHealth(repaired.health)}`);
            }
            try { host.toastr?.success?.('安装资源和屏蔽状态已修复', item.name); } catch {}
            await renderInstalledSection(container);
          }));
        }
      } catch (error) {
        body.className = 'rw-status bad';
        body.textContent = `检查失败：${error.message}`;
      }
    }
  }

  async function open() {
    activeModal?.close();
    const modal = openModal('工坊维护与 DLC 修复', {
      wide: true,
      onClose: () => { if (activeModal === modal) activeModal = null; },
    });
    activeModal = modal;
    modal.body.replaceChildren();

    const intro = element('div', 'rw-maintenance-protection');
    intro.append(
      element('strong', '', '已自动保护原版内容'),
      element('div', '', '工坊项目只拥有自己创建的资源；作者声明要控制的原世界书、正则或酒馆助手脚本会先记录安装前状态，再按规则启用/停用。关闭或卸载作品时自动恢复。'),
    );
    modal.body.appendChild(intro);

    const client = element('section', 'rw-maintenance-section');
    const installed = element('section', 'rw-maintenance-section');
    modal.body.append(client, installed);

    await Promise.allSettled([
      renderClientSection(client),
      renderInstalledSection(installed),
    ]);
  }

  return { open };
}
