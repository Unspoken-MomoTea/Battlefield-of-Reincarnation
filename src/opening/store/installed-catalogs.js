const DB_NAME = 'reincarnation_workshop';
const STORE_NAME = 'opening_store_catalogs';
const DB_VERSION = 6;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('opening_assets')) db.createObjectStore('opening_assets', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开开局商店数据库'));
  });
}
async function all() {
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{const r=db.transaction(STORE_NAME,'readonly').objectStore(STORE_NAME).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}finally{db.close();}
}
export async function removeProjectStoreCatalogs(projectId) {
  const rows=(await all()).filter(row=>row.sourceProjectId===projectId);
  if(!rows.length)return 0;
  const db=await openDb();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');rows.forEach(row=>tx.objectStore(STORE_NAME).delete(row.id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
  return rows.length;
}
export async function replaceProjectStoreCatalogs(project, dataArtifacts=[]) {
  await removeProjectStoreCatalogs(project.id);
  const catalogs=dataArtifacts.map(a=>a?.content).filter(c=>c?.kind==='store_catalog');
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
