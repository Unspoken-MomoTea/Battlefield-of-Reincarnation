import { formatInstallConflicts, formatInstallHealth } from '../ui/install-messages.js';

export function createInstalledView({
  nodes,
  element,
  button,
  empty,
  confirmDialog,
  openModal,
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

  function protectionChanges(item) {
    const targets = item.installTargets || {};
    return {
      worldbooks: Array.isArray(targets.originalWorldbookChanges) ? targets.originalWorldbookChanges : [],
      scripts: Array.isArray(targets.originalScriptChanges) ? targets.originalScriptChanges : [],
    };
  }

  function beforeWorldbookEnabled(change) {
    const entry = change?.beforeEntry;
    if (typeof entry?.enabled === 'boolean') return entry.enabled;
    if (typeof entry?.disable === 'boolean') return !entry.disable;
    return true;
  }

  function beforeScriptEnabled(change) {
    return change?.beforeScript?.enabled !== false;
  }

  function protectionRow(kind, title, meta) {
    const row = element('div', 'rw-protection-row');
    const icon = element('span', `rw-protection-icon rw-protection-icon--${kind}`, kind === 'worldbook' ? '书' : 'JS');
    const copy = element('div', 'rw-protection-copy');
    copy.append(element('strong', '', title), element('span', '', meta));
    row.append(icon, copy);
    return row;
  }

  function showProtectedOriginals(item) {
    const changes = protectionChanges(item);
    const modal = openModal(`原版保护记录 · ${item.name}`, { wide: true });

    const intro = element('div', 'rw-maintenance-protection');
    intro.append(
      element('strong', '', '这些原版内容只是临时关闭，不是删除'),
      element(
        'div',
        '',
        '当这个创意处于启用状态时，下列世界书条目或酒馆助手脚本由工坊暂时屏蔽。停用作品时会按安装前快照恢复；如果你期间修改过原内容，只恢复必要的启用状态，不覆盖你的修改。',
      ),
    );
    modal.body.appendChild(intro);

    if (!changes.worldbooks.length && !changes.scripts.length) {
      modal.body.appendChild(element('div', 'rw-empty', '这个作品没有屏蔽或替换任何原版世界书/脚本。'));
      return;
    }

    if (changes.worldbooks.length) {
      const section = element('section', 'rw-protection-section');
      const heading = element('div', 'rw-protection-heading');
      heading.append(
        element('strong', '', `世界书条目 · ${changes.worldbooks.length}`),
        element('span', '', '当前由工坊临时关闭'),
      );
      const list = element('div', 'rw-protection-list');
      for (const change of changes.worldbooks) {
        const identity = change.identity || {};
        const name = identity.name || (identity.uid ? `UID ${identity.uid}` : '未命名条目');
        const meta = [
          `世界书：${change.worldbookName || '未知'}`,
          identity.uid ? `UID：${identity.uid}` : '',
          `安装前：${beforeWorldbookEnabled(change) ? '启用' : '已关闭'}`,
          change.artifactName ? `由：${change.artifactName}` : '',
          change.userModified ? '玩家修改过，恢复时会保留修改' : '',
        ].filter(Boolean).join(' · ');
        list.appendChild(protectionRow('worldbook', name, meta));
      }
      section.append(heading, list);
      modal.body.appendChild(section);
    }

    if (changes.scripts.length) {
      const section = element('section', 'rw-protection-section');
      const heading = element('div', 'rw-protection-heading');
      heading.append(
        element('strong', '', `酒馆助手脚本 · ${changes.scripts.length}`),
        element('span', '', '当前由工坊临时关闭'),
      );
      const list = element('div', 'rw-protection-list');
      const scopeLabels = { character: '当前角色', preset: '当前预设', global: '全局' };
      for (const change of changes.scripts) {
        const identity = change.identity || {};
        const name = identity.name || identity.id || '未命名脚本';
        const meta = [
          scopeLabels[change.scope] || change.scope || '未知作用域',
          identity.folder ? `文件夹：${identity.folder}` : '',
          identity.id ? `ID：${identity.id}` : '',
          `安装前：${beforeScriptEnabled(change) ? '启用' : '已关闭'}`,
          change.artifactName ? `由：${change.artifactName}` : '',
          change.userModified ? '玩家修改过，恢复时会保留修改' : '',
        ].filter(Boolean).join(' · ');
        list.appendChild(protectionRow('script', name, meta));
      }
      section.append(heading, list);
      modal.body.appendChild(section);
    }

    if (item.restoreWarnings?.length) {
      const warning = element('div', 'rw-status bad', item.restoreWarnings.join('\n'));
      modal.body.appendChild(warning);
    }
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

    const confirmed = await confirmDialog({
      title: '清理本地缓存？',
      message: `${summary}\n只会删除“仅缓存”作品，已安装到酒馆的项目不会被删除。`,
      confirmText: '清理缓存',
      cancelText: '取消',
      danger: true,
    });
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
      const confirmed = await confirmDialog({
        title: '安装前发现冲突',
        message: formatInstallConflicts(preflight.warnings),
        confirmText: '继续安装',
        cancelText: '取消',
      });
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
    const confirmed = await confirmDialog({
      title: '发现安装异常',
      message: summary,
      confirmText: '立即修复',
      cancelText: '稍后处理',
    });
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
    const shouldSync = await confirmDialog({
      title: '发现新版本',
      message: `服务器已有 v${result.remoteVersion}。是否立即下载最新版${item.applied ? '并重新应用到酒馆' : ''}？`,
      confirmText: item.applied ? '下载并升级' : '下载新版',
      cancelText: '取消',
    });
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
    const protections = protectionChanges(item);
    const protectionCount = protections.worldbooks.length + protections.scripts.length;
    if (item.applied && protectionCount) {
      const protectedButton = button(`原版保护 ${protectionCount}`, 'rw-protection-pill', () => showProtectedOriginals(item));
      protectedButton.title = '查看当前被这个作品临时关闭的世界书条目和脚本';
      meta.appendChild(protectedButton);
    }
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
      const protections = protectionChanges(item);
      if (protections.worldbooks.length || protections.scripts.length) {
        menuDropdown.appendChild(button('查看原版保护记录', '', () => {
          closeMenu();
          showProtectedOriginals(item);
        }));
      }
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
      menuDropdown.appendChild(button('停用并还原原版', 'danger', async () => {
        closeMenu();
        const confirmed = await confirmDialog({
          title: `停用“${item.name}”？`,
          message: '工坊会移除该项目拥有的资源，并恢复它临时屏蔽/替换的原版世界书和酒馆助手脚本。',
          confirmText: '停用并还原',
          cancelText: '取消',
          danger: true,
        });
        if (!confirmed) return;
        const result = await projectService.uninstall(item.id);
        try { host.toastr?.success?.(`已停用 ${item.name}，原版内容已按恢复记录处理`, '创意工坊'); } catch {}
        showRestoreWarnings(result, item.name);
        await refreshInstalled();
      }));
    } else {
      menuDropdown.appendChild(button('删除本地缓存', 'danger', async () => {
        closeMenu();
        const confirmed = await confirmDialog({
          title: `删除“${item.name}”的缓存？`,
          message: '只会删除本地下载缓存，不会影响服务器上的作品。',
          confirmText: '删除缓存',
          cancelText: '取消',
          danger: true,
        });
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
