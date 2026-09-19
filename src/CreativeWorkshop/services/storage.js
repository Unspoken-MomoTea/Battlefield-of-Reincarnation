const DB_NAME = 'reincarnation-workshop';
const DB_VERSION = 3;
const AUTH_STORE = 'auth';
const INSTALLED_STORE = 'installed_projects';
const META_STORE = 'meta';

let dbPromise;

function idbFactory() {
  try {
    return window.parent?.indexedDB ?? indexedDB;
  } catch {
    return indexedDB;
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 事务失败'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 事务已中止'));
  });
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = idbFactory().open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUTH_STORE)) db.createObjectStore(AUTH_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(INSTALLED_STORE)) db.createObjectStore(INSTALLED_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = undefined;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('无法打开创意工坊本地数据库'));
    request.onblocked = () => reject(new Error('创意工坊本地数据库升级被其他页面阻塞，请刷新页面后重试'));
  });
  void dbPromise.catch(() => {
    dbPromise = undefined;
  });
  return dbPromise;
}

async function getRecord(storeName, key) {
  const db = await openDb();
  return requestResult(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
}

async function getAllRecords(storeName) {
  const db = await openDb();
  return requestResult(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
}

async function putRecord(storeName, value) {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(value);
  await transactionDone(transaction);
}

async function deleteRecord(storeName, key) {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
}

export const getAuthRecord = () => getRecord(AUTH_STORE, 'session');
export const putAuthRecord = auth => putRecord(AUTH_STORE, { ...auth, key: 'session' });
export const clearAuthRecord = () => deleteRecord(AUTH_STORE, 'session');

export const getInstalledProject = id => getRecord(INSTALLED_STORE, id);
export const getInstalledProjects = () => getAllRecords(INSTALLED_STORE);
export const putInstalledProject = project => putRecord(INSTALLED_STORE, project);
export const deleteInstalledProject = id => deleteRecord(INSTALLED_STORE, id);


export const getMetaRecord = key => getRecord(META_STORE, key);
export const putMetaRecord = value => putRecord(META_STORE, value);
export const deleteMetaRecord = key => deleteRecord(META_STORE, key);
