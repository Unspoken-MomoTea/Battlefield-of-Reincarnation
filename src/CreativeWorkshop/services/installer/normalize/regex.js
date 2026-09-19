import { finiteNumber, parseJsonLike, record, strings } from '../utils.js';

function regexValues(content) {
  const parsed = parseJsonLike(content, '正则');
  if (Array.isArray(parsed)) return parsed;
  const root = record(parsed);
  if (!root) throw new Error('正则 artifact 结构无效');
  if (Array.isArray(root.regexes)) return root.regexes;
  if (Array.isArray(root.extensions?.regex_scripts)) return root.extensions.regex_scripts;
  if (root.find_regex !== undefined || root.findRegex !== undefined) return [root];
  throw new Error('正则 artifact 中没有可识别的正则列表');
}

function sourceFromLegacy(value) {
  if (record(value.source)) {
    return {
      user_input: Boolean(value.source.user_input), ai_output: Boolean(value.source.ai_output),
      slash_command: Boolean(value.source.slash_command), world_info: Boolean(value.source.world_info),
      reasoning: Boolean(value.source.reasoning),
    };
  }
  const placement = Array.isArray(value.placement) ? value.placement.map(Number) : [];
  if (!placement.length) return { user_input: true, ai_output: true, slash_command: true, world_info: true, reasoning: true };
  return {
    user_input: placement.includes(1), ai_output: placement.includes(2),
    slash_command: placement.includes(3), world_info: placement.includes(5),
    reasoning: placement.includes(6),
  };
}

function destinationFromLegacy(value) {
  if (record(value.destination)) {
    return { display: Boolean(value.destination.display), prompt: Boolean(value.destination.prompt) };
  }
  if (value.markdownOnly === true) return { display: true, prompt: false };
  if (value.promptOnly === true) return { display: false, prompt: true };
  return { display: true, prompt: true };
}

export function normalizeRegexArtifact(content, project, artifactIndex, artifactName) {
  return regexValues(content).map((value, index) => {
    const regex = record(value);
    if (!regex) throw new Error(`第 ${index + 1} 个正则结构无效`);
    const find = regex.find_regex ?? regex.findRegex;
    if (typeof find !== 'string') throw new Error(`第 ${index + 1} 个正则缺少 findRegex`);
    const originalName = String(regex.script_name ?? regex.scriptName ?? artifactName ?? `正则 ${index + 1}`).trim();
    return {
      id: `rw:${project.id}:${artifactIndex}:${index}`,
      script_name: `[工坊] ${project.name} · ${originalName}`,
      enabled: typeof regex.enabled === 'boolean' ? regex.enabled : regex.disabled !== true,
      find_regex: find,
      replace_string: String(regex.replace_string ?? regex.replaceString ?? ''),
      trim_strings: strings(regex.trim_strings ?? regex.trimStrings),
      source: sourceFromLegacy(regex),
      destination: destinationFromLegacy(regex),
      run_on_edit: Boolean(regex.run_on_edit ?? regex.runOnEdit),
      min_depth: regex.min_depth == null && regex.minDepth == null ? null : finiteNumber(regex.min_depth ?? regex.minDepth, 0),
      max_depth: regex.max_depth == null && regex.maxDepth == null ? null : finiteNumber(regex.max_depth ?? regex.maxDepth, 0),
    };
  });
}
