import { HttpError } from '../http.js';
import { ARTIFACT_KINDS, MAX_ARTIFACTS, MAX_BUNDLE_BYTES } from './constants.js';
import { textField } from './fields.js';

const ARTIFACT_KIND_SET = new Set(ARTIFACT_KINDS);
const FORMAT_SET = new Set(['json', 'text']);

function structuredArtifactContent(artifact, name) {
  if (artifact.format === 'json') return artifact.content;
  try { return JSON.parse(artifact.content); }
  catch { throw new HttpError(400, 'invalid_artifact_content', `${name} 必须包含有效 JSON`); }
}

function normalizeOriginalConflicts(value, artifactName) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'invalid_original_conflicts', `${artifactName} 的 original_conflicts 必须是数组`);
  }
  if (value.length > 100) {
    throw new HttpError(400, 'original_conflicts_too_large', `${artifactName} 的原版冲突声明超过 100 条`);
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, 'invalid_original_conflicts', `${artifactName} 的第 ${index + 1} 条原版冲突无效`);
    }
    const action = String(item.action || '');
    if (!['disable', 'replace'].includes(action)) {
      throw new HttpError(400, 'invalid_original_conflict_action', `${artifactName} 的第 ${index + 1} 条原版冲突动作无效`);
    }
    const target = item.target;
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      throw new HttpError(400, 'invalid_original_conflict_target', `${artifactName} 的第 ${index + 1} 条原版冲突缺少 target`);
    }
    const worldbook = String(target.worldbook || '').trim();
    const uid = String(target.uid ?? '').trim();
    const name = String(target.name || '').trim();
    if (!uid && !name) {
      throw new HttpError(400, 'invalid_original_conflict_target', `${artifactName} 的第 ${index + 1} 条原版冲突至少需要 uid 或 name`);
    }
    return {
      action,
      target: {
        ...(worldbook ? { worldbook } : {}),
        ...(uid ? { uid } : {}),
        ...(name ? { name } : {}),
      },
    };
  });
}

function validateWorldbookContent(artifact, name) {
  const parsed = structuredArtifactContent(artifact, name);
  const entries = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.entries : null;
  const values = Array.isArray(entries) ? entries : entries && typeof entries === 'object' && !Array.isArray(entries) ? Object.values(entries) : [];
  if (!values.length) throw new HttpError(400, 'invalid_worldbook', `${name} 不包含世界书条目`);
  if (values.length > 500) throw new HttpError(400, 'worldbook_too_large', `${name} 超过 500 个世界书条目`);
  for (const [index, entry] of values.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new HttpError(400, 'invalid_worldbook', `${name} 的第 ${index + 1} 个条目结构无效`);
    if (!String(entry.name ?? entry.comment ?? '').trim()) throw new HttpError(400, 'invalid_worldbook', `${name} 的第 ${index + 1} 个条目缺少名称`);
  }
}

function regexEntries(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  if (Array.isArray(parsed.regexes)) return parsed.regexes;
  if (Array.isArray(parsed.extensions?.regex_scripts)) return parsed.extensions.regex_scripts;
  if (parsed.find_regex !== undefined || parsed.findRegex !== undefined) return [parsed];
  return [];
}

function validateRegexContent(artifact, name) {
  const values = regexEntries(structuredArtifactContent(artifact, name));
  if (!values.length) throw new HttpError(400, 'invalid_regex', `${name} 不包含可识别的正则`);
  if (values.length > 200) throw new HttpError(400, 'regex_too_large', `${name} 超过 200 条正则`);
  for (const [index, regex] of values.entries()) {
    if (!regex || typeof regex !== 'object' || Array.isArray(regex)) throw new HttpError(400, 'invalid_regex', `${name} 的第 ${index + 1} 条正则结构无效`);
    if (typeof (regex.find_regex ?? regex.findRegex) !== 'string') throw new HttpError(400, 'invalid_regex', `${name} 的第 ${index + 1} 条正则缺少 findRegex`);
  }
}

function validatePresetContent(artifact, name) {
  const parsed = structuredArtifactContent(artifact, name);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'invalid_preset', `${name} 的预设根结构必须是对象`);
}

function validateScriptTree(value, name, path = '脚本') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'invalid_script', `${name} 的${path}结构无效`);
  }
  if (value.type === 'folder') {
    if (!String(value.name || '').trim() || !Array.isArray(value.scripts)) {
      throw new HttpError(400, 'invalid_script', `${name} 的脚本文件夹结构无效`);
    }
    if (value.scripts.length > 100) throw new HttpError(400, 'script_too_large', `${name} 的脚本文件夹超过 100 个脚本`);
    value.scripts.forEach((script, index) => {
      if (script?.type === 'folder') {
        throw new HttpError(400, 'invalid_script', `${name} 的脚本文件夹不支持嵌套文件夹`);
      }
      validateScriptTree(script, name, `脚本文件夹第 ${index + 1} 项`);
    });
    return;
  }
  if (value.type !== 'script') throw new HttpError(400, 'invalid_script', `${name} 的脚本 type 必须为 script 或 folder`);
  if (!String(value.name || '').trim()) throw new HttpError(400, 'invalid_script', `${name} 的脚本缺少名称`);
  if (typeof value.content !== 'string' || !value.content.trim()) {
    throw new HttpError(400, 'invalid_script', `${name} 的脚本内容不能为空`);
  }
}

function validateScriptContent(artifact, name) {
  if (artifact.format === 'text') {
    if (!artifact.content.trim()) throw new HttpError(400, 'invalid_script', `${name} 的脚本内容不能为空`);
    return;
  }
  const parsed = structuredArtifactContent(artifact, name);
  const trees = Array.isArray(parsed) ? parsed : [parsed];
  if (!trees.length || trees.length > 100) throw new HttpError(400, 'invalid_script', `${name} 的脚本数量无效`);
  trees.forEach((tree, index) => validateScriptTree(tree, name, `第 ${index + 1} 项`));
}

function validateArtifactShape(artifact, name) {
  if (artifact.kind === 'worldbook') validateWorldbookContent(artifact, name);
  if (artifact.kind === 'regex') validateRegexContent(artifact, name);
  if (artifact.kind === 'preset') validatePresetContent(artifact, name);
  if (artifact.kind === 'script') validateScriptContent(artifact, name);
}

export function validateBundle(bundle) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new HttpError(400, 'invalid_bundle', 'bundle 必须是对象');
  if (bundle.schema_version !== 1) throw new HttpError(400, 'invalid_bundle_version', '目前只支持 schema_version = 1');
  if (!Array.isArray(bundle.artifacts) || bundle.artifacts.length < 1 || bundle.artifacts.length > MAX_ARTIFACTS) {
    throw new HttpError(400, 'invalid_artifacts', `artifacts 必须包含 1-${MAX_ARTIFACTS} 个项目`);
  }

  const artifacts = bundle.artifacts.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid_artifact', `第 ${index + 1} 个 artifact 无效`);
    const kind = String(value.kind || '');
    if (!ARTIFACT_KIND_SET.has(kind)) throw new HttpError(400, 'invalid_artifact_kind', `不支持的 artifact 类型：${kind || '(空)'}`);
    const format = String(value.format || '');
    if (!FORMAT_SET.has(format)) throw new HttpError(400, 'invalid_artifact_format', 'artifact format 仅支持 json/text');
    const name = textField(value.name, 'artifact.name', { min: 1, max: 100 });
    if (format === 'text' && typeof value.content !== 'string') throw new HttpError(400, 'invalid_artifact_content', `${name} 的 text 内容必须是字符串`);
    if (format === 'json' && (value.content === undefined || typeof value.content === 'function')) throw new HttpError(400, 'invalid_artifact_content', `${name} 缺少 JSON 内容`);
    let normalizedContent = value.content;
    if (format === 'json') {
      try { normalizedContent = JSON.parse(JSON.stringify(value.content)); }
      catch { throw new HttpError(400, 'invalid_artifact_content', `${name} 不是可序列化 JSON`); }
    }
    const normalizedArtifact = { kind, format, name, content: normalizedContent };
    if (kind === 'worldbook') {
      const originalConflicts = normalizeOriginalConflicts(value.original_conflicts, name);
      if (originalConflicts.length) normalizedArtifact.original_conflicts = originalConflicts;
    }
    if (kind === 'script') {
      const scope = String(value.scope || 'character');
      if (!['character', 'preset', 'global'].includes(scope)) {
        throw new HttpError(400, 'invalid_script_scope', `${name} 的脚本作用域无效`);
      }
      normalizedArtifact.scope = scope;
    }
    validateArtifactShape(normalizedArtifact, name);
    return normalizedArtifact;
  });
  const normalized = { schema_version: 1, artifacts };
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_BUNDLE_BYTES) throw new HttpError(413, 'bundle_too_large', '作品包超过 4 MB 的第一版限制');
  return normalized;
}
