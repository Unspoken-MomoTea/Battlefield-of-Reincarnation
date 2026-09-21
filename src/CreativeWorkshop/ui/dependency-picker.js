function clone(value) {
  return structuredClone(value);
}

function dependencyKey(item) {
  return String(item?.project_id || '');
}

export function createDependencyPicker({
  doc,
  workshopApi,
  openModal,
  button,
  initial = [],
  excludeProjectId = '',
}) {
  const root = doc.createElement('div');
  root.className = 'rw-dependency-picker';

  const selectedList = doc.createElement('div');
  selectedList.className = 'rw-dependency-selected';

  const addButton = button('＋ 添加依赖项目', 'rw-dependency-add', () => void openSearch());
  const hint = doc.createElement('div');
  hint.className = 'rw-muted rw-dependency-hint';
  hint.textContent = '只有当这个作品必须先安装另一个工坊作品时才需要添加。直接搜索作品名称即可，不用填写项目 ID。';

  root.append(selectedList, addButton, hint);

  const selected = new Map();
  const labels = new Map();

  for (const item of Array.isArray(initial) ? initial : []) {
    const key = dependencyKey(item);
    if (!key || key === excludeProjectId) continue;
    selected.set(key, {
      project_id: key,
      min_version: Math.max(1, Number(item.min_version || 1)),
    });
  }

  function renderSelected() {
    selectedList.replaceChildren();
    if (!selected.size) {
      const empty = doc.createElement('div');
      empty.className = 'rw-dependency-empty';
      empty.textContent = '未设置依赖';
      selectedList.appendChild(empty);
      return;
    }

    for (const dependency of selected.values()) {
      const row = doc.createElement('div');
      row.className = 'rw-dependency-row';

      const copy = doc.createElement('div');
      copy.className = 'rw-dependency-copy';
      const strong = doc.createElement('strong');
      strong.textContent = labels.get(dependency.project_id)?.name || '已选择的工坊项目';
      const meta = doc.createElement('span');
      const known = labels.get(dependency.project_id);
      meta.textContent = known
        ? [known.owner_name ? `作者：${known.owner_name}` : '', known.version ? `当前 v${known.version}` : '']
            .filter(Boolean).join(' · ')
        : '正在读取项目资料…';
      copy.append(strong, meta);

      const versionWrap = doc.createElement('label');
      versionWrap.className = 'rw-dependency-version';
      const label = doc.createElement('span');
      label.textContent = '最低 v';
      const input = doc.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.step = '1';
      input.value = String(dependency.min_version || 1);
      input.addEventListener('change', () => {
        const value = Math.max(1, Number.parseInt(input.value || '1', 10) || 1);
        dependency.min_version = value;
        input.value = String(value);
      });
      versionWrap.append(label, input);

      const remove = button('移除', 'danger rw-dependency-remove', () => {
        selected.delete(dependency.project_id);
        labels.delete(dependency.project_id);
        renderSelected();
      });

      row.append(copy, versionWrap, remove);
      selectedList.appendChild(row);
    }
  }

  async function hydrateLabels() {
    const ids = [...selected.keys()];
    await Promise.all(ids.map(async id => {
      try {
        const detail = await workshopApi.getProject(id);
        if (detail?.project) labels.set(id, detail.project);
      } catch {}
    }));
    renderSelected();
  }

  async function openSearch() {
    const modal = openModal('选择依赖项目', { wide: true });
    const shell = doc.createElement('div');
    shell.className = 'rw-dependency-search';

    const searchRow = doc.createElement('div');
    searchRow.className = 'rw-row';
    const input = doc.createElement('input');
    input.className = 'rw-input grow';
    input.placeholder = '搜索作品名称、简介或作者';
    const searchButton = button('搜索', 'primary', () => void search());
    searchRow.append(input, searchButton);

    const results = doc.createElement('div');
    results.className = 'rw-dependency-results';
    shell.append(searchRow, results);
    modal.body.appendChild(shell);

    async function search() {
      searchButton.disabled = true;
      results.textContent = '正在搜索…';
      try {
        const response = await workshopApi.listProjects(input.value, '', 0, '', 'latest');
        const items = (response.items || [])
          .filter(item => item.id !== excludeProjectId);
        results.replaceChildren();

        if (!items.length) {
          const empty = doc.createElement('div');
          empty.className = 'rw-content-empty';
          empty.textContent = '没有找到可作为依赖的已发布作品。';
          results.appendChild(empty);
          return;
        }

        for (const project of items) {
          const row = doc.createElement('article');
          row.className = 'rw-dependency-result';

          const copy = doc.createElement('div');
          copy.className = 'rw-dependency-copy';
          const title = doc.createElement('strong');
          title.textContent = project.name;
          const meta = doc.createElement('span');
          meta.textContent = [
            project.owner_name ? `作者：${project.owner_name}` : '',
            `v${project.version}`,
            project.category === 'character' ? '角色' : '扩展',
          ].filter(Boolean).join(' · ');
          const summary = doc.createElement('small');
          summary.textContent = project.summary || '暂无简介';
          copy.append(title, meta, summary);

          const already = selected.has(project.id);
          const choose = button(already ? '已添加' : '添加', already ? '' : 'good', () => {
            selected.set(project.id, {
              project_id: project.id,
              min_version: Math.max(1, Number(project.version || 1)),
            });
            labels.set(project.id, project);
            renderSelected();
            choose.textContent = '已添加';
            choose.disabled = true;
          });
          choose.disabled = already;

          row.append(copy, choose);
          results.appendChild(row);
        }
      } catch (error) {
        results.textContent = `搜索失败：${error instanceof Error ? error.message : String(error)}`;
      } finally {
        searchButton.disabled = false;
      }
    }

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void search();
      }
    });
    void search();
    input.focus();
  }

  function setDependencies(next) {
    selected.clear();
    labels.clear();
    for (const item of Array.isArray(next) ? next : []) {
      const key = dependencyKey(item);
      if (!key || key === excludeProjectId) continue;
      selected.set(key, {
        project_id: key,
        min_version: Math.max(1, Number(item.min_version || 1)),
      });
    }
    renderSelected();
    void hydrateLabels();
  }

  function values() {
    return clone([...selected.values()]);
  }

  renderSelected();
  void hydrateLabels();

  return {
    node: root,
    values,
    setDependencies,
    clear() {
      selected.clear();
      labels.clear();
      renderSelected();
    },
  };
}
