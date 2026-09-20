import { parseDependencyText } from '../../services/projects/dependency-input.js';
import { scanPublishResources } from '../../services/publish-resources.js';
import { createSmartArtifactQueue } from '../../ui/smart-artifact-queue.js';
import { createInstallRulePicker } from '../../ui/install-rule-picker.js';

export function bindCreateProjectFlow({
  host,
  doc,
  overlay,
  nodes,
  workshopApi,
  notifyError,
  confirmDialog,
  openModal,
  refreshMine,
}) {
  const openButton = overlay.querySelector('[data-action="create-project-open"]');
  const cancelButtons = [...overlay.querySelectorAll('[data-action="create-project-cancel"]')];
  const projectType = nodes.createForm.querySelector('[name="category"]');

  let dirty = false;
  let rulesModal = null;
  let coverUrl = '';
  let queue = null;

  const revokeCoverPreview = () => {
    if (!coverUrl) return;
    try { host.URL.revokeObjectURL(coverUrl); } catch {}
    coverUrl = '';
  };

  const renderCover = () => {
    revokeCoverPreview();
    const selected = nodes.createCover.files?.[0] || null;
    if (!selected) {
      nodes.createCoverState.textContent = '可选。建议 16:9，选择后会立即预览。';
      nodes.createCoverPreview.hidden = true;
      nodes.createCoverPreview.removeAttribute('src');
      return;
    }
    coverUrl = host.URL.createObjectURL(selected);
    nodes.createCoverPreview.src = coverUrl;
    nodes.createCoverPreview.hidden = false;
    nodes.createCoverState.textContent = `已选择：${selected.name} · 尚未上传`;
    dirty = true;
  };

  const reset = () => {
    nodes.createForm.reset();
    queue?.clear();
    nodes.createVersion.value = '';
    nodes.createWorldbook.value = '';
    nodes.createRegex.value = '';
    nodes.createScript.value = '';
    nodes.createCover.value = '';
    nodes.createVersionState.textContent = '选择上面的对应入口；其他文件会自动识别。';
    revokeCoverPreview();
    nodes.createCoverPreview.hidden = true;
    nodes.createCoverPreview.removeAttribute('src');
    nodes.createCoverState.textContent = '可选。建议 16:9，选择后会立即预览。';
    dirty = false;
  };

  queue = createSmartArtifactQueue({
    doc,
    input: nodes.createVersion,
    list: nodes.createArtifactList,
    getProject: () => ({ category: projectType.value || 'extension' }),
    onChange: current => {
      nodes.createVersionState.textContent = current.count
        ? `已识别 ${current.count} 项：${current.summary()}`
        : '选择上面的对应入口；其他文件会自动识别。';
      if (current.count) dirty = true;
    },
  });

  async function addFiles(files) {
    try {
      await queue.addFiles(files);
    } catch (error) {
      nodes.createVersion.value = '';
      notifyError(error);
    }
  }

  const bindArtifactInput = (input, dropTarget, forcedKind = '') => {
    input.addEventListener('change', () => {
      const files = input.files;
      if (!files?.length) return;
      void (forcedKind ? queue.addFilesAs(files, forcedKind) : addFiles(files))
        .catch(error => notifyError(error))
        .finally(() => { input.value = ''; });
    });

    dropTarget.addEventListener('dragover', event => {
      event.preventDefault();
      dropTarget.classList.add('is-dragover');
    });
    dropTarget.addEventListener('dragleave', () => dropTarget.classList.remove('is-dragover'));
    dropTarget.addEventListener('drop', event => {
      event.preventDefault();
      dropTarget.classList.remove('is-dragover');
      const files = event.dataTransfer?.files;
      if (!files?.length) return;
      void (forcedKind ? queue.addFilesAs(files, forcedKind) : addFiles(files))
        .catch(error => notifyError(error));
    });
  };

  bindArtifactInput(
    nodes.createWorldbook,
    overlay.querySelector('[data-drop-target="create-worldbook"]'),
    'worldbook',
  );
  bindArtifactInput(
    nodes.createRegex,
    overlay.querySelector('[data-drop-target="create-regex"]'),
    'regex',
  );
  bindArtifactInput(
    nodes.createScript,
    overlay.querySelector('[data-drop-target="create-script"]'),
    'script',
  );
  bindArtifactInput(
    nodes.createVersion,
    overlay.querySelector('[data-drop-target="create-version"]'),
    '',
  );

  nodes.createCover.addEventListener('change', renderCover);
  const coverDrop = overlay.querySelector('[data-drop-target="create-cover"]');
  coverDrop.addEventListener('dragover', event => {
    event.preventDefault();
    coverDrop.classList.add('is-dragover');
  });
  coverDrop.addEventListener('dragleave', () => coverDrop.classList.remove('is-dragover'));
  coverDrop.addEventListener('drop', event => {
    event.preventDefault();
    coverDrop.classList.remove('is-dragover');
    const selected = event.dataTransfer?.files?.[0];
    if (!selected) return;
    try {
      const Transfer = host.DataTransfer || DataTransfer;
      const transfer = new Transfer();
      transfer.items.add(selected);
      nodes.createCover.files = transfer.files;
      renderCover();
    } catch {
      nodes.createCover.click();
    }
  });

  nodes.createForm.addEventListener('input', () => { dirty = true; });
  nodes.createForm.addEventListener('change', () => { dirty = true; });

  openButton?.addEventListener('click', () => {
    nodes.createForm.hidden = false;
    nodes.createForm.querySelector('[name="name"]')?.focus();
  });

  const closeCreate = async () => {
    if (dirty) {
      const confirmed = await confirmDialog({
        title: '放弃这次编辑？',
        message: '作品资料、已选择的文件和封面都还没有提交。关闭后会清空当前草稿。',
        confirmText: '放弃编辑',
        cancelText: '继续编辑',
        danger: true,
      });
      if (!confirmed) return;
    }
    rulesModal?.close({ force: true });
    rulesModal = null;
    reset();
    nodes.createForm.hidden = true;
  };
  cancelButtons.forEach(button => button.addEventListener('click', () => void closeCreate()));

  async function openRules(draft) {
    rulesModal?.close({ force: true });
    const modal = openModal('发布项目 · 检查与安装规则', {
      wide: true,
      onClose: () => { if (rulesModal === modal) rulesModal = null; },
    });
    rulesModal = modal;

    const loading = doc.createElement('div');
    loading.className = 'rw-empty';
    loading.textContent = '正在检查上传文件与当前酒馆资源…';
    modal.body.appendChild(loading);

    let resources = null;
    const needsScan = draft.artifacts.some(item => item.kind === 'worldbook' || item.kind === 'script');
    if (needsScan) {
      try {
        resources = await scanPublishResources();
      } catch (error) {
        resources = { worldbooks: [], scripts: [] };
        try {
          host.toastr?.warning?.(
            `无法扫描当前酒馆原版资源：${error.message}。仍可发布，但本次不能通过界面选择替换目标。`,
            '创意工坊',
          );
        } catch {}
      }
    }

    if (rulesModal !== modal || !modal.body.isConnected) return;
    modal.body.replaceChildren();
    const rules = createInstallRulePicker({ doc, artifacts: draft.artifacts, resources });
    modal.body.appendChild(rules.node);

    const note = doc.createElement('div');
    note.className = 'rw-maintenance-protection';
    note.append(
      Object.assign(doc.createElement('strong'), { textContent: '原版内容不会被删除' }),
      Object.assign(doc.createElement('div'), {
        textContent: '勾选的世界书条目或脚本只会在作品启用期间临时关闭。停用/卸载时按安装前快照恢复；玩家期间的修改不会被强制覆盖。',
      }),
    );
    modal.body.appendChild(note);

    const actions = doc.createElement('div');
    actions.className = 'rw-row rw-publish-final-actions';
    const back = doc.createElement('button');
    back.type = 'button';
    back.className = 'rw-button';
    back.textContent = '← 返回修改';
    const confirm = doc.createElement('button');
    confirm.type = 'button';
    confirm.className = 'rw-button good';
    confirm.textContent = '提交审核';
    actions.append(back, confirm);
    modal.body.appendChild(actions);

    back.addEventListener('click', () => rulesModal?.close({ force: true }));
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      back.disabled = true;
      let createdProjectId = null;
      try {
        const finalArtifacts = rules.buildArtifacts();
        const bundle = queue.bundle(finalArtifacts);

        confirm.textContent = '正在创建作品…';
        const created = await workshopApi.createProject({
          name: draft.name,
          summary: draft.summary,
          category: draft.category,
          tags: draft.tags,
          dependencies: draft.dependencies,
        });
        createdProjectId = created.project.id;

        confirm.textContent = '正在上传内容…';
        await workshopApi.uploadProjectVersion(createdProjectId, { changelog: '', bundle });

        if (draft.cover) {
          confirm.textContent = '正在上传封面…';
          await workshopApi.uploadProjectCover(createdProjectId, draft.cover);
        }

        confirm.textContent = '正在提交审核…';
        await workshopApi.submitProject(createdProjectId);

        dirty = false;
        rulesModal?.close({ force: true });
        rulesModal = null;
        reset();
        nodes.createForm.hidden = true;
        try { host.toastr?.success?.('作品已提交审核', '创意工坊'); } catch {}
        await refreshMine();
      } catch (error) {
        notifyError(error);
        if (createdProjectId) {
          try {
            host.toastr?.warning?.(
              '提交过程中断，服务器可能保留了一个未发布草稿，可在“我的项目”中继续处理。',
              '创意工坊',
            );
          } catch {}
        }
      } finally {
        if (confirm.isConnected) {
          confirm.disabled = false;
          back.disabled = false;
          confirm.textContent = '提交审核';
        }
      }
    });
  }

  nodes.createForm.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(nodes.createForm);
    const name = String(form.get('name') || '').trim();
    const summary = String(form.get('summary') || '');
    const category = String(form.get('category') || 'extension');
    const tags = String(form.get('tags') || '')
      .split(/[,，\n]/u)
      .map(value => value.trim())
      .filter(Boolean);

    if (!name) return notifyError(new Error('请先填写作品名称'));
    if (!queue.count) return notifyError(new Error('请至少拖入一个作品内容文件'));

    let dependencies;
    try {
      dependencies = parseDependencyText(form.get('dependencies'));
    } catch (error) {
      notifyError(error);
      return;
    }

    void openRules({
      name,
      summary,
      category,
      tags,
      dependencies,
      cover: nodes.createCover.files?.[0] || null,
      artifacts: queue.artifacts(),
    });
  });

  return {
    reset,
    destroy() {
      revokeCoverPreview();
      rulesModal?.close({ force: true });
    },
  };
}
