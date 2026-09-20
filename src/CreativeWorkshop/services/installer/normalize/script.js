import { clone, record } from '../utils.js';

export const SCRIPT_SCOPES = ['character', 'preset', 'global'];

export function scriptPrefix(projectId) {
  return `rw:${projectId}:script:`;
}

function baseOwnership(installed, artifactIndex, artifactName, sourceId = '') {
  return {
    projectId: installed.id,
    projectName: installed.name,
    projectVersion: installed.version,
    artifactIndex,
    artifactName,
    sourceScriptId: String(sourceId || ''),
  };
}

function normalizeButton(value) {
  const source = record(value);
  const buttons = Array.isArray(source?.buttons)
    ? source.buttons
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        name: String(item.name || ''),
        visible: item.visible !== false,
      }))
      .filter(item => item.name)
    : [];
  return {
    enabled: source?.enabled !== false,
    buttons,
  };
}

function normalizeScript(source, installed, artifactIndex, artifactName, path) {
  const raw = record(source) || {};
  const sourceId = String(raw.id || '');
  return {
    type: 'script',
    enabled: true,
    name: String(raw.name || artifactName || '工坊脚本'),
    id: `${scriptPrefix(installed.id)}${artifactIndex}:${path}`,
    content: String(raw.content || ''),
    info: String(raw.info || ''),
    button: normalizeButton(raw.button),
    data: {
      ...(record(raw.data) ? clone(raw.data) : {}),
      reincarnationWorkshop: baseOwnership(installed, artifactIndex, artifactName, sourceId),
    },
    export_with: {
      data: raw.export_with?.data !== false,
      button: raw.export_with?.button !== false,
    },
  };
}

function normalizeFolder(source, installed, artifactIndex, artifactName, path) {
  const raw = record(source) || {};
  const scripts = Array.isArray(raw.scripts) ? raw.scripts : [];
  return {
    type: 'folder',
    enabled: true,
    name: String(raw.name || artifactName || '工坊脚本'),
    id: `${scriptPrefix(installed.id)}${artifactIndex}:${path}`,
    icon: String(raw.icon || 'fa-solid fa-folder'),
    color: String(raw.color || ''),
    scripts: scripts.map((script, index) =>
      normalizeScript(script, installed, artifactIndex, artifactName, `${path}:${index}`),
    ),
  };
}

function parseScriptTrees(artifact) {
  if (artifact.format === 'text') {
    return [{
      type: 'script',
      name: String(artifact.name || '').replace(/\.(?:js|txt)$/iu, '') || '工坊脚本',
      content: String(artifact.content || ''),
    }];
  }

  const parsed = clone(artifact.content);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export function normalizeScriptArtifact(artifact, installed, artifactIndex) {
  const scope = SCRIPT_SCOPES.includes(artifact.scope) ? artifact.scope : 'character';
  const trees = parseScriptTrees(artifact).map((tree, index) => {
    const raw = record(tree);
    if (!raw) throw new Error(`脚本 artifact“${artifact.name}”结构无效`);
    if (raw.type === 'folder') {
      return normalizeFolder(raw, installed, artifactIndex, artifact.name, `folder:${index}`);
    }
    return normalizeScript(raw, installed, artifactIndex, artifact.name, `item:${index}`);
  });

  for (const tree of trees) {
    if (tree.type === 'script' && !tree.content.trim()) {
      throw new Error(`脚本 artifact“${artifact.name}”内容为空`);
    }
    if (tree.type === 'folder') {
      if (!tree.scripts.length || tree.scripts.some(script => !script.content.trim())) {
        throw new Error(`脚本 artifact“${artifact.name}”包含空脚本`);
      }
    }
  }

  return { scope, trees };
}
