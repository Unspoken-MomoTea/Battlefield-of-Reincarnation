import { createDatabaseCoordinator } from './storage/lifecycle.js';

const DB_NAME = 'reincarnation-workshop';
const DB_VERSION = 4;
const AUTH_STORE = 'auth';
const INSTALLED_STORE = 'installed_projects';
const META_STORE = 'meta';

let dbPromise;
let activeDatabase = null;
let coordinator = null;
let pagehideBound = false;

const DATABASE_BLOCK_TIMEOUT_MS = 15_000;

function hostWindow() {
  try {
    return window.parent ?? window;
  } catch {
    return globalThis;
  }
}

function idbFactory() {
  try {
    return window.parent?.indexedDB ?? indexedDB;
  } catch {
    return indexedDB;
  }
}

function closeActiveDatabase() {
  if (!activeDatabase) return;
  try { activeDatabase.close(); } catch {}
  activeDatabase = null;
  dbPromise = undefined;
}

function ensureDatabaseLifecycle() {
  if (!coordinator) {
    coordinator = createDatabaseCoordinator({
      host: hostWindow(),
      onClose: closeActiveDatabase,
    });
  }
  if (!pagehideBound && typeof globalThis.addEventListener === 'function') {
    pagehideBound = true;
    globalThis.addEventListener('pagehide', closeActiveDatabase);
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
  ensureDatabaseLifecycle();

  const opening = new Promise((resolve, reject) => {
    const request = idbFactory().open(DB_NAME, DB_VERSION);
    let settled = false;
    let blockedTimer;

    const clearBlockedTimer = () => {
      if (blockedTimer !== undefined) globalThis.clearTimeout?.(blockedTimer);
      blockedTimer = undefined;
    };
    const fail = error => {
      if (settled) return;
      settled = true;
      clearBlockedTimer();
      reject(error);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUTH_STORE)) db.createObjectStore(AUTH_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(INSTALLED_STORE)) db.createObjectStore(INSTALLED_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains('opening_assets')) db.createObjectStore('opening_assets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('opening_store_catalogs')) db.createObjectStore('opening_store_catalogs', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      clearBlockedTimer();
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      activeDatabase = request.result;
      activeDatabase.onversionchange = closeActiveDatabase;
      resolve(activeDatabase);
    };
    request.onerror = () => fail(request.error ?? new Error('无法打开创意工坊本地数据库'));
    request.onblocked = () => {
      coordinator?.requestCloseForUpgrade(DB_VERSION);
      if (blockedTimer === undefined) {
        blockedTimer = globalThis.setTimeout?.(
          () => fail(new Error('创意工坊本地数据库升级超时；请关闭其他酒馆标签页，并刷新当前页面后重试')),
          DATABASE_BLOCK_TIMEOUT_MS,
        );
      }
    };
  });

  dbPromise = opening;
  void opening.catch(() => {
    if (dbPromise === opening) dbPromise = undefined;
  });
  return opening;
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
