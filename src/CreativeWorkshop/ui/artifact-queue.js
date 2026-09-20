import { ARTIFACT_LABELS } from './constants.js';
import { buildUploadBundle, combineUploadBundles } from '../services/upload.js';

function artifactLabel(artifact) {
  let label = ARTIFACT_LABELS[artifact.kind] || artifact.kind;
  if (artifact.kind === 'script') {
    const scope = ({ character: '当前角色', preset: '当前预设', global: '全局' })[
      artifact.scope || 'character'
    ];
    label += ` · ${scope || artifact.scope}`;
  }
  const conflicts = Array.isArray(artifact.original_conflicts)
    ? artifact.original_conflicts.length
    : 0;
  if (conflicts) label += ` · 关闭原版 ${conflicts} 项`;
  return label;
}

export function createArtifactQueue({
  doc,
  input,
  list,
  getProject,
  getKind,
  getOptions,
  onChange = null,
}) {
  let items = [];

  function emit() {
    try { onChange?.(api); } catch {}
  }

  function render() {
    if (!items.length) {
      list.replaceChildren();
      list.hidden = true;
      return;
    }

    const rows = items.map((item, index) => {
      const row = doc.createElement('div');
      row.className = 'rw-artifact-row';

      const copy = doc.createElement('div');
      copy.className = 'rw-artifact-row-copy';
      const title = doc.createElement('strong');
      title.textContent = item.artifact.name;
      const meta = doc.createElement('span');
      meta.textContent = artifactLabel(item.artifact);
      copy.append(title, meta);

      const remove = doc.createElement('button');
      remove.type = 'button';
      remove.className = 'rw-button danger rw-artifact-remove';
      remove.textContent = '移除';
      remove.addEventListener('click', () => {
        items.splice(index, 1);
        render();
        emit();
      });
      row.append(copy, remove);
      return row;
    });

    list.replaceChildren(...rows);
    list.hidden = false;
  }

  async function addFiles(files) {
    const selected = Array.from(files || []);
    if (!selected.length) return;

    const pending = [];
    for (const file of selected) {
      const raw = await file.text();
      const bundle = buildUploadBundle(
        getProject(),
        file.name,
        raw,
        getKind(),
        getOptions(),
      );
      for (const artifact of bundle.artifacts) {
        pending.push({
          sourceFile: file.name,
          artifact: structuredClone(artifact),
        });
      }
    }

    if (items.length + pending.length > 32) {
      throw new Error('单个版本最多允许 32 个 artifact');
    }
    items.push(...pending);
    input.value = '';
    render();
    emit();
  }

  function clear() {
    items = [];
    input.value = '';
    render();
    emit();
  }

  function bundle() {
    return combineUploadBundles([
      { schema_version: 1, artifacts: items.map(item => item.artifact) },
    ]);
  }

  function artifacts() {
    return structuredClone(items.map(item => item.artifact));
  }

  function summary() {
    const counts = new Map();
    for (const item of items) {
      const key = artifactLabel(item.artifact);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts].map(([label, count]) => count > 1 ? `${label} × ${count}` : label).join('、');
  }

  const api = {
    addFiles,
    clear,
    bundle,
    artifacts,
    summary,
    get count() { return items.length; },
  };

  render();
  return api;
}
