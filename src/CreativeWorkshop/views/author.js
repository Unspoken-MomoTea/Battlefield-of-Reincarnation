export function createAuthorView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  buildUploadBundle,
  doc,
  host,
  categoryLabels,
  statusLabels,
  getAuth,
}) {
  function ownProjectCard(project) {
    const card = element('article', 'rw-card');
    card.appendChild(element('h3', '', project.name));
    const meta = element('div', 'rw-meta');
    meta.append(element('span', 'rw-pill', categoryLabels[project.category] || project.category));
    meta.append(element('span', 'rw-pill', statusLabels[project.status] || project.status));
    meta.append(element('span', 'rw-pill', `最新 v${project.latest_version}`));
    meta.append(element('span', 'rw-pill', `公开 v${project.published_version}`));
    for (const tag of project.tags || []) meta.append(element('span', 'rw-pill', `#${tag}`));
    card.appendChild(meta);
    card.appendChild(element('div', 'rw-muted', project.summary || '暂无简介'));
    if (project.status === 'rejected' && project.review_note) {
      card.appendChild(element('div', 'rw-status bad', `审核意见：${project.review_note}`));
    }

    const file = element('input', 'rw-input');
    file.type = 'file';
    file.accept = '.json,.txt,application/json,text/plain';
    const changelog = element('input', 'rw-input grow');
    changelog.placeholder = '版本更新说明';
    changelog.maxLength = 2000;
    const kind = element('select', 'rw-select');
    for (const value of ['worldbook', 'regex', 'preset', 'data']) {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = categoryLabels[value];
      if (value === project.category) option.selected = true;
      kind.appendChild(option);
    }
    kind.hidden = project.category !== 'mixed';
    card.append(file, changelog, kind);

    const actions = element('div', 'rw-row');
    actions.appendChild(button('编辑资料', '', async () => {
      const name = host.prompt?.('作品名称', project.name);
      if (name === null || name === undefined) return;
      const summary = host.prompt?.('作品简介', project.summary || '');
      if (summary === null || summary === undefined) return;
      const tagsText = host.prompt?.('标签（逗号分隔）', (project.tags || []).join(', '));
      if (tagsText === null || tagsText === undefined) return;
      const tags = String(tagsText)
        .split(/[,，\n]/u)
        .map(value => value.trim())
        .filter(Boolean);
      await workshopApi.updateProject(project.id, { name, summary, tags });
      await refreshMine();
    }));
    actions.appendChild(button('上传新版本', 'primary', async () => {
      const selected = file.files?.[0];
      if (!selected) throw new Error('请先选择 .json 或 .txt 文件');
      const raw = await selected.text();
      const bundle = buildUploadBundle(project, selected.name, raw, kind.value);
      await workshopApi.uploadProjectVersion(project.id, {
        changelog: changelog.value,
        bundle,
      });
      await refreshMine();
    }));
    actions.appendChild(button('提交审核', 'good', async () => {
      await workshopApi.submitProject(project.id);
      await refreshMine();
    }));
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
  return { refresh: refreshMine };
}
