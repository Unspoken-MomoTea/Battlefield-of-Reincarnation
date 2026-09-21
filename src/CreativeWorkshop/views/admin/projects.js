import {
  renderChangePreview,
  renderContentPreview,
  renderVersionHistory,
} from '../discover/content-preview.js';

export function createAdminProjectsView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  host,
  doc,
  categoryLabels,
  getAuth,
  openModal,
  confirmDialog,
  notifyError,
}) {
  function reviewStatusLabel(status) {
    return ({ draft: '未提交审核', pending: '审核中', approved: '已通过', rejected: '已拒绝' })[status] || status;
  }

  function formatTime(seconds) {
    if (!seconds) return '—';
    return new Date(Number(seconds) * 1000).toLocaleString();
  }

  function statusClass(status) {
    if (status === 'approved') return 'ok';
    if (status === 'rejected') return 'bad';
    return '';
  }

  function detailRow(label, value) {
    const row = element('div', 'rw-admin-fact');
    row.append(element('span', '', label), element('strong', '', value || '—'));
    return row;
  }

  function projectProtectedTargets(artifacts) {
    const rows = [];
    for (const artifact of artifacts || []) {
      for (const conflict of artifact.original_conflicts || []) {
        const target = conflict.target || {};
        if (artifact.kind === 'worldbook') {
          rows.push({
            kind: 'worldbook',
            title: target.name || (target.uid ? `UID ${target.uid}` : '未命名条目'),
            meta: [
              target.worldbook ? `世界书：${target.worldbook}` : '',
              target.uid ? `UID：${target.uid}` : '',
              artifact.name ? `由：${artifact.name}` : '',
            ].filter(Boolean).join(' · '),
          });
        }
        if (artifact.kind === 'script') {
          rows.push({
            kind: 'script',
            title: target.folder
              ? `${target.folder} / ${target.name || target.id || '未命名脚本'}`
              : (target.name || target.id || '未命名脚本'),
            meta: [
              ({ character: '当前角色', preset: '当前预设', global: '全局' })[target.scope] || target.scope || '',
              target.id ? `ID：${target.id}` : '',
              artifact.name ? `由：${artifact.name}` : '',
            ].filter(Boolean).join(' · '),
          });
        }
      }
    }
    return rows;
  }

  function renderProtectedTargets(artifacts) {
    const targets = projectProtectedTargets(artifacts);
    if (!targets.length) return null;

    const section = element('section', 'rw-workshop-rail-section rw-workshop-protected');
    section.append(
      element('div', 'rw-workshop-rail-label', '安装时替换 / 屏蔽'),
      element('div', 'rw-workshop-protected-note', '审核时请确认这些目标确实应该被临时关闭；停用作品后会按安装前状态恢复。'),
    );

    for (const target of targets) {
      const row = element('div', 'rw-workshop-protected-row');
      row.append(
        element(
          'span',
          `rw-workshop-protected-icon${target.kind === 'script' ? ' script' : ''}`,
          target.kind === 'script' ? 'JS' : '书',
        ),
        element('div', 'rw-workshop-protected-copy'),
      );
      row.lastElementChild.append(
        element('strong', '', target.title),
        element('small', '', target.meta),
      );
      section.appendChild(row);
    }
    return section;
  }

  function renderReviewHistory(detail) {
    const section = element('section', 'rw-detail-content-section rw-admin-review-history');
    const heading = element('div', 'rw-detail-content-heading');
    const copy = element('div', '');
    copy.append(
      element('strong', '', '审核记录'),
      element('span', '', '版本审核与管理员操作记录'),
    );
    heading.appendChild(copy);
    section.appendChild(heading);

    const list = element('div', 'rw-admin-history');
    for (const review of detail.reviews || []) {
      const row = element('div', `rw-admin-history-row rw-status ${statusClass(review.decision)}`);
      row.append(
        element(
          'strong',
          '',
          `v${review.version} · ${review.decision === 'approved' ? '通过' : '拒绝'} · ${review.reviewer_name || '管理员'}`,
        ),
        element('span', '', `${review.note || '无备注'} · ${formatTime(review.created_at)}`),
      );
      list.appendChild(row);
    }

    for (const log of detail.admin_audit || []) {
      const row = element('div', 'rw-admin-history-row');
      row.append(
        element('strong', '', `v${log.project_version || '—'} · ${log.action} · ${log.actor_name || '管理员'}`),
        element('span', '', `${log.note || '无备注'} · ${formatTime(log.created_at)}`),
      );
      list.appendChild(row);
    }

    if (!list.childElementCount) {
      list.appendChild(element('div', 'rw-content-empty', '暂无审核或管理员操作记录。'));
    }
    section.appendChild(list);
    return section;
  }

  async function reviewAction(item, decision, modal) {
    const note = decision === 'approved'
      ? (host.prompt?.('审核备注（可留空）', '') ?? '')
      : (host.prompt?.('请输入驳回原因（必填）', '') ?? '');
    if (decision === 'rejected' && !note.trim()) throw new Error('驳回时必须填写原因');

    const label = decision === 'approved' ? '批准' : '驳回';
    const confirmed = await confirmDialog({
      title: `${label}“${item.name}”？`,
      message: `目标版本：v${item.latest_version}${note.trim() ? `\n审核备注：${note.trim()}` : ''}`,
      confirmText: label,
      cancelText: '取消',
      danger: decision === 'rejected',
    });
    if (!confirmed) return;

    try {
      await workshopApi.reviewProject(item.id, decision, note);
      modal?.close({ force: true });
      await refreshProjects();
    } catch (error) {
      notifyError(error);
    }
  }

  async function stateAction(item, action, modal) {
    const isArchive = action === 'archive';
    const note = host.prompt?.(isArchive ? '下架原因（建议填写）' : '恢复备注（可留空）', '') ?? '';
    const confirmed = await confirmDialog({
      title: isArchive ? `下架“${item.name}”？` : `恢复“${item.name}”？`,
      message: isArchive
        ? '下架只影响公开展示，不会删除作品文件和审核记录。'
        : '作品会恢复到可公开展示的状态。',
      confirmText: isArchive ? '确认下架' : '确认恢复',
      cancelText: '取消',
      danger: isArchive,
    });
    if (!confirmed) return;

    try {
      await workshopApi.setAdminProjectState(item.id, action, note);
      modal?.close({ force: true });
      await refreshProjects();
    } catch (error) {
      notifyError(error);
    }
  }

  function adminDeleteErrorMessage(error) {
    if (error?.status === 404 || error?.status === 405) {
      return '服务器仍是旧版，尚未部署管理员删除接口。请重新部署 staging Worker（服务端需要 0.9.0+）后再试。';
    }
    return error instanceof Error ? error.message : String(error);
  }

  function showAdminDeleteFailure(item, error) {
    const failure = openModal('删除失败', { wide: false });
    const box = element('div', 'rw-delete-error');
    box.append(
      element('strong', '', `“${item.name}”没有被删除`),
      element('div', '', adminDeleteErrorMessage(error)),
    );
    const actions = element('div', 'rw-row');
    actions.appendChild(button('知道了', 'primary', () => failure.close({ force: true })));
    failure.body.append(box, actions);
    try { notifyError?.(error); } catch {}
  }

  async function deleteAction(item, modal) {
    const confirmed = await confirmDialog({
      title: `删除“${item.name}”？`,
      message: [
        '删除后无法恢复。',
        `将清理全部版本（最新 v${item.latest_version}）、Manifest、bundle、封面、点赞/收藏、举报等关联数据和服务器文件。`,
      ].join('\n'),
      confirmText: '删除作品',
      cancelText: '取消',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await workshopApi.deleteAdminProject(item.id);
      try { host.toastr?.success?.('作品及服务器文件已删除', '创意工坊管理'); } catch {}
      modal?.close({ force: true });
      await refreshProjects();
    } catch (error) {
      showAdminDeleteFailure(item, error);
    }
  }

  function reviewActions(item, project, modal) {
    const section = element('section', 'rw-admin-review-decision');
    section.appendChild(element('div', 'rw-workshop-rail-label', '审核操作'));

    if (project.review_status === 'pending' && project.project_status !== 'archived') {
      section.append(
        button('批准这个版本', 'good rw-admin-review-primary', () => reviewAction(item, 'approved', modal)),
        button('驳回这个版本', 'danger', () => reviewAction(item, 'rejected', modal)),
      );
    }

    if (project.project_status === 'archived') {
      section.appendChild(button('恢复作品', 'good', () => stateAction(item, 'restore', modal)));
    } else {
      section.appendChild(button('下架作品', 'danger', () => stateAction(item, 'archive', modal)));
    }
    section.appendChild(button('删除作品', 'danger rw-admin-delete-project', () => deleteAction(item, modal)));
    return section;
  }

  async function showReview(item) {
    const modal = openModal(`审核详情 · ${item.name}`, { extraWide: true });
    empty(modal.body, '正在加载审核资料...');

    try {
      const detail = await workshopApi.getPendingReview(item.id);
      const project = detail.project;
      modal.body.replaceChildren();

      const shell = element('div', 'rw-workshop-detail-shell rw-admin-review-shell');
      const header = element('header', 'rw-workshop-detail-header');
      const headerCopy = element('div', 'rw-workshop-detail-title');
      headerCopy.append(
        element('h2', '', `${project.name} · v${project.latest_version}`),
        element(
          'div',
          'rw-workshop-detail-identity',
          `作者 · ${project.owner_name} · Discord ${project.owner_discord_id}`,
        ),
      );

      const headerMeta = element('div', 'rw-meta');
      headerMeta.append(
        element('span', 'rw-pill', categoryLabels[project.category] || project.category),
        element(
          'span',
          `rw-local-state rw-local-state--${project.review_status === 'approved' ? 'installed' : project.review_status === 'rejected' ? 'bad' : 'update'}`,
          reviewStatusLabel(project.review_status),
        ),
      );
      if (project.project_status === 'archived') headerMeta.appendChild(element('span', 'rw-pill', '已下架'));
      for (const tag of project.tags || []) headerMeta.appendChild(element('span', 'rw-pill', `#${tag}`));
      header.append(headerCopy, headerMeta);
      shell.appendChild(header);

      const grid = element('div', 'rw-workshop-detail-grid');
      const reading = element('main', 'rw-workshop-reading');
      const rail = element('aside', 'rw-workshop-rail');

      if (project.has_cover) {
        const blob = await workshopApi.getAdminProjectCover(item.id);
        const url = host.URL.createObjectURL(blob);
        const cover = element('img', 'rw-workshop-hero');
        cover.src = url;
        cover.alt = `${project.name} 待审封面`;
        cover.onload = () => host.URL.revokeObjectURL(url);
        reading.appendChild(cover);
      }

      const overview = element('section', 'rw-detail-content-section rw-workshop-overview');
      const overviewHeading = element('div', 'rw-detail-content-heading');
      const overviewCopy = element('div', '');
      overviewCopy.append(
        element('strong', '', '作品简介'),
        element('span', '', '审核前先确认作者描述与实际内容是否一致'),
      );
      overviewHeading.appendChild(overviewCopy);
      overview.append(
        overviewHeading,
        element('div', 'rw-detail-description', project.summary || '作者没有填写简介。'),
      );
      reading.appendChild(overview);

      reading.appendChild(renderChangePreview(doc, detail.change_preview, project.changelog || ''));
      reading.appendChild(renderVersionHistory(doc, detail.versions || []));
      reading.appendChild(renderContentPreview(doc, detail));
      reading.appendChild(renderReviewHistory(detail));

      const reviewSummary = element('section', 'rw-workshop-rail-section rw-admin-review-summary');
      reviewSummary.appendChild(element('div', 'rw-workshop-rail-label', '审核资料'));
      const facts = element('div', 'rw-workshop-facts');
      facts.append(
        detailRow('当前版本', `v${project.latest_version}`),
        detailRow('公开版本', `v${project.published_version}`),
        detailRow('提交审核', formatTime(project.submitted_at)),
        detailRow('最近审核', formatTime(project.reviewed_at)),
        detailRow('下载', String(project.downloads_count || 0)),
        detailRow('点赞 / 收藏', `${project.likes_count || 0} / ${project.favorites_count || 0}`),
      );
      reviewSummary.appendChild(facts);
      rail.appendChild(reviewActions(item, project, modal));
      rail.appendChild(reviewSummary);

      const artifacts = Array.isArray(detail.bundle?.artifacts) ? detail.bundle.artifacts : [];
      const protectedSection = renderProtectedTargets(artifacts);
      if (protectedSection) rail.appendChild(protectedSection);

      if (project.dependencies?.length) {
        const dependencies = element('section', 'rw-workshop-rail-section');
        dependencies.appendChild(element('div', 'rw-workshop-rail-label', '依赖项目'));
        const list = element('div', 'rw-workshop-dependency-list');
        for (const dependency of project.dependencies) {
          list.appendChild(element(
            'div',
            'rw-workshop-dependency',
            `${dependency.project_id} · 最低 v${dependency.min_version}`,
          ));
        }
        dependencies.appendChild(list);
        rail.appendChild(dependencies);
      }

      grid.append(reading, rail);
      shell.appendChild(grid);
      modal.body.appendChild(shell);
    } catch (error) {
      empty(modal.body, `加载失败：${error.message}`);
      notifyError(error);
    }
  }

  function projectCard(item) {
    const card = element('article', 'rw-card rw-admin-project-card');
    const head = element('div', 'rw-local-card-head');
    const title = element('div', 'rw-local-titlebox');
    title.append(
      element('h3', '', `${item.name} · v${item.latest_version}`),
      element('div', 'rw-project-author', `${item.owner_name} · Discord ${item.owner_discord_id}`),
    );
    const reviewState = element(
      'span',
      `rw-local-state rw-local-state--${item.review_status === 'approved' ? 'installed' : item.review_status === 'rejected' ? 'bad' : 'update'}`,
      reviewStatusLabel(item.review_status),
    );
    head.append(title, reviewState);
    card.appendChild(head);

    const meta = element('div', 'rw-meta');
    meta.append(
      element('span', 'rw-pill', categoryLabels[item.category] || item.category),
      element('span', 'rw-pill', `公开 v${item.published_version}`),
    );
    if (item.project_status === 'archived') meta.append(element('span', 'rw-pill', '已下架'));
    if (item.owner_is_banned) meta.append(element('span', 'rw-pill', '作者已封禁'));
    if (item.has_cover) meta.append(element('span', 'rw-pill', '含封面'));
    card.appendChild(meta);

    card.appendChild(element(
      'div',
      'rw-muted',
      `${item.changelog || '无版本说明'}\n提交：${formatTime(item.submitted_at)} · 审核：${formatTime(item.reviewed_at)}`,
    ));

    if (item.review_decision) {
      const reviewText = `${item.review_decision === 'approved' ? '通过' : '拒绝'} · ${item.reviewer_name || '未知'}${item.review_note ? ` · ${item.review_note}` : ''}`;
      card.appendChild(element('div', `rw-status ${statusClass(item.review_decision)}`, reviewText));
    }

    const actions = element('div', 'rw-local-actions');
    actions.appendChild(button('查看内容与审核', 'primary rw-local-primary', () => showReview(item)));
    if (item.project_status === 'archived') {
      actions.appendChild(button('删除作品', 'danger', () => deleteAction(item, null)));
    }
    card.appendChild(actions);
    return card;
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
      nodes.pendingList.replaceChildren(...result.items.map(projectCard));
    } catch (error) {
      empty(nodes.pendingList, `加载失败：${error.message}`);
    }
  }

  return { refresh: refreshProjects, showReview };
}
