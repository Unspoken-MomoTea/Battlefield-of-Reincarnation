const DB_NAME = 'reincarnation-workshop';
const STORE_NAME = 'opening_assets';
const DB_VERSION = 4;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开开局资产数据库'));
  });
}

async function withStore(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let value;
      try { value = action(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error || new Error('开局资产数据库操作失败'));
      tx.onabort = () => reject(tx.error || new Error('开局资产数据库操作已取消'));
    });
  } finally {
    db.close();
  }
}

export async function putOpeningAsset(asset) {
  if (!asset?.id) throw new Error('开局资产缺少 id');
  await withStore('readwrite', store => store.put(structuredClone(asset)));
  return asset;
}

export async function removeOpeningAssetsByProject(projectId) {
  const all = await listOpeningAssets();
  const targets = all.filter(asset => asset.sourceProjectId === projectId);
  if (!targets.length) return 0;
  await withStore('readwrite', store => targets.forEach(asset => store.delete(asset.id)));
  return targets.length;
}

export async function listOpeningAssets(kind = '') {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const values = request.result || [];
        resolve(kind ? values.filter(asset => asset.kind === kind) : values);
      };
      request.onerror = () => reject(request.error || new Error('读取开局资产失败'));
    });
  } finally {
    db.close();
  }
}

export async function replaceProjectOpeningAssets(project, dataArtifacts = []) {
  await removeOpeningAssetsByProject(project.id);
  let count = 0;
  for (const [index, artifact] of dataArtifacts.entries()) {
    const content = artifact?.content;
    const values = Array.isArray(content) ? content : [content];
    for (const [itemIndex, asset] of values.entries()) {
      if (!asset || typeof asset !== 'object') continue;
      if (!['world_character', 'opening_character', 'opening_partner'].includes(asset.kind)) continue;
      await putOpeningAsset({
        ...structuredClone(asset),
        id: `${project.id}:${index}:${itemIndex}`,
        sourceProjectId: project.id,
        sourceProjectName: project.name,
        sourceVersion: project.version,
      });
      count += 1;
    }
  }
  return count;
}
