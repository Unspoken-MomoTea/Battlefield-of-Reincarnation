import { parseJsonLike, record } from '../utils.js';

export function parsePresetContent(content) {
  const parsed = parseJsonLike(content, '预设');
  if (!record(parsed)) throw new Error('预设 artifact 必须是 JSON 对象');
  return structuredClone(parsed);
}

export function safePresetName(project, artifactName, artifactIndex = 0) {
  const suffix = `${String(project.id).slice(0, 8)}-${artifactIndex + 1}`;
  const prefix = `[创意工坊] ${project.name} · `;
  const room = Math.max(1, 120 - prefix.length - suffix.length - 3);
  return `${prefix}${String(artifactName).slice(0, room)} · ${suffix}`;
}
