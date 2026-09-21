import { scanPublishResources } from '../../services/publish-resources.js';
import { createDependencyPicker } from '../../ui/dependency-picker.js';
import { createInstallRulePicker } from '../../ui/install-rule-picker.js';
import { createSmartArtifactQueue } from '../../ui/smart-artifact-queue.js';

function tagsFromInput(value) {
  return String(value || '')
    .split(/[,，\n]/u)
    .map(item => item.trim())
    .filter(Boolean);
}

export function createAuthorProjectEditor({
  host,
  doc,
  workshopApi,
  openModal,
  button,
  element,
  notifyError,
  refreshMine,
  categoryLabels,
}) {
  let activeModal = null;
  let coverUrl = '';

  function revokeCover() {
    if (!coverUrl) return;
    try { host.URL.revokeObjectURL(coverUrl); } catch {}
    coverUrl = '';
  }

  function dropBinding(target, input, handler) {
    target.addEventListener('dragover', event => {
      event.preventDefault();
      target.classList.add('is-dragover');
    });
    target.addEventListener('dragleave', () => target.classList.remove('is-dragover'));
    target.addEventListener('drop', event => {
      event.preventDefault();
      target.classList.remove('is-dragover');
      const files = event.dataTransfer?.files;
      if (!files?.length) return;
      void handler(files);
    });
  }

  async function open(project) {
    activeModal?.close?.({ force: true });
    revokeCover();

    if (project.status === 'pending') {
      try { host.toastr?.info?.('这个版本正在审核，审核结束后才能继续修改', '创意工坊'); } catch {}
      return;
    }
    if (project.status === 'archived') {
      try { host.toastr?.warning?.('该作品被管理员下架，需管理员恢复后才能继续更新', '创意工坊'); } catch {}
      return;
    }

    const modal = openModal(`更新作品 · ${project.name}`, {
      extraWide: true,
      onClose: () => {
        revokeCover();
        if (activeModal === modal) activeModal = null;
      },
    });
    activeModal = modal;
    modal.panel.classList.add('rw-author-update-modal');
    modal.body.textContent = '正在读取当前作品资料与版本内容…';

    let detail;
    try {
      detail = await workshopApi.getOwnProjectEditor(project.id);
    } catch (error) {
      modal.body.textContent = `读取失败：${error instanceof Error ? error.message : String(error)}`;
      notifyError(error);
      return;
    }

    if (activeModal !== modal) return;

    const current = detail.project;
    const latest = detail.latest || { bundle: { artifacts: [] } };
    const artifacts = Array.isArray(latest.bundle?.artifacts) ? latest.bundle.artifacts : [];

    const form = element('form', 'rw-update-form');
    const grid = element('div', 'rw-publish-grid rw-update-grid');
    const left = element('section', 'rw-publish-column');
    const right = element('section', 'rw-publish-column rw-publish-upload-column');

    const step1 = element('div', 'rw-publish-step-title');
    step1.innerHTML = '<span>01</span><div><strong>基本资料</strong><small>直接在上一版资料上修改，不需要重新填写。</small></div>';
    left.appendChild(step1);

    const name = element('input', 'rw-input');
    name.name = 'name';
    name.maxLength = 80;
    name.value = current.name || '';

    const summary = element('textarea', 'rw-textarea rw-publish-summary');
    summary.name = 'summary';
    summary.maxLength = 2000;
    summary.value = current.summary || '';

    const category = element('select', 'rw-select');
    category.name = 'category';
    for (const value of ['extension', 'character']) {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = categoryLabels[value] || value;
      option.selected = value === current.category;
      category.appendChild(option);
    }
    category.disabled = Number(current.published_version || 0) > 0;

    const tags = element('input', 'rw-input');
    tags.name = 'tags';
    tags.maxLength = 300;
    tags.value = (current.tags || []).join(', ');

    const field = (label, control) => {
      const wrapper = element('label', 'rw-field');
      wrapper.append(element('span', '', label), control);
      return wrapper;
    };

    left.append(
      field('作品名称 *', name),
      field('作品简介', summary),
      element('div', 'rw-publish-divider'),
    );

    const step2 = element('div', 'rw-publish-step-title');
    step2.innerHTML = '<span>02</span><div><strong>分类与标签</strong><small>已发布作品的顶层分类保持不变。</small></div>';
    left.append(step2, field('分类 *', category), field('标签（可选）', tags));

    const depDetails = element('details', 'rw-publish-advanced');
    depDetails.innerHTML = '<summary>高级：项目依赖（可选）</summary>';
    const dependencies = createDependencyPicker({
      doc,
      workshopApi,
      openModal,
      button,
      initial: current.dependencies || [],
      excludeProjectId: current.id,
    });
    depDetails.appendChild(dependencies.node);
    left.appendChild(depDetails);

    const step3 = element('div', 'rw-publish-step-title');
    step3.innerHTML = '<span>03</span><div><strong>版本内容</strong><small>当前版本已经载入；上传同名文件会替换旧内容。</small></div>';
    right.appendChild(step3);

    const changelog = element('textarea', 'rw-textarea rw-update-changelog');
    changelog.maxLength = 2000;
    changelog.placeholder = '这次更新了什么？建议让玩家和审核员一眼看懂。';
    if (current.status === 'rejected') changelog.value = latest.changelog || '';
    right.appendChild(field('版本更新说明', changelog));

    const uploadBlock = element('div', 'rw-publish-upload-block');
    uploadBlock.appendChild(element('span', 'rw-field-label', '作品文件 *'));

    const slots = element('div', 'rw-publish-upload-slots');
    const inputs = [];
    const kinds = [
      ['worldbook', '书', '世界书', '选择世界书 JSON', '.json,application/json'],
      ['regex', '正', '正则', '选择 SillyTavern 正则 JSON', '.json,application/json'],
      ['script', 'JS', '酒馆助手脚本', '选择 JS 或 ScriptTree JSON', '.js,.mjs,.json,application/json,text/javascript,application/javascript'],
    ];
    for (const [kind, icon, title, note, accept] of kinds) {
      const zone = element('label', 'rw-smart-dropzone rw-smart-dropzone--compact');
      const input = doc.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = accept;
      input.hidden = true;
      zone.append(
        element('span', 'rw-smart-dropzone-icon', icon),
        element('strong', '', title),
        element('small', '', note),
        input,
      );
      slots.appendChild(zone);
      inputs.push({ kind, input, zone });
    }
    uploadBlock.appendChild(slots);

    const queueState = element('div', 'rw-file-state');
    const queueList = element('div', 'rw-artifact-list rw-smart-artifact-list');
    queueList.hidden = true;
    const queueInput = doc.createElement('input');
    queueInput.type = 'file';
    queueInput.hidden = true;
    const queue = createSmartArtifactQueue({
      doc,
      input: queueInput,
      list: queueList,
      getProject: () => ({ category: category.value || current.category }),
      onChange: value => {
        queueState.textContent = value.count
          ? `当前版本共 ${value.count} 项：${value.summary()}。上传同名文件会替换对应旧项。`
          : '当前版本没有作品内容，请至少添加一项。';
      },
    });
    queue.loadArtifacts(artifacts, `当前 v${latest.version || current.latest_version || 0}`);

    for (const { kind, input, zone } of inputs) {
      const add = async files => {
        try {
          await queue.addFilesAs(files, kind);
        } catch (error) {
          notifyError(error);
        } finally {
          input.value = '';
        }
      };
      input.addEventListener('change', () => {
        if (input.files?.length) void add(input.files);
      });
      dropBinding(zone, input, add);
    }
    uploadBlock.append(queueState, queueList);
    right.appendChild(uploadBlock);

    right.appendChild(element('div', 'rw-publish-divider'));

    const coverBlock = element('div', 'rw-publish-upload-block');
    coverBlock.appendChild(element('span', 'rw-field-label', '封面图（可选）'));
    const coverZone = element('label', 'rw-cover-dropzone rw-update-cover-zone');
    const coverPreview = doc.createElement('img');
    coverPreview.alt = '封面预览';
    coverPreview.hidden = true;
    const coverEmpty = element('div', 'rw-cover-dropzone-empty');
    coverEmpty.append(
      element('span', '', '▧'),
      element('strong', '', current.has_cover ? '保留当前封面，或选择新封面' : '拖入或选择封面'),
      element('small', '', 'PNG / JPEG / WebP · 建议 16:9'),
    );
    const coverInput = doc.createElement('input');
    coverInput.type = 'file';
    coverInput.accept = 'image/png,image/jpeg,image/webp';
    coverInput.hidden = true;
    coverZone.append(coverPreview, coverEmpty, coverInput);

    const coverState = element(
      'div',
      'rw-file-state',
      current.has_cover ? '当前封面会继续保留；只有选择新图片才会替换。' : '尚未设置封面。',
    );
    coverBlock.append(coverZone, coverState);
    right.appendChild(coverBlock);

    const showCoverBlob = blob => {
      revokeCover();
      coverUrl = host.URL.createObjectURL(blob);
      coverPreview.src = coverUrl;
      coverPreview.hidden = false;
    };

    if (current.has_cover) {
      try {
        showCoverBlob(await workshopApi.getOwnProjectCover(current.id));
      } catch {}
    }

    const renderSelectedCover = () => {
      const selected = coverInput.files?.[0];
      if (!selected) return;
      showCoverBlob(selected);
      coverState.textContent = `将替换为：${selected.name}`;
    };
    coverInput.addEventListener('change', renderSelectedCover);
    dropBinding(coverZone, coverInput, files => {
      const selected = files?.[0];
      if (!selected) return;
      try {
        const Transfer = host.DataTransfer || DataTransfer;
        const transfer = new Transfer();
        transfer.items.add(selected);
        coverInput.files = transfer.files;
        renderSelectedCover();
      } catch {
        coverInput.click();
      }
    });

    grid.append(left, right);
    form.appendChild(grid);

    const footer = element('footer', 'rw-publish-footer rw-update-footer');
    footer.append(
      element('div', 'rw-publish-footer-note', '● 下一步只会显示当前酒馆正在启用的世界书/脚本，供你选择需要临时关闭的原版内容。'),
    );
    const footerActions = element('div', 'rw-row');
    const cancel = button('取消', '', () => modal.close());
    const next = button('下一步', 'primary', () => void openRules());
    footerActions.append(cancel, next);
    footer.appendChild(footerActions);
    form.appendChild(footer);

    modal.body.replaceChildren(form);

    async function openRules() {
      const nextName = name.value.trim();
      if (!nextName) return notifyError(new Error('请填写作品名称'));
      if (!queue.count) return notifyError(new Error('作品内容不能为空'));

      next.disabled = true;
      let resources = { worldbooks: [], scripts: [] };
      try {
        if (queue.artifacts().some(item => item.kind === 'worldbook' || item.kind === 'script')) {
          resources = await scanPublishResources();
        }
      } catch (error) {
        try { host.toastr?.warning?.(`读取当前酒馆资源失败：${error.message}`, '创意工坊'); } catch {}
      } finally {
        next.disabled = false;
      }

      const rulesView = element('div', 'rw-update-rules-view');
      const rules = createInstallRulePicker({
        doc,
        artifacts: queue.artifacts(),
        resources,
      });
      rulesView.appendChild(rules.node);

      const note = element('div', 'rw-maintenance-protection');
      note.append(
        element('strong', '', '原版内容只会临时关闭'),
        element('div', '', '勾选的世界书条目或脚本会在作品启用期间关闭；停用/卸载时按安装前状态恢复。'),
      );
      rulesView.appendChild(note);

      const progress = element('div', 'rw-submit-progress');
      progress.hidden = true;
      rulesView.appendChild(progress);

      const actions = element('div', 'rw-row rw-publish-final-actions');
      const back = button('← 返回修改', '', () => modal.body.replaceChildren(form));
      const selectedCover = coverInput.files?.[0] || null;
      const attempt = {
        metadataSaved: false,
        coverUploaded: !selectedCover,
        versionUploaded: false,
        submitted: false,
      };
      const submit = button('提交新版本审核', 'good', async () => {
        submit.disabled = true;
        back.disabled = true;
        progress.hidden = false;
        progress.className = 'rw-submit-progress rw-submit-progress--working';
        progress.textContent = '正在保存作品资料…';

        try {
          if (!attempt.metadataSaved) {
            await workshopApi.updateProject(current.id, {
              name: nextName,
              summary: summary.value,
              category: category.value || current.category,
              tags: tagsFromInput(tags.value),
              dependencies: dependencies.values(),
            });
            attempt.metadataSaved = true;
          }

          if (selectedCover && !attempt.coverUploaded) {
            progress.textContent = '正在更新封面…';
            await workshopApi.uploadProjectCover(current.id, selectedCover);
            attempt.coverUploaded = true;
          }

          if (!attempt.versionUploaded) {
            progress.textContent = '正在上传新版本…';
            await workshopApi.uploadProjectVersion(current.id, {
              changelog: changelog.value,
              bundle: queue.bundle(rules.buildArtifacts()),
            });
            attempt.versionUploaded = true;
          }

          if (!attempt.submitted) {
            progress.textContent = '正在提交审核…';
            await workshopApi.submitProject(current.id);
            attempt.submitted = true;
          }

          progress.className = 'rw-submit-progress rw-submit-progress--success';
          progress.textContent = '新版本已提交审核。旧的已发布版本会保持在线，直到新版本审核通过。';
          try { host.toastr?.success?.('新版本已提交审核', '创意工坊'); } catch {}
          try { await refreshMine(); } catch {}

          host.setTimeout?.(() => modal.close({ force: true }), 650);
        } catch (error) {
          progress.className = 'rw-submit-progress rw-submit-progress--error';
          const failedAt = !attempt.metadataSaved
            ? '保存资料'
            : !attempt.coverUploaded
              ? '上传封面'
              : !attempt.versionUploaded
                ? '上传新版本'
                : '提交审核';
          progress.textContent = `${failedAt}失败：${error instanceof Error ? error.message : String(error)}\n再次点击会从失败步骤继续，不会重复上传已经成功的版本。`;
          notifyError(error);
          submit.disabled = false;
          back.disabled = false;
        }
      });
      actions.append(back, submit);
      rulesView.appendChild(actions);
      modal.body.replaceChildren(rulesView);
    }
  }

  return {
    open,
    destroy() {
      activeModal?.close?.({ force: true });
      activeModal = null;
      revokeCover();
    },
  };
}
