import { normalizeRegexArtifact } from './normalize/regex.js';
import { parsePresetContent, safePresetName } from './normalize/preset.js';
import { normalizeWorldbookArtifact } from './normalize/worldbook.js';
import { clone } from './utils.js';

export function buildArtifactPlan(installed) {
  const bundle = installed.bundle;
  if (!bundle || bundle.schema_version !== 1 || !Array.isArray(bundle.artifacts)) {
    throw new Error('本地作品包无效，请重新下载');
  }
  const plan = { worldbook: [], regexes: [], presets: [], data: [] };
  bundle.artifacts.forEach((artifact, index) => {
    if (artifact.kind === 'worldbook') {
      plan.worldbook.push(...normalizeWorldbookArtifact(artifact.content).map(entry => ({
        ...entry,
        extra: {
          ...(entry.extra ?? {}),
          reincarnationWorkshop: {
            sourceId: installed.id, sourceType: 'project_artifact',
            sourceTitle: installed.name, sourceVersion: installed.version,
            artifactIndex: index, artifactName: artifact.name,
          },
        },
      })));
      return;
    }
    if (artifact.kind === 'regex') {
      plan.regexes.push(...normalizeRegexArtifact(artifact.content, installed, index, artifact.name));
      return;
    }
    if (artifact.kind === 'preset') {
      plan.presets.push({
        name: safePresetName(installed, artifact.name, index),
        content: parsePresetContent(artifact.content),
      });
      return;
    }
    if (artifact.kind === 'data') {
      plan.data.push({ name: artifact.name, content: clone(artifact.content) });
      return;
    }
    throw new Error(`不支持的 artifact 类型：${artifact.kind}`);
  });
  return plan;
}
