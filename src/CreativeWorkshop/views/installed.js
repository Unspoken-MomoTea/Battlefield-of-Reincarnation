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

      const actions = element('div', 'rw-row');
      actions.appendChild(
        button(item.applied ? (item.appliedVersion === item.version ? '重新应用' : '应用新版') : '安装到酒馆', 'primary', async () => {
          const result = await projectService.apply(item.id);
          try { host.toastr?.success?.(`已应用 ${result.name} v${result.appliedVersion}`, '创意工坊'); } catch {}
          await refreshInstalled();
        }),
      );
      if (item.applied) {
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
        const wasApplied = item.applied;
        const cached = await projectService.cache(item.id);
        if (wasApplied) await projectService.apply(item.id);
        try {
          host.toastr?.success?.(
            wasApplied ? `已升级并应用到 v${cached.version}` : `已同步缓存到 v${cached.version}`,
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
  return { refresh: refreshInstalled, checkAllUpdates };
}
