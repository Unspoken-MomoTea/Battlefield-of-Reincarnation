import { createDependencyPicker } from '../../ui/dependency-picker.js';
import { createResourceStateEditor } from '../../ui/resource-state-editor.js';
import { createSmartArtifactQueue } from '../../ui/smart-artifact-queue.js';
import {
  artifactsWithoutLegacyConflicts,
  resourceOverridesFromBundle,
} from '../../services/resource-overrides.js';
import {
  buildDedicatedArtifacts,
  dedicatedInitialValues,
  detectPublishMode,
} from './publish-templates.js';

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
  projectService,
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
    const autoPublish = Number(current.published_version || 0) > 0;
    const latest = detail.latest || { bundle: { schema_version: 1, artifacts: [] } };
    const baselineBundle = latest.bundle || { schema_version: 1, artifacts: [] };
    const artifacts = artifactsWithoutLegacyConflicts(baselineBundle.artifacts);
    const initialResourceRules = resourceOverridesFromBundle(baselineBundle);
    const publishMode = detectPublishMode(current.category, artifacts);
    const dedicatedValues = dedicatedInitialValues(artifacts, publishMode, current.name || '');

    const form = element('form', 'rw-update-form');
    const grid = element('div', 'rw-publish-grid rw-update-grid');
    const left = element('section', 'rw-publish-column');
    const right = element('section', 'rw-publish-column rw-publish-upload-column');
    let attempt = null;

    const resetAttempt = () => { attempt = null; };

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
    const modeLabels = {
      extension: '通用扩展',
      store_catalog: '开局商店',
      world_character: '世界角色',
      opening_character: '开局角色',
      opening_partner: '开局伙伴',
    };
    const modeDisplay = element('input', 'rw-input');
    modeDisplay.value = modeLabels[publishMode] || publishMode;
    modeDisplay.disabled = true;
    left.append(step2, field('分类 *', category), field('作品用途', modeDisplay), field('标签（可选）', tags));

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
    const stepCopy = {
      extension: ['版本内容', '当前版本已经载入；上传同名文件会替换旧内容。'],
      world_character: ['世界角色设定', '直接修改人物资料，保存时自动重新生成世界书角色条目。'],
      opening_character: ['开局角色数据', '直接修改原始构筑，不需要上传 JSON 文件。'],
      opening_partner: ['开局伙伴数据', '直接修改伙伴原始构筑与人设。'],
      store_catalog: ['开局商店内容', '直接维护装备、道具与技能目录。'],
    }[publishMode];
    step3.innerHTML = `<span>03</span><div><strong>${stepCopy[0]}</strong><small>${stepCopy[1]}</small></div>`;
    right.appendChild(step3);

    const changelog = element('textarea', 'rw-textarea rw-update-changelog');
    changelog.maxLength = 2000;
    changelog.placeholder = '这次更新了什么？建议让玩家和管理员一眼看懂。';
    if (current.status === 'rejected') changelog.value = latest.changelog || '';
    right.appendChild(field('版本更新说明', changelog));

    let queue = null;
    let resourceEditor = null;

    const makeInput = (nameValue, value = '', { textarea = false, code = false, placeholder = '' } = {}) => {
      const control = element(textarea ? 'textarea' : 'input', textarea
        ? `rw-textarea${code ? ' rw-code-input' : ''}`
        : 'rw-input');
      control.name = nameValue;
      control.value = value ?? '';
      if (placeholder) control.placeholder = placeholder;
      if (textarea && code) control.spellcheck = false;
      return control;
    };

    const appendDedicatedEditor = () => {
      const special = element('div', 'rw-special-editor');
      const head = element('div', 'rw-special-editor-head');
      head.append(
        element('strong', '', stepCopy[0]),
        element('small', '', publishMode === 'world_character'
          ? '世界角色只维护人物世界书资料，不包含正则、脚本或原版资源规则。'
          : publishMode === 'store_catalog'
            ? '开局商店只维护商品目录，不包含世界书、正则、脚本或原版资源规则。'
            : '开局角色/伙伴只维护 Opening Asset，不包含世界书、正则、脚本或原版资源规则。'),
      );
      special.appendChild(head);

      if (publishMode === 'world_character') {
        const gridNode = element('div', 'rw-special-grid');
        const rank = element('select', 'rw-select');
        rank.name = 'world_rank';
        for (const value of ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ']) {
          const option = doc.createElement('option');
          option.value = value; option.textContent = value;
          option.selected = value === (dedicatedValues.world_rank || 'Ⅰ');
          rank.appendChild(option);
        }
        gridNode.append(
          field('角色姓名 *', makeInput('world_name', dedicatedValues.world_name)),
          field('关键词 / 别名', makeInput('world_keywords', dedicatedValues.world_keywords)),
          field('种族', makeInput('world_race', dedicatedValues.world_race)),
          field('身份', makeInput('world_identity', dedicatedValues.world_identity)),
          field('职业', makeInput('world_occupation', dedicatedValues.world_occupation)),
          field('层级', rank),
        );
        special.append(
          gridNode,
          field('性格', makeInput('world_personality', dedicatedValues.world_personality, { textarea: true })),
          field('外貌', makeInput('world_appearance', dedicatedValues.world_appearance, { textarea: true })),
          field('背景故事', makeInput('world_background', dedicatedValues.world_background, { textarea: true })),
          field('补充设定', makeInput('world_notes', dedicatedValues.world_notes, { textarea: true })),
        );
      } else if (publishMode === 'opening_character' || publishMode === 'opening_partner') {
        const gridNode = element('div', 'rw-special-grid');
        const rank = element('select', 'rw-select');
        rank.name = 'opening_rank';
        for (const value of ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ']) {
          const option = doc.createElement('option');
          option.value = value; option.textContent = value;
          option.selected = value === (dedicatedValues.opening_rank || 'Ⅰ');
          rank.appendChild(option);
        }
        gridNode.append(
          field('姓名 *', makeInput('opening_name', dedicatedValues.opening_name)),
          field('种族', makeInput('opening_race', dedicatedValues.opening_race || '人类')),
          field('身份', makeInput('opening_identity', dedicatedValues.opening_identity)),
          field('职业名称', makeInput('opening_occupation_name', dedicatedValues.opening_occupation_name)),
          field('职业类型', (() => {
            const select = element('select', 'rw-select');
            select.name = 'opening_occupation_type';
            for (const value of ['战斗','生活','辅助']) {
              const option = doc.createElement('option');
              option.value = value; option.textContent = value;
              option.selected = value === (dedicatedValues.opening_occupation_type || '辅助');
              select.appendChild(option);
            }
            return select;
          })()),
          field('职业特性', makeInput('opening_occupation_traits', dedicatedValues.opening_occupation_traits)),
          field('职业来源', makeInput('opening_occupation_source', dedicatedValues.opening_occupation_source)),
          field('层级', rank),
        );
        special.appendChild(gridNode);
        if (publishMode === 'opening_partner') {
          special.append(
            element('div', 'rw-special-subtitle', '伙伴人设'),
            field('性格', makeInput('opening_personality', dedicatedValues.opening_personality, { textarea: true })),
            field('喜爱', makeInput('opening_likes', dedicatedValues.opening_likes, { textarea: true })),
            field('背景故事', makeInput('opening_background', dedicatedValues.opening_background, { textarea: true })),
          );
        }
        const jsonGrid = element('div', 'rw-special-json-grid');
        jsonGrid.append(
          field('血统', makeInput('opening_bloodline', dedicatedValues.opening_bloodline || '{}', { textarea: true, code: true })),
          field('技能', makeInput('opening_skills', dedicatedValues.opening_skills || '{}', { textarea: true, code: true })),
          field('装备', makeInput('opening_equipment', dedicatedValues.opening_equipment || '{}', { textarea: true, code: true })),
          field('状态', makeInput('opening_status', dedicatedValues.opening_status || '{}', { textarea: true, code: true })),
          field('形态库', makeInput('opening_forms', dedicatedValues.opening_forms || '{}', { textarea: true, code: true })),
          field('当前形态', makeInput('opening_current_form', dedicatedValues.opening_current_form || '{"激活":false,"名称":""}', { textarea: true, code: true })),
        );
        special.append(element('div', 'rw-special-subtitle', '原始构筑'), jsonGrid);
      } else if (publishMode === 'store_catalog') {
        special.append(
          field('装备商品', makeInput('store_equipments', dedicatedValues.store_equipments || '[]', { textarea: true, code: true })),
          field('道具商品', makeInput('store_items', dedicatedValues.store_items || '[]', { textarea: true, code: true })),
          field('技能商品', makeInput('store_skills', dedicatedValues.store_skills || '[]', { textarea: true, code: true })),
        );
      }
      right.appendChild(special);
    };

    if (publishMode === 'extension') {
      const uploadBlock = element('div', 'rw-publish-upload-block');
      uploadBlock.appendChild(element('span', 'rw-field-label', '扩展文件 *'));

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
      queue = createSmartArtifactQueue({
        doc,
        input: queueInput,
        list: queueList,
        getProject: () => ({ category: category.value || current.category }),
        onChange: value => {
          queueState.textContent = value.count
            ? `当前版本共 ${value.count} 项：${value.summary()}。上传同名文件会替换对应旧项。`
            : '当前版本没有作品内容，请至少添加一项。';
          resetAttempt();
        },
      });
      queue.loadArtifacts(artifacts, `当前 v${latest.version || current.latest_version || 0}`);

      for (const { kind, input, zone } of inputs) {
        const add = async files => {
          try { await queue.addFilesAs(files, kind); }
          catch (error) { notifyError(error); }
          finally { input.value = ''; }
        };
        input.addEventListener('change', () => {
          if (input.files?.length) void add(input.files);
        });
        dropBinding(zone, input, add);
      }
      uploadBlock.append(queueState, queueList);
      right.appendChild(uploadBlock);

      right.appendChild(element('div', 'rw-publish-divider'));
      const step4 = element('div', 'rw-publish-step-title');
      step4.innerHTML = '<span>04</span><div><strong>原版资源</strong><small>仅通用扩展维护原世界书、正则和脚本状态。</small></div>';
      right.appendChild(step4);

      resourceEditor = createResourceStateEditor({
        doc,
        initialRules: initialResourceRules,
        notifyError,
        onChange: resetAttempt,
      });
      right.appendChild(resourceEditor.node);
      void resourceEditor.refresh();
    } else {
      appendDedicatedEditor();
    }

    const buildVersionBundle = nextName => {
      if (publishMode === 'extension') {
        if (!queue?.count) throw new Error('扩展内容不能为空');
        return queue.bundle(null, resourceEditor?.values?.() || []);
      }
      return {
        schema_version: 1,
        artifacts: buildDedicatedArtifacts(new FormData(form), publishMode, nextName),
      };
    };

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
      resetAttempt();
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

    const progress = element('div', 'rw-submit-progress');
    progress.hidden = true;
    form.appendChild(progress);

    const footer = element('footer', 'rw-publish-footer rw-update-footer');
    footer.append(
      element(
        'div',
        'rw-publish-footer-note',
        publishMode === 'extension'
          ? (autoPublish
            ? '● 此作品已通过首次审核；新版本会直接发布并进入管理员“更新动态”。原版资源状态仍随版本保存。'
            : '● 原版资源状态会随新版本保存；停用/卸载作品时恢复安装前状态。')
          : (autoPublish
            ? '● 此作品已通过首次审核；新版本会直接发布并进入管理员“更新动态”。'
            : '● 专用角色/商店模板只保存自身数据，不读写原版资源状态。'),
      ),
    );
    const footerActions = element('div', 'rw-row');
    const cancel = button('取消', '', () => modal.close());
    const localTest = button('保存到本地测试', '', async () => {
      const nextName = name.value.trim();
      if (!nextName) throw new Error('请填写作品名称');
      const bundle = buildVersionBundle(nextName);
      const version = Math.max(1, Number(current.latest_version || 0) + 1);
      progress.hidden = false;
      progress.className = 'rw-submit-progress rw-submit-progress--working';
      progress.textContent = '正在保存本地测试版本…';
      try {
        await projectService.saveLocalTest({
          id: current.id,
          name: nextName,
          summary: summary.value,
          category: category.value || current.category,
          dependencies: dependencies.values(),
          version,
          bundle,
        });
        progress.className = 'rw-submit-progress rw-submit-progress--success';
        progress.textContent = '已保存到本地测试。不会上传服务器，也不会提交审核；可到“已安装”中安装测试。';
        try { host.toastr?.success?.('本地测试版本已保存', '创意工坊'); } catch {}
      } catch (error) {
        progress.className = 'rw-submit-progress rw-submit-progress--error';
        progress.textContent = `保存本地测试失败：${error instanceof Error ? error.message : String(error)}`;
        notifyError(error);
        throw error;
      }
    });
    const submit = button(autoPublish ? '发布新版本' : '提交新版本审核', 'good', async () => {
      const nextName = name.value.trim();
      if (!nextName) throw new Error('请填写作品名称');

      const selectedCover = coverInput.files?.[0] || null;
      const bundle = buildVersionBundle(nextName);
      const signature = JSON.stringify({
        name: nextName,
        summary: summary.value,
        category: category.value || current.category,
        tags: tagsFromInput(tags.value),
        dependencies: dependencies.values(),
        publishMode,
        changelog: changelog.value,
        artifactNames: bundle.artifacts.map(item => [item.kind, item.name, item.scope || '']),
        coverName: selectedCover?.name || '',
        coverSize: Number(selectedCover?.size || 0),
      });
      if (!attempt || attempt.signature !== signature) {
        attempt = {
          signature,
          metadataSaved: false,
          coverUploaded: !selectedCover,
          versionUploaded: false,
          submitted: false,
        };
      }

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
          progress.textContent = publishMode === 'extension'
            ? (autoPublish ? '正在发布新版本与原版资源状态…' : '正在上传新版本与原版资源状态…')
            : (autoPublish ? '正在发布专用作品数据…' : '正在上传专用作品数据…');
          await workshopApi.uploadProjectVersion(current.id, {
            changelog: changelog.value,
            bundle,
          });
          attempt.versionUploaded = true;
          if (autoPublish) attempt.submitted = true;
        }

        if (!attempt.submitted) {
          progress.textContent = '正在提交审核…';
          await workshopApi.submitProject(current.id);
          attempt.submitted = true;
        }

        progress.className = 'rw-submit-progress rw-submit-progress--success';
        progress.textContent = autoPublish
          ? '新版本已直接发布，并已进入管理员更新动态。'
          : '新版本已提交审核。首次审核通过后，后续版本可由作者直接发布。';
        try {
          host.toastr?.success?.(autoPublish ? '新版本已发布' : '新版本已提交审核', '创意工坊');
        } catch {}
        try { await refreshMine(); } catch {}
        host.setTimeout?.(() => modal.close({ force: true }), 650);
      } catch (error) {
        const failedAt = !attempt.metadataSaved
          ? '保存资料'
          : !attempt.coverUploaded
            ? '上传封面'
            : !attempt.versionUploaded
              ? '上传新版本'
              : (autoPublish ? '发布新版本' : '提交审核');
        progress.className = 'rw-submit-progress rw-submit-progress--error';
        progress.textContent = `${failedAt}失败：${error instanceof Error ? error.message : String(error)}\n再次点击会从失败步骤继续，不会重复上传已经成功的版本。`;
        notifyError(error);
        throw error;
      }
    });
    footerActions.append(cancel, localTest, submit);
    footer.appendChild(footerActions);
    form.appendChild(footer);

    form.addEventListener('input', event => {
      if (event.target?.closest?.('.rw-resource-state-editor')) return;
      resetAttempt();
    });
    form.addEventListener('change', event => {
      if (event.target?.closest?.('.rw-resource-state-editor')) return;
      resetAttempt();
    });

    modal.body.replaceChildren(form);
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
