function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '不可用';
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = bytes;
  let unit = 0;
  while (amount >= 1000 && unit < units.length - 1) {
    amount /= 1000;
    unit += 1;
  }
  return `${amount.toFixed(unit >= 2 ? 2 : 0)} ${units[unit]}`;
}

function percent(value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) return '—';
  return `${Math.min(100, Math.max(0, ratio * 100)).toFixed(1)}%`;
}

export function createAdminStorageView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  confirmDialog,
  notifyError,
}) {
  function meter(label, used, limit, ratio, note = '') {
    const card = element('article', 'rw-card rw-admin-storage-card');
    const head = element('div', 'rw-admin-storage-head');
    head.append(
      element('strong', '', label),
      element('span', 'rw-pill', percent(ratio)),
    );

    const value = element('div', 'rw-admin-storage-value');
    value.append(
      element('strong', '', formatBytes(used)),
      element('span', '', ` / ${formatBytes(limit)}`),
    );

    const track = element('div', 'rw-admin-storage-track');
    const fill = element('div', 'rw-admin-storage-fill');
    fill.style.width = Number.isFinite(Number(ratio))
      ? `${Math.min(100, Math.max(0, Number(ratio) * 100))}%`
      : '0%';
    track.appendChild(fill);

    card.append(head, value, track);
    if (note) card.appendChild(element('div', 'rw-muted', note));
    return card;
  }

  async function refresh() {
    empty(nodes.adminStorageList, '正在读取 Cloudflare 存储使用量…');
    try {
      const usage = await workshopApi.getAdminStorage();
      const wrap = element('div', 'rw-admin-storage-wrap');
      const r2Note = `对象 ${usage.r2?.object_count || 0} 个 · 工坊硬上限 9.5 GB；超过后直接拒绝上传，不进入付费区。`;
      const d1Note = usage.d1?.used_bytes == null
        ? '当前运行环境无法读取 D1 page_count/page_size；500 MB Free 单库上限仍然生效。'
        : `剩余 ${formatBytes(usage.d1.remaining_bytes)} · Free 单库上限 500 MB。`;

      const meters = element('div', 'rw-admin-storage-grid');
      meters.append(
        meter('R2 · MOD / 封面', usage.r2?.used_bytes, usage.r2?.hard_limit_bytes, usage.r2?.usage_ratio, r2Note),
        meter('D1 · 工坊数据库', usage.d1?.used_bytes, usage.d1?.free_limit_bytes, usage.d1?.usage_ratio, d1Note),
      );
      wrap.appendChild(meters);

      const facts = element('div', 'rw-admin-storage-facts');
      facts.append(
        element('div', 'rw-workshop-fact', `作品总数\n${usage.counts?.projects || 0}`),
        element('div', 'rw-workshop-fact', `服务器版本记录\n${usage.counts?.versions || 0}`),
        element('div', 'rw-workshop-fact', `R2 剩余预算\n${formatBytes(usage.r2?.remaining_bytes)}`),
      );
      wrap.appendChild(facts);

      const note = element('div', 'rw-local-note');
      note.textContent = '公开目录搜索/分类/排序已改为客户端执行；服务器只维护一个轻量目录快照。历史版本不再保留，清理按钮用于处理改版前遗留数据。';
      wrap.appendChild(note);

      const actions = element('div', 'rw-row');
      const cleanup = button('清理历史版本', 'danger', async () => {
        const confirmed = await confirmDialog({
          title: '清理服务器历史版本？',
          message: '每个作品只保留当前正在使用的版本。旧 bundle / manifest / 无引用封面会从 R2 删除。此操作不可回退。',
          confirmText: '确认清理',
          cancelText: '取消',
          danger: true,
        });
        if (!confirmed) return;
        cleanup.disabled = true;
        cleanup.textContent = '正在清理…';
        try {
          const result = await workshopApi.cleanupAdminStorage();
          try {
            globalThis.toastr?.success?.(
              `清理 ${result.removed_versions || 0} 个旧版本，释放 ${formatBytes(result.freed_bytes || 0)}`,
              '创意工坊',
            );
          } catch {}
          await refresh();
        } catch (error) {
          notifyError(error);
          cleanup.disabled = false;
          cleanup.textContent = '清理历史版本';
        }
      });
      actions.append(cleanup);
      wrap.appendChild(actions);

      nodes.adminStorageList.replaceChildren(wrap);
    } catch (error) {
      empty(nodes.adminStorageList, `读取容量失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { refresh };
}
