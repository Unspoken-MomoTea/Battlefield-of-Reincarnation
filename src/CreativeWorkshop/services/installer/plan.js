import { normalizeRegexArtifact } from './normalize/regex.js';
import { parsePresetContent, safePresetName } from './normalize/preset.js';
import { normalizeWorldbookArtifact } from './normalize/worldbook.js';
import { normalizeScriptArtifact } from './normalize/script.js';
import { clone } from './utils.js';
import { resourceOverridesFromBundle } from '../resource-overrides.js';

export function buildArtifactPlan(installed) {
  const bundle = installed.bundle;
  if (!bundle || bundle.schema_version !== 1 || !Array.isArray(bundle.artifacts)) {
    throw new Error('本地作品包无效，请重新下载');
  }
  const dataKinds = new Set(bundle.artifacts.flatMap(artifact => {
    if (artifact?.kind !== 'data') return [];
    const values = Array.isArray(artifact.content) ? artifact.content : [artifact.content];
    return values.map(value => String(value?.kind || '').trim()).filter(Boolean);
  }));
  const worldCharacterBundle = dataKinds.has('world_character');

  const plan = {
    worldbook: [],
    regexes: [],
    presets: [],
    scripts: { character: [], preset: [], global: [] },
    data: [],
    originalConflicts: [],
    originalRegexConflicts: [],
    originalScriptConflicts: [],
  };
  bundle.artifacts.forEach((artifact, index) => {
    if (artifact.kind === 'worldbook') {
      plan.worldbook.push(...normalizeWorldbookArtifact(artifact.content).map(entry => ({
        ...entry,
        ...(worldCharacterBundle ? {
          position: {
            type: 'after_character_definition',
            role: 'system',
            order: 600,
          },
        } : {}),
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
    if (artifact.kind === 'script') {
      const normalized = normalizeScriptArtifact(artifact, installed, index);
      plan.scripts[normalized.scope].push(...normalized.trees);
      return;
    }
    if (artifact.kind === 'data') {
      plan.data.push({ name: artifact.name, content: clone(artifact.content) });
      return;
    }
    throw new Error(`不支持的 artifact 类型：${artifact.kind}`);
  });

  for (const rule of resourceOverridesFromBundle(bundle)) {
    const directive = {
      state: rule.state,
      action: rule.state === 'enabled' ? 'enable' : 'disable',
      target: clone(rule.target),
    };
    if (rule.kind === 'worldbook') plan.originalConflicts.push(directive);
    if (rule.kind === 'regex') plan.originalRegexConflicts.push(directive);
    if (rule.kind === 'script') plan.originalScriptConflicts.push(directive);
  }

  return plan;
}
