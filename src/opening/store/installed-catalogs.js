const DB_NAME = 'reincarnation-workshop';
const STORE_NAME = 'opening_store_catalogs';
const DB_VERSION = 4;

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined' && typeof indexedDB?.open === 'function';
}

function openDb() {
  if (!hasIndexedDb()) return Promise.reject(new Error('当前环境不支持 IndexedDB，无法使用开局商店扩展'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('auth')) db.createObjectStore('auth', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('installed_projects')) db.createObjectStore('installed_projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('opening_assets')) db.createObjectStore('opening_assets', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开开局商店数据库'));
  });
}
async function all() {
  if(!hasIndexedDb()) return [];
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{const r=db.transaction(STORE_NAME,'readonly').objectStore(STORE_NAME).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}finally{db.close();}
}
export async function removeProjectStoreCatalogs(projectId) {
  if(!hasIndexedDb()) return 0;
  const rows=(await all()).filter(row=>row.sourceProjectId===projectId);
  if(!rows.length)return 0;
  const db=await openDb();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');rows.forEach(row=>tx.objectStore(STORE_NAME).delete(row.id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
  return rows.length;
}
export async function replaceProjectStoreCatalogs(project, dataArtifacts=[]) {
  const catalogs=dataArtifacts.flatMap(a=>Array.isArray(a?.content)?a.content:[a?.content]).filter(c=>c?.kind==='store_catalog');
  if(!hasIndexedDb()) {
    if(catalogs.length) throw new Error('当前环境不支持 IndexedDB，无法安装开局商店扩展');
    return 0;
  }
  await removeProjectStoreCatalogs(project.id);
  if(!catalogs.length)return 0;
  const db=await openDb();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');catalogs.forEach((catalog,index)=>tx.objectStore(STORE_NAME).put({id:`${project.id}:${index}`,sourceProjectId:project.id,sourceProjectName:project.name,sourceVersion:project.version,catalog:structuredClone(catalog.catalog||{})}));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
  return catalogs.length;
}
export async function getInstalledStoreCatalog() {
  const merged={equipments:[],items:[],skills:[]};
  for(const row of await all()) for(const key of Object.keys(merged)) for(const item of row.catalog?.[key]||[]) merged[key].push({...structuredClone(item),sourceProjectId:row.sourceProjectId,sourceProjectName:row.sourceProjectName});
  return merged;
}

export async function listProjectStoreCatalogs(projectId) {
  return (await all()).filter(row => row.sourceProjectId === projectId);
}
export async function restoreProjectStoreCatalogs(projectId, rows = []) {
  if(!hasIndexedDb()) {
    if(rows.length) throw new Error('当前环境不支持 IndexedDB，无法恢复开局商店扩展');
    return;
  }
  await removeProjectStoreCatalogs(projectId);
  if (!rows.length) return;
  const db=await openDb();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');rows.forEach(row=>tx.objectStore(STORE_NAME).put(structuredClone(row)));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
