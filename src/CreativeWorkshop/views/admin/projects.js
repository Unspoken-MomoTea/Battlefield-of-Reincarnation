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
  openModal,
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

  function artifactPreview(artifact) {
    const row = element('details', 'rw-admin-artifact');
    const summary = element('summary', '');
    const title = element('span', 'rw-admin-artifact-title');
    title.append(
      element('strong', '', artifact.name || '未命名内容'),
      element('small', '', artifactLabels[artifact.kind] || artifact.kind),
    );
    summary.appendChild(title);

    const flags = element('span', 'rw-admin-artifact-flags');
    if (artifact.kind === 'script') {
      flags.appendChild(element('span', 'rw-pill', `作用域：${artifact.scope || 'character'}`));
      if (artifact.original_conflicts?.length) {
        flags.appendChild(element('span', 'rw-pill', `屏蔽/替换原脚本 ${artifact.original_conflicts.length}`));
      }
    }
    if (artifact.kind === 'worldbook' && artifact.original_conflicts?.length) {
      flags.appendChild(element('span', 'rw-pill', `屏蔽/替换原版条目 ${artifact.original_conflicts.length}`));
    }
    if (artifact.format) flags.appendChild(element('span', 'rw-pill', artifact.format));
    summary.appendChild(flags);

    if (artifact.original_conflicts?.length) {
      const protectedTargets = element('div', 'rw-admin-protected-targets');
      protectedTargets.appendChild(element('strong', '', '安装时会临时屏蔽/替换：'));
      for (const conflict of artifact.original_conflicts) {
        const target = conflict.target || {};
        const label = artifact.kind === 'script'
          ? `${target.scope || 'character'} · ${target.folder ? `${target.folder} / ` : ''}${target.name || target.id || '未知脚本'}`
          : `${target.worldbook || '当前角色世界书'} · ${target.name || target.uid || '未知条目'}`;
        protectedTargets.appendChild(element('div', 'rw-muted', label));
      }
      row.appendChild(protectedTargets);
    }

    const raw = typeof artifact.content === 'string'
      ? artifact.content
      : JSON.stringify(artifact.content, null, 2);
    const pre = element('pre', 'rw-detail');
    pre.textContent = raw.length > 6000 ? `${raw.slice(0, 6000)}\n…（界面仅预览前 6000 字符）` : raw;
    row.appendChild(pre);
    return row;
  }

  async function reviewAction(item, decision, modal) {
    const note = decision === 'approved'
      ? (host.prompt?.('审核备注（可留空）', '') ?? '')
      : (host.prompt?.('请输入驳回原因（必填）', '') ?? '');
    if (decision === 'rejected' && !note.trim()) throw new Error('驳回时必须填写原因');
    const label = decision === 'approved' ? '批准' : '驳回';
    const confirmed = host.confirm?.(`确认${label}“${item.name}”最新版本 v${item.latest_version}？`);
    if (!confirmed) return;
    await workshopApi.reviewProject(item.id, decision, note);
    modal?.close();
    await refreshProjects();
  }

  async function stateAction(item, action, modal) {
    const isArchive = action === 'archive';
    const note = host.prompt?.(isArchive ? '下架原因（建议填写）' : '恢复备注（可留空）', '') ?? '';
    const confirmed = host.confirm?.(
      isArchive
        ? '下架只影响公开展示，不会删除作品文件和审核记录。确认下架？'
        : '确认恢复这个作品的公开状态？',
    );
    if (!confirmed) return;
    await workshopApi.setAdminProjectState(item.id, action, note);
    modal?.close();
    await refreshProjects();
  }

  async function showReview(item) {
    const modal = openModal(`审核详情 · ${item.name}`, { wide: true });
    empty(modal.body, '正在加载审核资料...');

    try {
      const detail = await workshopApi.getPendingReview(item.id);
      const project = detail.project;
      modal.body.replaceChildren();

      if (project.has_cover) {
        const blob = await workshopApi.getAdminProjectCover(item.id);
        const url = host.URL.createObjectURL(blob);
        const cover = element('img', 'rw-detail-cover rw-admin-detail-cover');
        cover.src = url;
        cover.alt = `${project.name} 待审封面`;
        cover.onload = () => host.URL.revokeObjectURL(url);
        modal.body.appendChild(cover);
      }

      const heading = element('div', 'rw-detail-heading');
      const title = element('div', 'rw-detail-titlebox');
      title.append(
        element('h3', '', `${project.name} · v${project.latest_version}`),
        element('div', 'rw-project-author', `作者 · ${project.owner_name} · Discord ${project.owner_discord_id}`),
      );
      const state = element(
        'span',
        `rw-local-state rw-local-state--${project.review_status === 'approved' ? 'installed' : project.review_status === 'rejected' ? 'bad' : 'update'}`,
        reviewStatusLabel(project.review_status),
      );
      heading.append(title, state);
      modal.body.appendChild(heading);

      const meta = element('div', 'rw-meta');
      meta.append(
        element('span', 'rw-pill', categoryLabels[project.category] || project.category),
        element('span', 'rw-pill', `公开 v${project.published_version}`),
        element('span', 'rw-pill', `下载 ${project.downloads_count || 0}`),
        element('span', 'rw-pill', `点赞 ${project.likes_count || 0}`),
        element('span', 'rw-pill', `收藏 ${project.favorites_count || 0}`),
      );
      if (project.project_status === 'archived') meta.appendChild(element('span', 'rw-pill', '已下架'));
      for (const tag of project.tags || []) meta.appendChild(element('span', 'rw-pill', `#${tag}`));
      modal.body.appendChild(meta);
      modal.body.appendChild(element('div', 'rw-detail-description', project.summary || '暂无简介'));

      const facts = element('section', 'rw-admin-facts');
      facts.append(
        detailRow('版本更新说明', project.changelog || '无'),
        detailRow('上传时间', formatTime(project.version_created_at)),
        detailRow('提交审核', formatTime(project.submitted_at)),
        detailRow('最近审核', formatTime(project.reviewed_at)),
      );
      modal.body.appendChild(facts);

      if (project.dependencies?.length) {
        const dependencies = element('section', 'rw-detail-section');
        dependencies.append(
          element('strong', '', '项目依赖'),
          element('div', 'rw-muted', project.dependencies.map(dep => `${dep.project_id}@${dep.min_version}`).join('、')),
        );
        modal.body.appendChild(dependencies);
      }

      const artifacts = Array.isArray(detail.bundle?.artifacts) ? detail.bundle.artifacts : [];
      const artifactSection = element('section', 'rw-admin-section-block');
      artifactSection.appendChild(element('div', 'rw-admin-section-title', `版本内容 · ${artifacts.length} 项`));
      const artifactList = element('div', 'rw-admin-artifact-list');
      if (artifacts.length) artifactList.append(...artifacts.map(artifactPreview));
      else artifactList.appendChild(element('div', 'rw-muted', '这个版本没有可预览内容'));
      artifactSection.appendChild(artifactList);
      modal.body.appendChild(artifactSection);

      const historySection = element('section', 'rw-admin-section-block');
      historySection.appendChild(element('div', 'rw-admin-section-title', '版本与审核历史'));
      const history = element('div', 'rw-admin-history');
      for (const version of detail.versions || []) {
        const versionRow = element('div', 'rw-admin-history-row');
        versionRow.append(
          element('strong', '', `v${version.version} · ${reviewStatusLabel(version.review_status)}`),
          element('span', '', `${version.changelog || '无更新说明'} · ${formatTime(version.created_at)}`),
        );
        history.appendChild(versionRow);
      }
      for (const review of detail.reviews || []) {
        const reviewRow = element('div', `rw-admin-history-row rw-status ${statusClass(review.decision)}`);
        reviewRow.append(
          element('strong', '', `v${review.version} · ${review.decision === 'approved' ? '通过' : '拒绝'} · ${review.reviewer_name || '管理员'}`),
          element('span', '', `${review.note || '无备注'} · ${formatTime(review.created_at)}`),
        );
        history.appendChild(reviewRow);
      }
      historySection.appendChild(history);
      modal.body.appendChild(historySection);

      const auditDetails = element('details', 'rw-technical-details');
      auditDetails.appendChild(element('summary', '', `管理员审计日志 · ${detail.admin_audit?.length || 0} 条`));
      const auditList = element('div', 'rw-admin-history');
      for (const log of detail.admin_audit || []) {
        const auditRow = element('div', 'rw-admin-history-row');
        auditRow.append(
          element('strong', '', `v${log.project_version || '—'} · ${log.action} · ${log.actor_name || '管理员'}`),
          element('span', '', `${log.note || '无备注'} · ${formatTime(log.created_at)}`),
        );
        auditList.appendChild(auditRow);
      }
      if (!detail.admin_audit?.length) auditList.appendChild(element('div', 'rw-muted', '暂无管理员操作记录'));
      auditDetails.appendChild(auditList);
      modal.body.appendChild(auditDetails);

      const manifestDetails = element('details', 'rw-technical-details');
      manifestDetails.appendChild(element('summary', '', '查看 Manifest 技术清单'));
      const manifestPre = element('pre', 'rw-detail');
      manifestPre.textContent = JSON.stringify(detail.manifest, null, 2);
      manifestDetails.appendChild(manifestPre);
      modal.body.appendChild(manifestDetails);

      const actions = element('div', 'rw-row rw-admin-review-actions');
      if (project.review_status === 'pending' && project.project_status !== 'archived') {
        actions.append(
          button('批准版本', 'good', () => reviewAction(item, 'approved', modal)),
          button('驳回版本', 'danger', () => reviewAction(item, 'rejected', modal)),
        );
      }
      if (project.project_status === 'archived') {
        actions.appendChild(button('恢复作品', 'good', () => stateAction(item, 'restore', modal)));
      } else {
        actions.appendChild(button('下架作品', 'danger', () => stateAction(item, 'archive', modal)));
      }
      modal.body.appendChild(actions);
    } catch (error) {
      empty(modal.body, `加载失败：${error.message}`);
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
