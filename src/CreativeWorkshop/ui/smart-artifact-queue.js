import { ARTIFACT_LABELS } from './constants.js';
import { buildUploadBundle, combineUploadBundles } from '../services/upload.js';
import { buildDetectedUploadBundle, detectUploadKind } from '../services/upload-detect.js';

const KINDS = ['worldbook', 'regex', 'script', 'preset', 'data'];
const SCRIPT_SCOPE_LABELS = {
  character: '当前角色',
  preset: '当前预设',
  global: '全局',
};

function clone(value) {
  return structuredClone(value);
}

function artifactLabel(artifact, detected = null) {
  const label = ARTIFACT_LABELS[artifact.kind] || artifact.kind;
  const parts = [label];
  if (artifact.kind === 'script') {
    parts.push(`作用域：${SCRIPT_SCOPE_LABELS[artifact.scope || 'character'] || artifact.scope}`);
  }
  if (detected?.confidence === 'unknown') parts.push('可手动修正类型');
  else if (detected?.reason) parts.push(detected.reason);
  return parts.join(' · ');
}

export function createSmartArtifactQueue({
  doc,
  input,
  list,
  getProject,
  onChange = null,
}) {
  let items = [];

  function emit() {
    try { onChange?.(api); } catch {}
  }

  function rebuildItem(item, kind, scriptScope = item.artifact.scope || 'character') {
    if (!item.rawText) return;
    const bundle = buildUploadBundle(
      getProject(),
      item.sourceFile,
      item.rawText,
      kind,
      { scriptScope },
    );
    if (bundle.artifacts.length !== 1) throw new Error('完整 bundle 中的内容不能在这里单独改类型');
    item.artifact = clone(bundle.artifacts[0]);
    item.detected = { ...item.detected, kind };
  }

  function render() {
    if (!items.length) {
      list.replaceChildren();
      list.hidden = true;
      return;
    }

    const rows = items.map((item, index) => {
      const row = doc.createElement('div');
      row.className = 'rw-smart-artifact-row';

      const icon = doc.createElement('div');
      icon.className = `rw-smart-artifact-icon rw-smart-artifact-icon--${item.artifact.kind}`;
      icon.textContent = ({
        worldbook: '书',
        regex: '正',
        script: 'JS',
        preset: '预',
        data: '数',
      })[item.artifact.kind] || '档';

      const copy = doc.createElement('div');
      copy.className = 'rw-smart-artifact-copy';
      const title = doc.createElement('strong');
      title.textContent = item.artifact.name;
      const meta = doc.createElement('span');
      meta.textContent = artifactLabel(item.artifact, item.detected);
      copy.append(title, meta);

      const controls = doc.createElement('div');
      controls.className = 'rw-smart-artifact-controls';

      if (item.locked) {
        const locked = doc.createElement('span');
        locked.className = 'rw-pill';
        locked.textContent = '完整 bundle';
        controls.appendChild(locked);
      } else {
        if (item.typeLocked) {
          const type = doc.createElement('span');
          type.className = 'rw-pill rw-smart-kind-pill';
          type.textContent = ARTIFACT_LABELS[item.artifact.kind] || item.artifact.kind;
          controls.appendChild(type);
        } else {
          const kind = doc.createElement('select');
          kind.className = 'rw-select rw-smart-kind';
          for (const value of KINDS) {
            const option = doc.createElement('option');
            option.value = value;
            option.textContent = ARTIFACT_LABELS[value] || value;
            option.selected = value === item.artifact.kind;
            kind.appendChild(option);
          }
          kind.title = '自动识别有误时可手动修改';
          kind.addEventListener('change', () => {
            rebuildItem(item, kind.value);
            render();
            emit();
          });
          controls.appendChild(kind);
        }

        if (item.artifact.kind === 'script') {
          const scope = doc.createElement('select');
          scope.className = 'rw-select rw-smart-scope';
          for (const value of ['character', 'preset', 'global']) {
            const option = doc.createElement('option');
            option.value = value;
            option.textContent = SCRIPT_SCOPE_LABELS[value];
            option.selected = value === (item.artifact.scope || 'character');
            scope.appendChild(option);
          }
          scope.addEventListener('change', () => {
            rebuildItem(item, 'script', scope.value);
            render();
            emit();
          });
          controls.appendChild(scope);
        }
      }

      const remove = doc.createElement('button');
      remove.type = 'button';
      remove.className = 'rw-button danger rw-artifact-remove';
      remove.textContent = '移除';
      remove.addEventListener('click', () => {
        items.splice(index, 1);
        render();
        emit();
      });
      controls.appendChild(remove);

      row.append(icon, copy, controls);
      return row;
    });

    list.replaceChildren(...rows);
    list.hidden = false;
  }

  async function addFilesInternal(files, forcedKind = '') {
    const selected = Array.from(files || []);
    if (!selected.length) return;

    const pending = [];
    for (const file of selected) {
      const rawText = await file.text();
      let result;
      if (forcedKind) {
        const detected = detectUploadKind(file.name, rawText);
        if (detected.kind === 'bundle') {
          throw new Error(`${file.name} 是完整工坊 bundle，请使用“其他文件 / 预设 / 完整 bundle”入口`);
        }
        if (
          detected.kind !== forcedKind &&
          detected.confidence === 'certain'
        ) {
          throw new Error(`${file.name} 看起来是“${ARTIFACT_LABELS[detected.kind] || detected.kind}”，不是“${ARTIFACT_LABELS[forcedKind] || forcedKind}”`);
        }
        const bundle = buildUploadBundle(
          getProject(),
          file.name,
          rawText,
          forcedKind,
          { scriptScope: 'character' },
        );
        result = {
          bundle,
          detected: {
            kind: forcedKind,
            confidence: detected.kind === forcedKind ? detected.confidence : 'chosen',
            reason: detected.kind === forcedKind ? detected.reason : '由上传入口指定',
          },
        };
      } else {
        result = buildDetectedUploadBundle(getProject(), file.name, rawText);
      }

      const { bundle, detected } = result;
      const isBundle = detected.kind === 'bundle';
      for (const artifact of bundle.artifacts) {
        pending.push({
          sourceFile: file.name,
          rawText: isBundle ? '' : rawText,
          artifact: clone(artifact),
          detected: isBundle
            ? { kind: artifact.kind, confidence: 'certain', reason: '来自完整 bundle' }
            : clone(detected),
          locked: isBundle,
          typeLocked: Boolean(forcedKind),
        });
      }
    }

    if (items.length + pending.length > 32) {
      throw new Error('单个版本最多允许 32 个 artifact');
    }
    items.push(...pending);
    if (input) input.value = '';
    render();
    emit();
  }

  async function addFiles(files) {
    return addFilesInternal(files, '');
  }

  async function addFilesAs(files, kind) {
    if (!KINDS.includes(kind)) throw new Error(`不支持的内容类型：${kind}`);
    return addFilesInternal(files, kind);
  }

  function clear() {
    items = [];
    input.value = '';
    render();
    emit();
  }

  function artifacts() {
    return clone(items.map(item => item.artifact));
  }

  function setArtifacts(nextArtifacts) {
    const cloned = clone(nextArtifacts || []);
    if (cloned.length !== items.length) throw new Error('安装规则与上传文件数量不一致');
    items.forEach((item, index) => { item.artifact = cloned[index]; });
    render();
    emit();
  }

  function bundle(overrideArtifacts = null) {
    const artifactsToUse = overrideArtifacts ? clone(overrideArtifacts) : artifacts();
    return combineUploadBundles([{ schema_version: 1, artifacts: artifactsToUse }]);
  }

  function summary() {
    const counts = new Map();
    for (const item of items) {
      const label = ARTIFACT_LABELS[item.artifact.kind] || item.artifact.kind;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts]
      .map(([label, count]) => count > 1 ? `${label} × ${count}` : label)
      .join('、');
  }

  const api = {
    addFiles,
    addFilesAs,
    clear,
    artifacts,
    setArtifacts,
    bundle,
    summary,
    get count() { return items.length; },
  };

  render();
  return api;
}
