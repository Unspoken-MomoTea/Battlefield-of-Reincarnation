import { formatInstallConflicts, formatInstallHealth } from '../ui/install-messages.js';

export function createInstalledView({
  nodes,
  element,
  button,
  empty,
  projectService,
  workshopApi,
  host,
  doc,
  categoryLabels,
}) {
  function showRestoreWarnings(result, name) {
    const warnings = Array.isArray(result?.restoreWarnings) ? result.restoreWarnings : [];
    if (!warnings.length) return;
    try {
      host.toastr?.warning?.(
        warnings.join('\n'),
        `${name} · 原版内容恢复提示`,
      );
    } catch {}
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }

  function artifactCount(item) {
    if (Number.isFinite(Number(item.manifest?.artifact_count))) return Number(item.manifest.artifact_count);
    return Array.isArray(item.manifest?.artifacts) ? item.manifest.artifacts.length : 0;
  }

  function installedState(item) {
    if (!item.applied) return { label: '已下载', className: 'cached' };
    if (Number(item.appliedVersion || 0) < Number(item.version)) {
      return { label: `待应用 v${item.version}`, className: 'update' };
    }
    if (item.repairState?.lastCheckedAt && !item.repairState.healthy) {
      return { label: '安装异常', className: 'bad' };
    }
    return { label: `已安装 v${item.appliedVersion}`, className: 'installed' };
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

  async function applyItem(item) {
    const preflight = await projectService.preflight(item.id);
    if (preflight.blocking.length) {
      throw new Error(`当前无法安装：\n${formatInstallConflicts(preflight.blocking)}`);
    }
    if (preflight.warnings.length) {
      const confirmed = host.confirm?.(
        `安装前发现以下冲突：\n\n${formatInstallConflicts(preflight.warnings)}\n\n是否继续？`,
      );
      if (!confirmed) return null;
    }
    const result = await projectService.apply(item.id);
    try { host.toastr?.success?.(`已应用 ${result.name} v${result.appliedVersion}`, '创意工坊'); } catch {}
    showRestoreWarnings(result, item.name);
    await refreshInstalled();
    return result;
  }

  async function inspectAndRepair(item) {
    const result = await projectService.inspectInstallation(item.id);
    if (result.health.healthy) {
      try { host.toastr?.success?.('安装状态正常', item.name); } catch {}
      await refreshInstalled();
      return result;
    }
    const summary = formatInstallHealth(result.health);
    if (!result.health.repairable) {
      try { host.toastr?.error?.(summary, `${item.name} · 无法自动修复`); } catch {}
      await refreshInstalled();
      return result;
    }
    const confirmed = host.confirm?.(`发现以下安装异常：\n\n${summary}\n\n是否立即修复？`);
    if (confirmed) {
      const repaired = await projectService.repair(item.id);
      if (!repaired.health.healthy) {
        throw new Error(`修复后仍有异常：\n${formatInstallHealth(repaired.health)}`);
      }
      try { host.toastr?.success?.('安装资源已经修复', item.name); } catch {}
    }
    await refreshInstalled();
    return result;
  }

  async function checkUpdate(item) {
    const result = await projectService.checkUpdate(item.id);
    if (!result.updateAvailable) {
      try { host.toastr?.info?.('本地缓存已经是服务器最新版本', item.name); } catch {}
      return result;
    }
    const shouldSync = host.confirm?.(
      `服务器已有 v${result.remoteVersion}。是否立即下载最新版${item.applied ? '并重新应用到酒馆' : ''}？`,
    );
    if (!shouldSync) return result;
    const updated = await projectService.updateLatest(item.id);
    try {
      host.toastr?.success?.(
        item.applied ? `已一键升级并应用到 v${updated.version}` : `已同步缓存到 v${updated.version}`,
        item.name,
      );
    } catch {}
    showRestoreWarnings(updated, item.name);
    await refreshInstalled();
    return result;
  }

  async function exportItem(item) {
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
  }

  function localCard(item) {
    const card = element('article', 'rw-card rw-local-card');

    if (item.source === 'remote' && item.hasCover) {
      const cover = element('img', 'rw-cover rw-local-cover');
      cover.src = workshopApi.getProjectCoverUrl(item.id);
      cover.alt = `${item.name} 封面`;
      cover.loading = 'lazy';
      card.appendChild(cover);
    } else {
      const visual = element('div', `rw-local-visual rw-local-visual--${item.category}`);
      visual.append(
        element('strong', '', categoryLabels[item.category] || item.category),
        element('span', '', `${artifactCount(item)} 项内容`),
      );
      card.appendChild(visual);
    }

    const head = element('div', 'rw-local-card-head');
    const titleBox = element('div', 'rw-local-titlebox');
    titleBox.append(
      element('h3', '', item.name),
      element('div', 'rw-project-author', item.source === 'offline' ? '离线包导入' : '来自创意工坊'),
    );

    const state = installedState(item);
    const stateBadge = element('span', `rw-local-state rw-local-state--${state.className}`, state.label);
    head.append(titleBox, stateBadge);
    card.appendChild(head);

    const meta = element('div', 'rw-meta');
    meta.append(
      element('span', 'rw-pill', categoryLabels[item.category] || item.category),
      element('span', 'rw-pill', `缓存 v${item.version}`),
    );
    if (item.targetCharacterName) meta.append(element('span', 'rw-pill', `角色：${item.targetCharacterName}`));
    if (item.dependencies?.length) meta.append(element('span', 'rw-pill', `依赖 ${item.dependencies.length}`));
    card.appendChild(meta);

    if (item.summary) card.appendChild(element('div', 'rw-muted rw-project-summary', item.summary));

    if (item.applyError) {
      card.appendChild(element('div', 'rw-status bad', `上次安装失败：${item.applyError}`));
    } else if (item.repairState?.lastCheckedAt && !item.repairState.healthy) {
      card.appendChild(element(
        'div',
        'rw-status bad',
        `检查到 ${item.repairState.issues?.length || 0} 项安装异常，可尝试修复。`,
      ));
    }

    const actions = element('div', 'rw-local-actions');
    let primary = null;
    if (!item.applied || Number(item.appliedVersion || 0) < Number(item.version)) {
      primary = button(
        item.applied ? '应用新版' : '安装到酒馆',
        'primary rw-local-primary',
        () => applyItem(item),
      );
    } else if (item.repairState?.lastCheckedAt && !item.repairState.healthy) {
      primary = button('检查并修复', 'primary rw-local-primary', () => inspectAndRepair(item));
    } else {
      primary = button('检查更新', 'primary rw-local-primary', () => checkUpdate(item));
    }
    actions.appendChild(primary);

    const menu = element('div', 'rw-card-menu rw-local-menu');
    const menuDropdown = element('div', 'rw-card-menu-dropdown');
    menuDropdown.hidden = true;
    const closeMenu = () => { menuDropdown.hidden = true; };
    const menuTrigger = button('⋯', 'rw-card-menu-trigger', () => {
      menuDropdown.hidden = !menuDropdown.hidden;
    });
    menuTrigger.setAttribute('aria-label', `${item.name} 更多操作`);

    if (item.applied) {
      menuDropdown.appendChild(button('重新应用', '', async () => {
        closeMenu();
        await applyItem(item);
      }));
      menuDropdown.appendChild(button('检查安装', '', async () => {
        closeMenu();
        await inspectAndRepair(item);
      }));
    }
    if (!(item.applied && Number(item.appliedVersion || 0) >= Number(item.version))) {
      menuDropdown.appendChild(button('检查更新', '', async () => {
        closeMenu();
        await checkUpdate(item);
      }));
    }
    menuDropdown.appendChild(button('导出离线包', '', async () => {
      closeMenu();
      await exportItem(item);
    }));

    if (item.applied) {
      menuDropdown.appendChild(button('卸载', 'danger', async () => {
        closeMenu();
        const confirmed = host.confirm?.(`确定卸载“${item.name}”吗？工坊会只清理该项目拥有的资源。`);
        if (!confirmed) return;
        const result = await projectService.uninstall(item.id);
        try { host.toastr?.success?.(`已卸载 ${item.name}`, '创意工坊'); } catch {}
        showRestoreWarnings(result, item.name);
        await refreshInstalled();
      }));
    } else {
      menuDropdown.appendChild(button('删除本地缓存', 'danger', async () => {
        closeMenu();
        const confirmed = host.confirm?.(`确定删除“${item.name}”的本地缓存吗？`);
        if (!confirmed) return;
        await projectService.removeCached(item.id);
        await refreshInstalled();
      }));
    }

    menu.append(menuTrigger, menuDropdown);
    actions.appendChild(menu);
    card.appendChild(actions);
    return card;
  }

  async function refreshInstalled() {
    const installed = (await projectService.installed()).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!installed.length) return empty(nodes.installedList, '还没有下载任何作品');
    nodes.installedList.replaceChildren(...installed.map(localCard));
  }

  return { refresh: refreshInstalled, checkAllUpdates, manageStorage };
}
