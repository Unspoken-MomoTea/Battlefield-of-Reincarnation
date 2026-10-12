// 复用工坊已有 installed_projects 表，不新增 IndexedDB / MVU 存储结构。
export function projectScenarioCatalog(projects = []) {
  const rows = [];
  for (const project of projects) {
    if (!project?.applied) continue;
    const artifacts = project.bundle?.artifacts || [];
    for (const artifact of artifacts) {
      if (artifact?.kind !== 'data') continue;
      const contents = Array.isArray(artifact.content) ? artifact.content : [artifact.content];
      for (const data of contents) {
        if (data?.kind !== 'scenario' || data.schema_version !== 1 || !data.world) continue;
        rows.push({
          id: 'workshop:scenario:' + project.id,
          sourceProjectId: project.id,
          sourceProjectName: project.name,
          name: data.world, world: data.world,
          mode: data.mode || 'both',
          time: data.time || '', stage: data.stage || '',
          story: data.story || '', next: data.next || '',
          location: data.location || '', identity: data.identity || '',
          laws: data.laws || '', goal: data.goal || '',
          rank: data.rank || 'Ⅲ', tier: data.tier || 'F~D',
          overview: data.overview || '',
        });
      }
    }
  }
  return rows;
}
export async function listInstalledScenarios() {
  if (typeof indexedDB === 'undefined') return [];
  const db = await new Promise((resolve,reject)=>{
    const request = indexedDB.open('reincarnation-workshop',4);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  try {
    if (!db.objectStoreNames.contains('installed_projects')) return [];
    const projects = await new Promise((resolve,reject)=>{
      const request = db.transaction('installed_projects','readonly').objectStore('installed_projects').getAll();
      request.onsuccess=()=>resolve(request.result||[]);
      request.onerror=()=>reject(request.error);
    });
    return projectScenarioCatalog(projects);
  } finally {db.close();}
}
