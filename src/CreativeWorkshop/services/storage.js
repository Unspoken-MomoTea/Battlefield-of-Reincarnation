const DB_NAME = 'reincarnation-workshop';
const DB_VERSION = 1;
const AUTH_STORE = 'auth';

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
      if (!db.objectStoreNames.contains(AUTH_STORE)) {
        db.createObjectStore(AUTH_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开创意工坊本地数据库'));
  });
  return dbPromise;
}

export async function getAuthRecord() {
  const db = await openDb();
  return requestResult(db.transaction(AUTH_STORE, 'readonly').objectStore(AUTH_STORE).get('session'));
}

export async function putAuthRecord(auth) {
  const db = await openDb();
  const transaction = db.transaction(AUTH_STORE, 'readwrite');
  transaction.objectStore(AUTH_STORE).put({ ...auth, key: 'session' });
  await transactionDone(transaction);
}

export async function clearAuthRecord() {
  const db = await openDb();
  const transaction = db.transaction(AUTH_STORE, 'readwrite');
  transaction.objectStore(AUTH_STORE).delete('session');
  await transactionDone(transaction);
}
