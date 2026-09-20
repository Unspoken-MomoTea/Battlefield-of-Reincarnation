export function createAdminProjectsView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  host,
  categoryLabels,
  artifactLabels,
  getAuth,
}) {
  function reviewStatusLabel(status) {
    return ({ draft: '未提交审核', pending: '审核中', approved: '已通过', rejected: '已拒绝' })[status] || status;
  }

  function formatTime(seconds) {
    if (!seconds) return '—';
    return new Date(Number(seconds) * 1000).toLocaleString();
  }

  async function refreshProjects() {
    if (!Number(getAuth()?.user?.is_admin)) return empty(nodes.pendingList, '需要管理员权限');
    try {
      const result = await workshopApi.listAdminProjects({
        query: nodes.adminSearch.value,
        category: nodes.adminCategory.value,
        reviewStatus: nodes.adminStatus.value,
      });
      if (!result.items.length) return empty(nodes.pendingList, '没有符合条件的上传作品');
      const cards = result.items.map(item => {
        const card = element('article', 'rw-card');
        card.appendChild(element('h3', '', `${item.name} · v${item.latest_version}`));
        const meta = element('div', 'rw-meta');
        meta.append(element('span', 'rw-pill', categoryLabels[item.category] || item.category));
        meta.append(element('span', 'rw-pill', reviewStatusLabel(item.review_status)));
        if (item.project_status === 'archived') meta.append(element('span', 'rw-pill', '已下架'));
        if (item.owner_is_banned) meta.append(element('span', 'rw-pill', '作者已封禁'));
        if (item.has_cover) meta.append(element('span', 'rw-pill', '含封面'));
        meta.append(element('span', 'rw-pill', `公开 v${item.published_version}`));
        card.appendChild(meta);
        card.appendChild(
          element(
            'div',
            'rw-muted',
            `作者：${item.owner_name}（Discord: ${item.owner_discord_id}）\n` +
              `更新说明：${item.changelog || '无'}\n` +
              `上传：${formatTime(item.version_created_at)} · 提交：${formatTime(item.submitted_at)} · 审核：${formatTime(item.reviewed_at)}`,
          ),
        );
        if (item.review_decision) {
          const reviewText = `${item.review_decision === 'approved' ? '通过' : '拒绝'} · 审核人：${item.reviewer_name || '未知'}${item.review_note ? ` · ${item.review_note}` : ''}`;
          card.appendChild(element('div', item.review_decision === 'approved' ? 'rw-status ok' : 'rw-status bad', reviewText));
        }

        const coverPreview = element('img', 'rw-cover');
        coverPreview.alt = `${item.name} 待审封面`;
        coverPreview.hidden = true;
        const preview = element('pre', 'rw-detail');
        preview.hidden = true;
        const actions = element('div', 'rw-row');
        actions.appendChild(button('查看内容与审核记录', '', async () => {
          if (!preview.hidden) {
            preview.hidden = true;
            coverPreview.hidden = true;
            return;
          }
          const detail = await workshopApi.getPendingReview(item.id);
          if (detail.project.has_cover) {
            const blob = await workshopApi.getAdminProjectCover(item.id);
            const url = host.URL.createObjectURL(blob);
            coverPreview.src = url;
            coverPreview.hidden = false;
            coverPreview.onload = () => host.URL.revokeObjectURL(url);
          }
          const artifactPreviews = detail.bundle.artifacts.map(artifact => {
            const raw = typeof artifact.content === 'string' ? artifact.content : JSON.stringify(artifact.content, null, 2);
            return {
              kind: artifact.kind,
              kind_label: artifactLabels[artifact.kind] || artifact.kind,
              name: artifact.name,
              format: artifact.format,
              ...(artifact.kind === 'script' ? { scope: artifact.scope || 'character' } : {}),
              ...(artifact.kind === 'worldbook' && artifact.original_conflicts?.length
                ? { original_conflicts: artifact.original_conflicts }
                : {}),
              preview: raw.length > 6000 ? `${raw.slice(0, 6000)}\n…（界面仅预览前 6000 字符）` : raw,
            };
          });
          preview.textContent = JSON.stringify(
            {
              project: detail.project,
              versions: detail.versions,
              reviews: detail.reviews,
              admin_audit: detail.admin_audit,
              manifest: detail.manifest,
              artifacts: artifactPreviews,
            },
            null,
            2,
          );
          preview.hidden = false;
        }));
        if (item.review_status === 'pending' && item.project_status !== 'archived') {
          actions.appendChild(button('批准', 'good', async () => {
            const note = host.prompt?.('审核备注（可留空）', '') ?? '';
            await workshopApi.reviewProject(item.id, 'approved', note);
            await refreshProjects();
          }));
          actions.appendChild(button('驳回', 'danger', async () => {
            const note = host.prompt?.('请输入驳回原因（必填）', '') ?? '';
            if (!note.trim()) throw new Error('驳回时必须填写原因');
            await workshopApi.reviewProject(item.id, 'rejected', note);
            await refreshProjects();
          }));
        }
        if (item.project_status === 'archived') {
          actions.appendChild(button('恢复作品', 'good', async () => {
            const note = host.prompt?.('恢复备注（可留空）', '') ?? '';
            await workshopApi.setAdminProjectState(item.id, 'restore', note);
            await refreshProjects();
          }));
        } else {
          actions.appendChild(button('下架作品', 'danger', async () => {
            const note = host.prompt?.('下架原因（建议填写）', '') ?? '';
            await workshopApi.setAdminProjectState(item.id, 'archive', note);
            await refreshProjects();
          }));
        }
        card.append(coverPreview, actions, preview);
        return card;
      });
      nodes.pendingList.replaceChildren(...cards);
    } catch (error) {
      empty(nodes.pendingList, `加载失败：${error.message}`);
    }
  }
  return { refresh: refreshProjects };
}
