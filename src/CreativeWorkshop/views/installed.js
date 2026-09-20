import { formatInstallConflicts, formatInstallHealth } from '../ui/install-messages.js';

export function createInstalledView({
  nodes,
  element,
  button,
  empty,
  projectService,
  host,
  doc,
  categoryLabels,
}) {
  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }

  async function manageStorage() {
    const estimate = await projectService.storageEstimate();
    const origin = estimate.originQuota > 0
      ? `浏览器站点存储：${formatBytes(estimate.originUsage)} / ${formatBytes(estimate.originQuota)}\n`
      : '';
    const summary =
      `工坊本地记录：${estimate.projectCount} 个\n` +
      `已安装：${estimate.appliedCount} 个\n` +
      `仅缓存：${estimate.cacheOnlyCount} 个\n` +
      `工坊记录逻辑大小：${formatBytes(estimate.logicalBytes)}\n` +
      `可清理缓存约：${formatBytes(estimate.cacheOnlyBytes)}\n` +
      origin;

    if (!estimate.cacheOnlyCount) {
      try { host.toastr?.info?.(summary, '创意工坊 · 存储管理'); } catch {}
      return estimate;
    }

    const confirmed = host.confirm?.(
      `${summary}\n是否删除全部“仅缓存”作品？\n\n已安装到酒馆的作品不会被删除。`,
    );
    if (!confirmed) return estimate;

    const result = await projectService.cleanupCacheOnly();
    try {
      host.toastr?.success?.(`已清理 ${result.removedCount} 个仅缓存作品`, '创意工坊 · 存储管理');
    } catch {}
    await refreshInstalled();
    return result;
  }

  async function checkAllUpdates(force = false) {
    const result = await projectService.checkAllUpdates(force);
    const updates = result.items.filter(item => item.updateAvailable);
    const unavailable = result.items.filter(item => item.unavailable);
    const message = updates.length
      ? `${updates.length} 个作品有更新：${updates.map(item => `${item.name} → v${item.remoteVersion}`).join('、')}`
      : '所有可查询作品均已是最新版本';
    try {
      host.toastr?.info?.(
        unavailable.length ? `${message}；另有 ${unavailable.length} 个作品当前不可用` : message,
        result.fromCache ? '创意工坊 · 缓存检查结果' : '创意工坊 · 更新检查',
      );
    } catch {}
    return result;
  }

  async function refreshInstalled() {
    const installed = (await projectService.installed()).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!installed.length) return empty(nodes.installedList, '还没有下载任何作品');
    const cards = installed.map(item => {
      const card = element('article', 'rw-card');
      card.appendChild(element('h3', '', item.name));
      const meta = element('div', 'rw-meta');
      meta.append(element('span', 'rw-pill', categoryLabels[item.category] || item.category));
      meta.append(element('span', 'rw-pill', `缓存 v${item.version}`));
      if (item.applied) {
        meta.append(
          element(
            'span',
            'rw-pill',
            item.appliedVersion === item.version ? `已应用 v${item.appliedVersion}` : `已应用 v${item.appliedVersion} · 待升级`,
          ),
        );
        if (item.targetCharacterName) meta.append(element('span', 'rw-pill', `角色：${item.targetCharacterName}`));
      } else {
        meta.append(element('span', 'rw-pill', '仅缓存'));
      }
      card.appendChild(meta);
      if (item.applyError) card.appendChild(element('div', 'rw-status bad', `上次安装失败：${item.applyError}`));
      if (item.repairState?.lastCheckedAt) {
        meta.append(
          element(
            'span',
            'rw-pill',
            item.repairState.healthy ? '安装正常' : `发现 ${item.repairState.issues?.length || 0} 项异常`,
          ),
        );
      }

      const actions = element('div', 'rw-row');
      actions.appendChild(
        button(item.applied ? (item.appliedVersion === item.version ? '重新应用' : '应用新版') : '安装到酒馆', 'primary', async () => {
          const preflight = await projectService.preflight(item.id);
          if (preflight.blocking.length) {
            throw new Error(`当前无法安装：\n${formatInstallConflicts(preflight.blocking)}`);
          }
          if (preflight.warnings.length) {
            const confirmed = host.confirm?.(
              `安装前发现以下冲突：\n\n${formatInstallConflicts(preflight.warnings)}\n\n是否继续？`,
            );
            if (!confirmed) return;
          }
          const result = await projectService.apply(item.id);
          try { host.toastr?.success?.(`已应用 ${result.name} v${result.appliedVersion}`, '创意工坊'); } catch {}
          await refreshInstalled();
        }),
      );
      if (item.applied) {
        actions.appendChild(
          button('检查安装', '', async () => {
            const result = await projectService.inspectInstallation(item.id);
            if (result.health.healthy) {
              try { host.toastr?.success?.('安装状态正常', item.name); } catch {}
              await refreshInstalled();
              return;
            }
            const summary = formatInstallHealth(result.health);
            if (!result.health.repairable) {
              try { host.toastr?.error?.(summary, `${item.name} · 无法自动修复`); } catch {}
              await refreshInstalled();
              return;
            }
            const confirmed = host.confirm?.(`发现以下安装异常：\n\n${summary}\n\n是否立即修复？`);
            if (confirmed) {
              const repaired = await projectService.repair(item.id);
              if (!repaired.health.healthy) throw new Error(`修复后仍有异常：\n${formatInstallHealth(repaired.health)}`);
              try { host.toastr?.success?.('安装资源已经修复', item.name); } catch {}
            }
            await refreshInstalled();
          }),
        );
        actions.appendChild(
          button('卸载', 'danger', async () => {
            await projectService.uninstall(item.id);
            try { host.toastr?.success?.(`已卸载 ${item.name}`, '创意工坊'); } catch {}
            await refreshInstalled();
          }),
        );
      }
      actions.appendChild(button('检查更新', '', async () => {
        const result = await projectService.checkUpdate(item.id);
        if (!result.updateAvailable) {
          try { host.toastr?.info?.('本地缓存已经是服务器最新版本', item.name); } catch {}
          return;
        }
        const shouldSync = host.confirm?.(
          `服务器已有 v${result.remoteVersion}。是否立即下载最新版${item.applied ? '并重新应用到酒馆' : ''}？`,
        );
        if (!shouldSync) return;
        const updated = await projectService.updateLatest(item.id);
        try {
          host.toastr?.success?.(
            item.applied ? `已一键升级并应用到 v${updated.version}` : `已同步缓存到 v${updated.version}`,
            item.name,
          );
        } catch {}
        await refreshInstalled();
      }));
      actions.appendChild(button('导出离线包', '', async () => {
        const exported = await projectService.exportCached(item.id);
        const url = host.URL.createObjectURL(exported.blob);
        try {
          const anchor = doc.createElement('a');
          anchor.href = url;
          anchor.download = exported.filename;
          doc.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        } finally {
          host.setTimeout(() => host.URL.revokeObjectURL(url), 1000);
        }
      }));
      if (!item.applied) {
        actions.appendChild(button('删除本地缓存', 'danger', async () => {
          await projectService.removeCached(item.id);
          await refreshInstalled();
        }));
      }
      card.appendChild(actions);
      return card;
    });
    nodes.installedList.replaceChildren(...cards);
  }
  return { refresh: refreshInstalled, checkAllUpdates, manageStorage };
}
