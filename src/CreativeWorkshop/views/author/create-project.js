import { createDependencyPicker } from '../../ui/dependency-picker.js';
import { createResourceStateEditor } from '../../ui/resource-state-editor.js';
import { createSmartArtifactQueue } from '../../ui/smart-artifact-queue.js';
import {
  buildDedicatedArtifacts,
  projectCategoryForSelection,
  resolvePublishMode,
} from './publish-templates.js';
import { createDedicatedPublishEditor } from './dedicated-editor.js';

export function bindCreateProjectFlow({
  host,
  doc,
  overlay,
  nodes,
  workshopApi,
  projectService,
  notifyError,
  confirmDialog,
  openModal,
  refreshMine,
}) {
  const openButton = overlay.querySelector('[data-action="create-project-open"]');
  const cancelButtons = [...overlay.querySelectorAll('[data-action="create-project-cancel"]')];
  const projectType = nodes.createForm.querySelector('[name="category"]');
  const characterKindField = nodes.createForm.querySelector('[data-role="character-kind-field"]');
  const characterKind = nodes.createForm.querySelector('[name="character_kind"]');
  const extensionPanel = nodes.createForm.querySelector('[data-publish-panel="extension"]');
  const dedicatedHost = nodes.createForm.querySelector('[data-role="dedicated-editor-host"]');
  const resourceSection = nodes.createForm.querySelector('[data-role="publish-resource-section"]');
  const contentTitle = nodes.createForm.querySelector('[data-role="publish-content-title"]');
  const contentHelp = nodes.createForm.querySelector('[data-role="publish-content-help"]');
  const coverLabel = nodes.createForm.querySelector('[data-role="create-cover-label"]');
  const coverHint = nodes.createForm.querySelector('[data-role="create-cover-hint"]');

  const currentMode = () => resolvePublishMode(projectType.value, characterKind?.value);

  let dedicatedEditor = null;
  let dedicatedEditorMode = '';
  const dedicatedDrafts = new Map();

  const syncPublishTemplate = () => {
    const selection = projectType.value;
    const mode = currentMode();
    if (characterKindField) characterKindField.hidden = selection !== 'character';
    if (extensionPanel) extensionPanel.hidden = mode !== 'extension';
    if (resourceSection) resourceSection.hidden = mode !== 'extension';

    if (mode === 'extension') {
      if (dedicatedEditor && dedicatedEditorMode) dedicatedDrafts.set(dedicatedEditorMode, dedicatedEditor.values());
      dedicatedEditor = null;
      dedicatedEditorMode = '';
      if (dedicatedHost) {
        dedicatedHost.hidden = true;
        dedicatedHost.replaceChildren();
      }
    } else if (dedicatedHost && dedicatedEditorMode !== mode) {
      if (dedicatedEditor && dedicatedEditorMode) dedicatedDrafts.set(dedicatedEditorMode, dedicatedEditor.values());
      dedicatedEditor = createDedicatedPublishEditor({
        doc,
        mode,
        initial: dedicatedDrafts.get(mode) || {},
        onChange: () => {
          dirty = true;
          submitAttempt = null;
        },
      });
      dedicatedEditorMode = mode;
      dedicatedHost.replaceChildren(dedicatedEditor.node);
      dedicatedHost.hidden = false;
    }

    const copy = {
      extension: ['扩展文件', '通用扩展可上传世界书、正则与酒馆助手脚本。'],
      world_character: ['世界书角色', '填写人物资料，系统自动生成世界书角色条目。'],
      opening_character: ['开局角色', '填写Ⅰ-Ⅲ阶角色资料、1项血统和最多2项技能。'],
      opening_partner: ['开局伙伴', '填写Ⅰ-Ⅲ阶伙伴资料、1项血统和最多2项技能。'],
      store_catalog: ['开局商店', '逐项添加装备、道具或技能；不需要填写 JSON。'],
    }[mode] || ['作品内容', '填写当前作品内容。'];
    if (contentTitle) contentTitle.textContent = copy[0];
    if (contentHelp) contentHelp.textContent = copy[1];
    const openingAvatar = mode === 'opening_character' || mode === 'opening_partner';
    if (coverLabel) coverLabel.textContent = openingAvatar ? '封面 / 默认头像 *' : '封面图 *';
    if (coverHint) coverHint.textContent = openingAvatar
      ? 'PNG / JPEG / WebP · 会同时作为状态栏默认头像，建议人物主体居中'
      : 'PNG / JPEG / WebP · 建议 16:9';
    if (!nodes.createCover.files?.length) {
      nodes.createCoverState.textContent = openingAvatar
        ? '必需。该图片会同时作为开局后的默认头像，玩家之后仍可在状态栏自行更换。'
        : '必需。建议 16:9，选择后会立即预览。';
    }
  };
  const submitButton = nodes.createForm.querySelector('button[type="submit"]');
  const localTestButton = nodes.createForm.querySelector('[data-action="create-project-local-test"]');

  let dirty = false;
  let coverUrl = '';
  let queue = null;
  let submitAttempt = null;

  const createLocalDraftId = () => {
    const randomId = host.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `draft:${randomId}`;
  };
  let localDraftId = createLocalDraftId();

  const dependencyPicker = createDependencyPicker({
    doc,
    workshopApi,
    openModal,
    button: (label, className, onClick) => {
      const node = doc.createElement('button');
      node.type = 'button';
      node.className = `rw-button ${className || ''}`.trim();
      node.textContent = label;
      if (onClick) node.addEventListener('click', onClick);
      return node;
    },
  });
  nodes.createDependencies.replaceChildren(dependencyPicker.node);

  const resourceEditor = createResourceStateEditor({
    doc,
    notifyError,
    onChange: () => {
      dirty = true;
      submitAttempt = null;
    },
  });
  nodes.createResourceStates.replaceChildren(resourceEditor.node);

  const progress = doc.createElement('div');
  progress.className = 'rw-submit-progress';
  progress.hidden = true;
  nodes.createForm.querySelector('.rw-publish-grid')?.after(progress);

  const readFileDataUrl = file => {
    if (!file) return Promise.resolve('');
    return new Promise((resolve, reject) => {
      try {
        const Reader = host.FileReader || FileReader;
        const reader = new Reader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('读取封面失败'));
        reader.readAsDataURL(file);
      } catch (error) {
        reject(error);
      }
    });
  };

  const revokeCoverPreview = () => {
    if (!coverUrl) return;
    try { host.URL.revokeObjectURL(coverUrl); } catch {}
    coverUrl = '';
  };

  const renderCover = () => {
    revokeCoverPreview();
    const selected = nodes.createCover.files?.[0] || null;
    if (!selected) {
      const mode = currentMode();
      nodes.createCoverState.textContent = mode === 'opening_character' || mode === 'opening_partner'
        ? '必需。该图片会同时作为开局后的默认头像，玩家之后仍可在状态栏自行更换。'
        : '必需。建议 16:9，选择后会立即预览。';
      nodes.createCoverPreview.hidden = true;
      nodes.createCoverPreview.removeAttribute('src');
      return;
    }
    coverUrl = host.URL.createObjectURL(selected);
    nodes.createCoverPreview.src = coverUrl;
    nodes.createCoverPreview.hidden = false;
    nodes.createCoverState.textContent = `已选择：${selected.name} · 尚未上传`;
    dirty = true;
    submitAttempt = null;
  };

  const reset = () => {
    nodes.createForm.reset();
    queue?.clear();
    nodes.createVersion.value = '';
    nodes.createWorldbook.value = '';
    nodes.createRegex.value = '';
    nodes.createScript.value = '';
    nodes.createCover.value = '';
    nodes.createVersionState.textContent = '选择世界书、正则或酒馆助手脚本；已添加内容会显示在下方。';
    dependencyPicker.clear();
    resourceEditor.clear();
    revokeCoverPreview();
    nodes.createCoverPreview.hidden = true;
    nodes.createCoverPreview.removeAttribute('src');
    nodes.createCoverState.textContent = '必需。建议 16:9，选择后会立即预览。';
    progress.hidden = true;
    progress.textContent = '';
    submitAttempt = null;
    localDraftId = createLocalDraftId();
    dirty = false;
    submitButton.disabled = false;
    submitButton.textContent = '提交审核（上传）';
    if (localTestButton) {
      localTestButton.disabled = false;
      localTestButton.textContent = '保存本地测试（不上传）';
    }
    dedicatedDrafts.clear();
    dedicatedEditor = null;
    dedicatedEditorMode = '';
    if (dedicatedHost) {
      dedicatedHost.hidden = true;
      dedicatedHost.replaceChildren();
    }
    syncPublishTemplate();
  };

  queue = createSmartArtifactQueue({
    doc,
    input: nodes.createVersion,
    list: nodes.createArtifactList,
    getProject: () => ({ category: projectCategoryForSelection(projectType.value || 'extension') }),
    onChange: current => {
      submitAttempt = null;
      nodes.createVersionState.textContent = current.count
        ? `已识别 ${current.count} 项：${current.summary()}`
        : '选择世界书、正则或酒馆助手脚本；已添加内容会显示在下方。';
      if (current.count) dirty = true;
    },
  });

  const addFiles = async (files, forcedKind) => {
    try {
      await queue.addFilesAs(files, forcedKind);
    } catch (error) {
      notifyError(error);
    }
  };

  const bindArtifactInput = (input, dropTarget, forcedKind) => {
    if (!input || !dropTarget) return;
    input.addEventListener('change', () => {
      const files = input.files;
      if (!files?.length) return;
      void addFiles(files, forcedKind).finally(() => { input.value = ''; });
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
      void addFiles(files, forcedKind);
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

  nodes.createCover.addEventListener('change', renderCover);
  projectType.addEventListener('change', syncPublishTemplate);
  characterKind?.addEventListener('change', syncPublishTemplate);
  syncPublishTemplate();
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

  nodes.createForm.addEventListener('input', event => {
    if (event.target?.closest?.('.rw-resource-state-editor')) return;
    dirty = true;
    submitAttempt = null;
  });
  nodes.createForm.addEventListener('change', event => {
    if (event.target?.closest?.('.rw-resource-state-editor')) return;
    dirty = true;
    submitAttempt = null;
  });

  openButton?.addEventListener('click', () => {
    nodes.createForm.hidden = false;
    nodes.createForm.querySelector('[name="name"]')?.focus();
    if (currentMode() === 'extension') void resourceEditor.refresh();
  });

  const closeCreate = async () => {
    if (dirty) {
      const confirmed = await confirmDialog({
        title: '放弃这次编辑？',
        message: '作品资料、当前填写内容和封面都还没有提交。关闭后会清空当前草稿。',
        confirmText: '放弃编辑',
        cancelText: '继续编辑',
        danger: true,
      });
      if (!confirmed) return;
    }
    reset();
    nodes.createForm.hidden = true;
  };
  cancelButtons.forEach(button => button.addEventListener('click', () => void closeCreate()));

  function errorDescription(error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = Number(error?.status || 0);
    const code = String(error?.code || '').trim();
    const details = [];
    if (status) details.push(`HTTP ${status}`);
    if (code && code !== 'request_failed') details.push(code);
    return details.length ? `${message}（${details.join(' · ')}）` : message;
  }

  function buildPublishBundle(form, name) {
    const mode = currentMode();
    if (mode === 'extension') {
      if (!queue.count) throw new Error('请至少拖入一个扩展内容文件');
      return queue.bundle(null, resourceEditor.values());
    }
    const artifacts = buildDedicatedArtifacts(dedicatedEditor?.values() || {}, mode, name);
    if (!artifacts.length) throw new Error('当前作品没有可发布内容');
    return { schema_version: 1, artifacts };
  }

  function setSubmitStatus(state, text) {
    progress.className = `rw-submit-progress rw-submit-progress--${state}`;
    progress.textContent = text;
    progress.hidden = false;
  }

  localTestButton?.addEventListener('click', () => {
    if (localTestButton.disabled) return;

    const form = new FormData(nodes.createForm);
    const name = String(form.get('name') || '').trim();
    const summary = String(form.get('summary') || '');
    const categorySelection = String(form.get('category') || 'extension');
    const category = projectCategoryForSelection(categorySelection);
    const character_kind = categorySelection === 'character'
      ? String(form.get('character_kind') || 'world_character')
      : '';
    const dependencies = dependencyPicker.values();

    if (!name) return notifyError(new Error('请先填写作品名称'));
    const cover = nodes.createCover.files?.[0] || null;
    if (!cover) return notifyError(new Error('请选择封面图片；发布作品必须提供图片'));
    let bundle;
    try {
      bundle = buildPublishBundle(form, name);
    } catch (error) {
      return notifyError(error);
    }
    void (async () => {
      localTestButton.disabled = true;
      localTestButton.textContent = '正在保存本地测试…';
      setSubmitStatus('working', '正在保存本地测试版本；不会上传服务器或提交审核…');
      try {
        const coverDataUrl = await readFileDataUrl(cover);
        await projectService.saveLocalTest({
          id: localDraftId,
          name,
          summary,
          category,
          dependencies,
          version: 1,
          bundle,
          coverDataUrl,
        });
        dirty = false;
        setSubmitStatus(
          'success',
          '已保存到本地测试。不会上传服务器，也不会进入审核队列；可到“已安装”中安装测试。',
        );
        try { host.toastr?.success?.('本地测试版本已保存', '创意工坊'); } catch {}
      } catch (error) {
        setSubmitStatus(
          'error',
          `保存本地测试失败：${error instanceof Error ? error.message : String(error)}`,
        );
        notifyError(error);
      } finally {
        if (localTestButton.isConnected) {
          localTestButton.disabled = false;
          localTestButton.textContent = '保存本地测试（不上传）';
        }
      }
    })();
  });

  nodes.createForm.addEventListener('submit', event => {
    event.preventDefault();
    if (submitButton.disabled) return;

    const form = new FormData(nodes.createForm);
    const name = String(form.get('name') || '').trim();
    const summary = String(form.get('summary') || '');
    const categorySelection = String(form.get('category') || 'extension');
    const category = projectCategoryForSelection(categorySelection);
    const character_kind = categorySelection === 'character'
      ? String(form.get('character_kind') || 'world_character')
      : '';
    const tags = String(form.get('tags') || '')
      .split(/[,，\n]/u)
      .map(value => value.trim())
      .filter(Boolean);
    const dependencies = dependencyPicker.values();

    if (!name) return notifyError(new Error('请先填写作品名称'));
    const cover = nodes.createCover.files?.[0] || null;
    if (!cover) return notifyError(new Error('请选择封面图片；发布作品必须提供图片'));
    let bundle;
    try {
      bundle = buildPublishBundle(form, name);
    } catch (error) {
      return notifyError(error);
    }
    const attemptKey = JSON.stringify({
      name,
      summary,
      category,
      categorySelection,
      character_kind,
      tags,
      dependencies,
      publishMode: currentMode(),
      artifactNames: bundle.artifacts.map(item => [item.kind, item.name, item.scope || '']),
      coverName: cover?.name || '',
      coverSize: Number(cover?.size || 0),
    });

    if (!submitAttempt || submitAttempt.key !== attemptKey) {
      submitAttempt = {
        key: attemptKey,
        projectId: null,
        versionUploaded: false,
        coverUploaded: !cover,
        submitted: false,
      };
    }

    void (async () => {
      submitButton.disabled = true;
      try {
        if (!submitAttempt.projectId) {
          submitButton.textContent = '正在创建作品…';
          setSubmitStatus('working', '步骤 1/4 · 正在创建作品草稿…');
          const created = await workshopApi.createProject({
            name,
            summary,
            category,
            tags,
            dependencies,
          });
          if (!created?.project?.id) throw new Error('服务器没有返回作品 ID，无法继续上传');
          submitAttempt.projectId = created.project.id;
        }

        if (!submitAttempt.versionUploaded) {
          submitButton.textContent = '正在上传内容…';
          setSubmitStatus('working', currentMode() === 'extension'
            ? '步骤 2/4 · 正在上传扩展内容与原版资源状态…'
            : '步骤 2/4 · 正在上传专用作品数据…');
          await workshopApi.uploadProjectVersion(
            submitAttempt.projectId,
            { changelog: '', bundle },
          );
          submitAttempt.versionUploaded = true;
        }

        if (cover && !submitAttempt.coverUploaded) {
          submitButton.textContent = '正在上传封面…';
          setSubmitStatus('working', '步骤 3/4 · 正在上传封面…');
          await workshopApi.uploadProjectCover(submitAttempt.projectId, cover);
          submitAttempt.coverUploaded = true;
        }

        if (!submitAttempt.submitted) {
          submitButton.textContent = '正在提交审核…';
          setSubmitStatus('working', '步骤 4/4 · 正在提交审核…');
          await workshopApi.submitProject(submitAttempt.projectId);
          submitAttempt.submitted = true;
        }

        setSubmitStatus('success', '提交成功 · 作品已经进入审核队列。');
        dirty = false;
        try { host.toastr?.success?.('作品已提交审核', '创意工坊'); } catch {}
        try { await refreshMine(); } catch (refreshError) {
          console.warn('[轮回战场创意工坊] 提交成功，但刷新我的作品失败', refreshError);
        }

        host.setTimeout?.(() => {
          reset();
          nodes.createForm.hidden = true;
        }, 650);
      } catch (error) {
        const failedAt = !submitAttempt?.projectId
          ? '创建作品'
          : !submitAttempt.versionUploaded
            ? '上传作品内容'
            : !submitAttempt.coverUploaded
              ? '上传封面'
              : '提交审核';
        setSubmitStatus(
          'error',
          `${failedAt}失败：${errorDescription(error)}${submitAttempt?.projectId ? '\n再次点击会从失败步骤继续，不会重复创建作品。' : ''}`,
        );
        notifyError(error);
      } finally {
        if (submitButton.isConnected) {
          submitButton.disabled = false;
          submitButton.textContent = submitAttempt?.submitted ? '已提交审核' : '重试提交审核（上传）';
        }
      }
    })();
  });

  return {
    reset,
    destroy() {
      revokeCoverPreview();
      dedicatedEditor = null;
      dedicatedDrafts.clear();
    },
  };
}
