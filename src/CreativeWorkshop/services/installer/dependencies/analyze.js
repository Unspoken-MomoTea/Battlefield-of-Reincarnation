function issue(type, extra = {}) {
  return { type, ...extra };
}

export async function analyzeProjectDependencies(installed, listInstalled, currentCharacter) {
  const dependencies = Array.isArray(installed?.dependencies) ? installed.dependencies : [];
  if (!dependencies.length) return { blocking: [], warnings: [] };

  const localProjects = await listInstalled();
  const byId = new Map(localProjects.map(project => [project.id, project]));
  const blocking = [];

  for (const dependency of dependencies) {
    const requiredId = dependency.project_id;
    const minVersion = Number(dependency.min_version || 1);
    const local = byId.get(requiredId);

    if (!local) {
      blocking.push(issue('dependency_missing', {
        project_id: requiredId,
        min_version: minVersion,
      }));
      continue;
    }

    if (!local.applied) {
      blocking.push(issue('dependency_not_applied', {
        project_id: requiredId,
        min_version: minVersion,
        name: local.name || requiredId,
        cached_version: Number(local.version || 0),
      }));
      continue;
    }

    const appliedVersion = Number(local.appliedVersion || 0);
    if (currentCharacter !== undefined && local.targetCharacterName && local.targetCharacterName !== currentCharacter) {
      blocking.push(issue('dependency_character_mismatch', {
        project_id: requiredId, name: local.name || requiredId, expected: local.targetCharacterName,
      }));
    }
    if (appliedVersion < minVersion) {
      blocking.push(issue('dependency_version_too_low', {
        project_id: requiredId,
        min_version: minVersion,
        name: local.name || requiredId,
        applied_version: appliedVersion,
        cached_version: Number(local.version || 0),
      }));
    }
  }

  return { blocking, warnings: [] };
}
