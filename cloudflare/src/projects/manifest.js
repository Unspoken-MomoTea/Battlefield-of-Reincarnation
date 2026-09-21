import { parseDependencies } from './dependencies.js';
import { sha256Hex } from '../security.js';

function artifactContentText(artifact) {
  return artifact.format === 'text' ? artifact.content : JSON.stringify(artifact.content);
}

export async function buildManifest(project, version, bundle) {
  const artifacts = [];
  let totalBytes = 0;
  for (const artifact of bundle.artifacts) {
    const content = artifactContentText(artifact);
    const byteSize = new TextEncoder().encode(content).byteLength;
    totalBytes += byteSize;
    artifacts.push({
      kind: artifact.kind, format: artifact.format, name: artifact.name,
      ...(artifact.kind === 'script' ? { scope: artifact.scope || 'character' } : {}),
      ...(['worldbook', 'script'].includes(artifact.kind) && artifact.original_conflicts?.length
        ? { original_conflicts: artifact.original_conflicts }
        : {}),
      byte_size: byteSize, sha256: await sha256Hex(content),
    });
  }
  return {
    schema_version: 1,
    resource_overrides: Array.isArray(bundle.resource_overrides) ? bundle.resource_overrides : [],
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      category: project.category,
      version,
      dependencies: parseDependencies(project.dependencies),
    },
    artifact_count: artifacts.length, total_bytes: totalBytes, artifacts,
  };
}
