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

function validateArtifactShape(artifact, name) {
  if (artifact.kind === 'worldbook') validateWorldbookContent(artifact, name);
  if (artifact.kind === 'regex') validateRegexContent(artifact, name);
  if (artifact.kind === 'preset') validatePresetContent(artifact, name);
}

export function validateBundle(bundle, projectCategory) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new HttpError(400, 'invalid_bundle', 'bundle 必须是对象');
  if (bundle.schema_version !== 1) throw new HttpError(400, 'invalid_bundle_version', '目前只支持 schema_version = 1');
  if (!Array.isArray(bundle.artifacts) || bundle.artifacts.length < 1 || bundle.artifacts.length > MAX_ARTIFACTS) {
    throw new HttpError(400, 'invalid_artifacts', `artifacts 必须包含 1-${MAX_ARTIFACTS} 个项目`);
  }

  const artifacts = bundle.artifacts.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid_artifact', `第 ${index + 1} 个 artifact 无效`);
    const kind = String(value.kind || '');
    if (!ARTIFACT_KIND_SET.has(kind)) throw new HttpError(400, 'invalid_artifact_kind', `不支持的 artifact 类型：${kind || '(空)'}`);
    if (projectCategory !== 'mixed' && kind !== projectCategory) throw new HttpError(400, 'artifact_category_mismatch', `作品类型 ${projectCategory} 不能包含 ${kind}`);
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
    validateArtifactShape(normalizedArtifact, name);
    return normalizedArtifact;
  });
  const normalized = { schema_version: 1, artifacts };
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_BUNDLE_BYTES) throw new HttpError(413, 'bundle_too_large', '作品包超过 4 MB 的第一版限制');
  return normalized;
}
