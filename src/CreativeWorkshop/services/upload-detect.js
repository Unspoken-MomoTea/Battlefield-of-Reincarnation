import { buildUploadBundle } from './upload.js';

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function values(value) {
  if (Array.isArray(value)) return value;
  const source = record(value);
  return source ? Object.values(source) : [];
}

function looksLikeScriptTree(value) {
  const tree = record(value);
  if (!tree) return false;
  if (tree.type === 'script') return typeof tree.content === 'string' && Boolean(String(tree.name || '').trim());
  if (tree.type === 'folder') {
    return Boolean(String(tree.name || '').trim()) &&
      Array.isArray(tree.scripts) &&
      tree.scripts.length > 0 &&
      tree.scripts.every(item => record(item)?.type === 'script' && typeof item.content === 'string');
  }
  return false;
}

function looksLikeScriptExport(parsed) {
  if (Array.isArray(parsed)) return parsed.length > 0 && parsed.every(looksLikeScriptTree);
  return looksLikeScriptTree(parsed);
}

function regexEntries(parsed) {
  if (Array.isArray(parsed)) return parsed;
  const source = record(parsed);
  if (!source) return [];
  if (Array.isArray(source.regexes)) return source.regexes;
  if (Array.isArray(source.extensions?.regex_scripts)) return source.extensions.regex_scripts;
  if (source.find_regex !== undefined || source.findRegex !== undefined) return [source];
  return [];
}

function looksLikeRegex(parsed) {
  const entries = regexEntries(parsed);
  return entries.length > 0 && entries.every(item => {
    const source = record(item);
    return source && typeof (source.find_regex ?? source.findRegex) === 'string';
  });
}

function looksLikeWorldbook(parsed) {
  const source = record(parsed);
  if (!source || source.entries === undefined) return false;
  const entries = values(source.entries);
  if (!entries.length) return false;
  return entries.every(item => {
    const entry = record(item);
    return entry &&
      typeof entry.content === 'string' &&
      Boolean(String(entry.comment ?? entry.name ?? '').trim());
  });
}

function looksLikePreset(parsed) {
  const source = record(parsed);
  if (!source) return false;
  const presetSignals = [
    'temperature',
    'max_context',
    'max_length',
    'top_p',
    'top_k',
    'min_p',
    'repetition_penalty',
    'openai_max_context',
    'prompts',
    'prompt_order',
  ];
  return presetSignals.some(key => key in source);
}

export function detectUploadKind(fileName, rawText) {
  const name = String(fileName || '').trim();
  const lower = name.toLowerCase();
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) {
    return { kind: 'script', confidence: 'certain', reason: 'JavaScript 文件' };
  }

  let parsed = null;
  if (lower.endsWith('.json')) {
    try { parsed = JSON.parse(rawText); }
    catch { throw new Error(`${name || 'JSON 文件'} 无法解析`); }

    if (
      record(parsed)?.schema_version === 1 &&
      Array.isArray(parsed.artifacts)
    ) {
      return { kind: 'bundle', confidence: 'certain', reason: '完整工坊 bundle' };
    }
    if (looksLikeWorldbook(parsed)) return { kind: 'worldbook', confidence: 'certain', reason: '识别到世界书 entries' };
    if (looksLikeRegex(parsed)) return { kind: 'regex', confidence: 'certain', reason: '识别到 SillyTavern 正则结构' };
    if (looksLikeScriptExport(parsed)) return { kind: 'script', confidence: 'certain', reason: '识别到 Tavern Helper ScriptTree' };
    if (looksLikePreset(parsed)) return { kind: 'preset', confidence: 'likely', reason: '识别到预设参数' };
    return { kind: 'data', confidence: 'unknown', reason: '未识别的 JSON，将作为数据文件' };
  }

  if (lower.endsWith('.txt')) {
    return { kind: 'data', confidence: 'unknown', reason: '普通文本文件' };
  }

  return { kind: 'data', confidence: 'unknown', reason: '未识别文件类型' };
}

export function buildDetectedUploadBundle(project, fileName, rawText, options = {}) {
  const detected = detectUploadKind(fileName, rawText);
  if (detected.kind === 'bundle') {
    const parsed = JSON.parse(rawText);
    return { bundle: parsed, detected };
  }

  const kind = options.kind || detected.kind;
  const bundle = buildUploadBundle(project, fileName, rawText, kind, {
    scriptScope: options.scriptScope || 'character',
    originalConflicts: options.originalConflicts || [],
  });
  return { bundle, detected: { ...detected, kind } };
}
