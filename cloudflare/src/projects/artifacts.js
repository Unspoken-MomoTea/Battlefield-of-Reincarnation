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

function normalizeOriginalScriptConflicts(value, artifactName) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'invalid_original_script_conflicts', `${artifactName} 的 original_conflicts 必须是数组`);
  }
  if (value.length > 100) {
    throw new HttpError(400, 'original_script_conflicts_too_large', `${artifactName} 的原脚本冲突声明超过 100 条`);
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, 'invalid_original_script_conflicts', `${artifactName} 的第 ${index + 1} 条原脚本冲突无效`);
    }
    const action = String(item.action || '');
    if (!['disable', 'replace'].includes(action)) {
      throw new HttpError(400, 'invalid_original_script_conflict_action', `${artifactName} 的第 ${index + 1} 条原脚本冲突动作无效`);
    }
    const target = item.target;
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      throw new HttpError(400, 'invalid_original_script_conflict_target', `${artifactName} 的第 ${index + 1} 条原脚本冲突缺少 target`);
    }
    const scope = String(target.scope || '').trim();
    const id = String(target.id || '').trim();
    const name = String(target.name || '').trim();
    const folder = String(target.folder || '').trim();
    if (!['character', 'preset', 'global'].includes(scope)) {
      throw new HttpError(400, 'invalid_original_script_conflict_scope', `${artifactName} 的第 ${index + 1} 条原脚本作用域无效`);
    }
    if (!id && !name) {
      throw new HttpError(400, 'invalid_original_script_conflict_target', `${artifactName} 的第 ${index + 1} 条原脚本冲突至少需要 id 或 name`);
    }
    return {
      action,
      target: {
        scope,
        ...(id ? { id } : {}),
        ...(name ? { name } : {}),
        ...(folder ? { folder } : {}),
      },
    };
  });
}

function normalizeResourceOverrides(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'invalid_resource_overrides', 'resource_overrides 必须是数组');
  }
  if (value.length > 300) {
    throw new HttpError(400, 'resource_overrides_too_large', '原版资源状态规则超过 300 条');
  }

  const seen = new Set();
  const output = [];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, 'invalid_resource_override', `第 ${index + 1} 条原版资源状态规则无效`);
    }
    const kind = String(item.kind || '').trim();
    const state = String(item.state || '').trim();
    if (!['worldbook', 'regex', 'script'].includes(kind)) {
      throw new HttpError(400, 'invalid_resource_override_kind', `第 ${index + 1} 条原版资源类型无效`);
    }
    if (!['enabled', 'disabled'].includes(state)) {
      throw new HttpError(400, 'invalid_resource_override_state', `第 ${index + 1} 条原版资源目标状态无效`);
    }
    const target = item.target;
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      throw new HttpError(400, 'invalid_resource_override_target', `第 ${index + 1} 条原版资源状态规则缺少 target`);
    }

    let normalizedTarget;
    let key;
    if (kind === 'worldbook') {
      const worldbook = String(target.worldbook || '').trim();
      const uid = String(target.uid ?? '').trim();
      const name = String(target.name || '').trim();
      if (!uid && !name) {
        throw new HttpError(400, 'invalid_resource_override_target', `第 ${index + 1} 条世界书状态规则至少需要 UID 或名称`);
      }
      normalizedTarget = {
        ...(worldbook ? { worldbook } : {}),
        ...(uid ? { uid } : {}),
        ...(name ? { name } : {}),
      };
      key = uid
        ? `worldbook\u0000uid:${uid}`
        : `worldbook\u0000${worldbook}\u0000name:${name}`;
    } else if (kind === 'regex') {
      const scope = String(target.scope || 'character').trim();
      const id = String(target.id || '').trim();
      const name = String(target.name || '').trim();
      const findRegex = String(target.find_regex ?? target.findRegex ?? '').trim();
      if (scope !== 'character') {
        throw new HttpError(400, 'invalid_resource_override_scope', `第 ${index + 1} 条正则状态规则目前只支持当前角色`);
      }
      if (!id && !name) {
        throw new HttpError(400, 'invalid_resource_override_target', `第 ${index + 1} 条正则状态规则至少需要 id 或名称`);
      }
      normalizedTarget = {
        scope,
        ...(id ? { id } : {}),
        ...(name ? { name } : {}),
        ...(findRegex ? { find_regex: findRegex } : {}),
      };
      key = `regex\u0000${scope}\u0000${id ? `id:${id}` : `name:${name}\u0000find:${findRegex}`}`;
    } else {
      const scope = String(target.scope || '').trim();
      const id = String(target.id || '').trim();
      const name = String(target.name || '').trim();
      const folder = String(target.folder || '').trim();
      if (!['character', 'preset', 'global'].includes(scope)) {
        throw new HttpError(400, 'invalid_resource_override_scope', `第 ${index + 1} 条脚本状态规则作用域无效`);
      }
      if (!id && !name) {
        throw new HttpError(400, 'invalid_resource_override_target', `第 ${index + 1} 条脚本状态规则至少需要 id 或名称`);
      }
      normalizedTarget = {
        scope,
        ...(id ? { id } : {}),
        ...(name ? { name } : {}),
        ...(folder ? { folder } : {}),
      };
      key = `script\u0000${scope}\u0000${id ? `id:${id}` : `folder:${folder}\u0000name:${name}`}`;
    }

    if (seen.has(key)) {
      throw new HttpError(400, 'duplicate_resource_override', `第 ${index + 1} 条原版资源状态规则与前面的规则重复`);
    }
    seen.add(key);
    output.push({ kind, state, target: normalizedTarget });
  }
  return output;
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
      const originalConflicts = normalizeOriginalScriptConflicts(value.original_conflicts, name);
      if (originalConflicts.length) normalizedArtifact.original_conflicts = originalConflicts;
    }
    validateArtifactShape(normalizedArtifact, name);
    return normalizedArtifact;
  });
  const normalized = { schema_version: 1, artifacts };
  const resourceOverrides = normalizeResourceOverrides(bundle.resource_overrides);
  if (resourceOverrides.length) normalized.resource_overrides = resourceOverrides;
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_BUNDLE_BYTES) throw new HttpError(413, 'bundle_too_large', '作品包超过 4 MB 的第一版限制');
  return normalized;
}
