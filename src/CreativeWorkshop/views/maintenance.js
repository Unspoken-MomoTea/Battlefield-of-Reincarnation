import { formatInstallHealth } from '../ui/install-messages.js';

export function createMaintenanceView({
  element,
  button,
  empty,
  openModal,
  notifyError,
  host,
  projectService,
  selfUpdater,
  version,
}) {
  let activeModal = null;

  function statusBox(text, className = '') {
    return element('div', `rw-status ${className}`.trim(), text);
  }

  async function renderClientSection(container) {
    container.replaceChildren();
    const head = element('div', 'rw-maintenance-section-head');
    const copy = element('div', '');
    copy.append(
      element('strong', '', '创意工坊客户端'),
      element('div', 'rw-muted', `当前运行版本 v${version} · 自动检查酒馆助手中的工坊载入脚本`),
    );
    head.appendChild(copy);
    container.appendChild(head);

    const state = statusBox('正在检查最新提交与载入链接…');
    container.appendChild(state);

    try {
      const result = await selfUpdater.check();
      state.className = 'rw-status';
      if (!result.loaderFound) {
        state.className = 'rw-status bad';
        state.textContent = `未找到工坊载入脚本。最新提交 ${result.latestShortSha}；当前可能不是通过酒馆助手脚本树加载。`;
        return;
      }

      const loaderNames = result.loaders
        .map(item => item.folder ? `${item.folder} / ${item.name || item.id}` : (item.name || item.id || '未命名脚本'))
        .join('、');
      state.className = result.updateAvailable ? 'rw-status' : 'rw-status ok';
      state.textContent = result.updateAvailable
        ? `检测到新的 main 提交 ${result.latestShortSha}。载入脚本：${loaderNames}`
        : `载入链接已指向最新提交 ${result.latestShortSha}。载入脚本：${loaderNames}`;

      const actions = element('div', 'rw-row');
      actions.appendChild(button(
        result.updateAvailable ? '一键更新载入链接' : '重新写入最新固定链接',
        result.updateAvailable ? 'primary' : '',
        async () => {
          const updated = await selfUpdater.updateLoaderLink();
          if (!updated.loaderFound) throw new Error('没有找到可自动更新的工坊载入脚本');
          if (updated.updated) {
            try {
              host.toastr?.success?.(
                `已自动更新 ${updated.changedScripts} 个载入脚本到 ${updated.latestShortSha}，刷新酒馆后生效`,
                '创意工坊',
              );
            } catch {}
          } else {
            try { host.toastr?.info?.('载入链接已经是最新固定提交', '创意工坊'); } catch {}
          }
          await renderClientSection(container);
        },
      ));
      actions.appendChild(button('刷新酒馆', '', () => {
        const confirmed = host.confirm?.('刷新酒馆页面以加载新的工坊脚本？未保存的输入内容可能丢失。');
        if (confirmed) host.location?.reload?.();
      }));
      container.appendChild(actions);
    } catch (error) {
      state.className = 'rw-status bad';
      state.textContent = `检查失败：${error.message}`;
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
      element('div', '', '工坊项目只拥有自己创建的资源；作者声明需要替换的世界书条目或酒馆助手脚本会先记录原状态，再临时关闭。关闭/卸载该创意时自动恢复。'),
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
