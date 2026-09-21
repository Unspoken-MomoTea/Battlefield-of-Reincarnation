import { createAuthorProjectEditor } from './author/project-editor.js';

export function createAuthorView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  doc,
  host,
  categoryLabels,
  statusLabels,
  getAuth,
  notifyError,
  confirmDialog,
  openModal,
}) {
  function deleteErrorMessage(error, project) {
    if (
      (project.status === 'archived' || project.owner_hidden) &&
      (error?.code === 'published_project_delete_forbidden' || error?.status === 404 || error?.status === 405)
    ) {
      return '服务器仍是旧版，尚未启用下架后删除能力。请更新并重新部署 Workshop Worker 后再试。';
    }
    return error instanceof Error ? error.message : String(error);
  }

  function showDeleteFailure(project, error) {
    const modal = openModal('删除失败', { wide: false });
    const box = element('div', 'rw-delete-error');
    box.append(
      element('strong', '', `“${project.name}”没有被删除`),
      element('div', '', deleteErrorMessage(error, project)),
    );
    const actions = element('div', 'rw-row');
    actions.appendChild(button('知道了', 'primary', () => modal.close({ force: true })));
    modal.body.append(box, actions);
  }

  const projectEditor = createAuthorProjectEditor({
    host,
    doc,
    workshopApi,
    openModal,
    button,
    element,
    notifyError,
    categoryLabels,
    refreshMine,
  });

  async function loadOwnCover(project, image) {
    if (!project.has_cover) return;
    try {
      const blob = await workshopApi.getOwnProjectCover(project.id);
      const url = host.URL.createObjectURL(blob);
      image.src = url;
      image.onload = () => {
        try { host.URL.revokeObjectURL(url); } catch {}
      };
    } catch {}
  }

  async function toggleVisibility(project, hidden) {
    const confirmed = await confirmDialog({
      title: hidden ? `下架“${project.name}”？` : `重新上架“${project.name}”？`,
      message: hidden
        ? '下架只停止公开展示，不会删除作品、版本或审核记录。你仍然可以继续更新作品，也可以稍后重新上架。'
        : '会重新公开当前已经审核通过的版本；如果作品被管理员下架，则仍需要管理员恢复。',
      confirmText: hidden ? '下架作品' : '重新上架',
      cancelText: '取消',
      danger: hidden,
    });
    if (!confirmed) return;

    try {
      await workshopApi.setProjectVisibility(project.id, hidden);
      try {
        host.toastr?.success?.(
          hidden ? '作品已从公开工坊下架' : '作品已重新公开',
          '创意工坊',
        );
      } catch {}
      await refreshMine();
    } catch (error) {
      notifyError(error);
    }
  }

  async function deleteProjectAction(project) {
    const confirmed = await confirmDialog({
      title: `删除“${project.name}”？`,
      message: Number(project.published_version) > 0
        ? '删除后会清理这个作品的全部版本、Manifest、封面、互动记录和服务器文件，且无法恢复。'
        : '删除后会清理这个草稿的版本文件和封面，且无法恢复。',
      confirmText: '删除作品',
      cancelText: '取消',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await workshopApi.deleteProject(project.id);
      try { host.toastr?.success?.('作品已删除', '创意工坊'); } catch {}
      await refreshMine();
    } catch (error) {
      showDeleteFailure(project, error);
    }
  }

  async function submitExisting(project) {
    try {
      await workshopApi.submitProject(project.id);
      try { host.toastr?.success?.('作品已提交审核', '创意工坊'); } catch {}
      await refreshMine();
    } catch (error) {
      notifyError(error);
    }
  }

  function ownProjectCard(project) {
    const card = element('article', 'rw-card rw-author-project-card');

    if (project.has_cover) {
      const cover = element('img', 'rw-cover');
      cover.alt = project.name + ' 封面';
      cover.loading = 'lazy';
      card.appendChild(cover);
      void loadOwnCover(project, cover);
    } else {
      const placeholder = element('div', 'rw-cover rw-cover-placeholder');
      placeholder.textContent = categoryLabels[project.category] || '创意工坊';
      card.appendChild(placeholder);
    }

    const menu = element('div', 'rw-card-menu');
    const menuTrigger = button('⋯', 'rw-card-menu-trigger', () => {
      menuDropdown.hidden = !menuDropdown.hidden;
    });
    menuTrigger.setAttribute('aria-label', '作品管理');
    const menuDropdown = element('div', 'rw-card-menu-dropdown');
    menuDropdown.hidden = true;

    if (project.status !== 'pending' && project.status !== 'archived') {
      menuDropdown.appendChild(button('更新作品', '', () => {
        menuDropdown.hidden = true;
        void projectEditor.open(project);
      }));
    }

    if (Number(project.published_version) > 0 && project.status !== 'archived') {
      menuDropdown.appendChild(button(
        project.owner_hidden ? '重新上架' : '下架作品',
        project.owner_hidden ? 'good' : '',
        () => {
          menuDropdown.hidden = true;
          void toggleVisibility(project, !project.owner_hidden);
        },
      ));
    }

    const canDelete = project.status !== 'pending' &&
      (
        Number(project.published_version) === 0 ||
        project.status === 'archived' ||
        Boolean(project.owner_hidden)
      );
    if (canDelete) {
      menuDropdown.appendChild(button('删除作品', 'danger', () => {
        menuDropdown.hidden = true;
        void deleteProjectAction(project);
      }));
    }

    menu.append(menuTrigger, menuDropdown);
    card.appendChild(menu);

    card.appendChild(element('h3', '', project.name));

    const meta = element('div', 'rw-meta');
    meta.append(
      element('span', 'rw-pill', categoryLabels[project.category] || project.category),
      element('span', 'rw-pill', statusLabels[project.status] || project.status),
      element('span', 'rw-pill', `最新 v${project.latest_version}`),
      element('span', 'rw-pill', `公开 v${project.published_version}`),
    );
    if (project.owner_hidden) meta.append(element('span', 'rw-pill rw-pill--warning', '作者已下架'));
    if (project.has_cover) meta.append(element('span', 'rw-pill', '已有封面'));
    if (project.dependencies?.length) meta.append(element('span', 'rw-pill', `依赖 ${project.dependencies.length}`));
    for (const tag of project.tags || []) meta.append(element('span', 'rw-pill', `#${tag}`));
    card.appendChild(meta);

    card.appendChild(element('div', 'rw-muted', project.summary || '暂无简介'));

    if (project.owner_hidden && project.status !== 'archived') {
      card.appendChild(element(
        'div',
        'rw-status rw-author-owner-hidden',
        '你已主动下架这个作品。当前审核通过版本不会出现在公开工坊，但仍可继续更新或重新上架。',
      ));
    }

    if (project.status === 'rejected' && project.review_note) {
      card.appendChild(element('div', 'rw-status bad', `审核意见：${project.review_note}`));
    }

    if (project.status === 'archived') {
      const archivedAt = Number(project.archived_at || 0)
        ? new Date(Number(project.archived_at) * 1000).toLocaleString()
        : '';
      const archiveText = [
        '管理员已下架此作品',
        project.archive_note ? `原因：${project.archive_note}` : '未填写下架原因',
        archivedAt ? `时间：${archivedAt}` : '',
        '管理员恢复之前不能重新公开或提交新版本。',
      ].filter(Boolean).join('\n');
      card.appendChild(element('div', 'rw-status bad rw-author-archive-status', archiveText));
    }

    const actions = element('div', 'rw-row rw-author-card-actions');
    if (project.status !== 'pending' && project.status !== 'archived') {
      actions.appendChild(button(
        Number(project.latest_version) > 0 ? '更新作品' : '完善作品',
        'primary',
        () => void projectEditor.open(project),
      ));
    }

    if (Number(project.latest_version) > 0 && ['draft', 'rejected'].includes(project.status)) {
      actions.appendChild(button(
        project.status === 'rejected' ? '重新提交审核' : '提交审核',
        'good',
        () => void submitExisting(project),
      ));
    } else if (project.status === 'pending') {
      actions.appendChild(element('span', 'rw-status', '正在等待审核'));
    }

    card.appendChild(actions);
    return card;
  }

  async function refreshMine() {
    if (!getAuth()?.user) return empty(nodes.myList, '请先使用 Discord 登录');
    try {
      const result = await workshopApi.listOwnProjects();
      if (!result.items.length) return empty(nodes.myList, '你还没有创建作品');
      nodes.myList.replaceChildren(...result.items.map(ownProjectCard));
    } catch (error) {
      empty(nodes.myList, `加载失败：${error.message}`);
    }
  }

  return {
    refresh: refreshMine,
    destroy() {
      projectEditor.destroy();
    },
  };
}
