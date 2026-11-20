// Emergency backup for the editor's current working state.
// localStorage remains the fast primary store; IndexedDB is used only when that write fails.
const DB_NAME = 'uds-emergency-project-backup';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const RECORD_ID = 'latest';
let pendingSnapshot = null;
let pendingWaiters = [];
let pendingTimer = null;

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB недоступен'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Не удалось открыть резервное хранилище'));
    request.onblocked = () => reject(new Error('Резервное хранилище заблокировано другой вкладкой'));
  });
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

async function writeSnapshot(snapshot) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id: RECORD_ID, savedAt: snapshot.savedAt, state: snapshot.state });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Не удалось записать резервную копию'));
      tx.onabort = () => reject(tx.error || new Error('Запись резервной копии отменена'));
    });
    return { savedAt: snapshot.savedAt };
  } finally {
    db.close();
  }
}

function flushPending() {
  const snapshot = pendingSnapshot;
  const waiters = pendingWaiters;
  pendingSnapshot = null;
  pendingWaiters = [];
  pendingTimer = null;
  writeSnapshot(snapshot).then(
    value => waiters.forEach(waiter => waiter.resolve(value)),
    error => waiters.forEach(waiter => waiter.reject(error))
  );
}

export function scheduleEmergencyBackup(state, savedAt = Date.now()) {
  let snapshot;
  try {
    snapshot = { savedAt: Number(savedAt) || Date.now(), state: cloneState(state) };
  } catch (error) {
    return Promise.reject(error);
  }
  pendingSnapshot = snapshot;
  const promise = new Promise((resolve, reject) => pendingWaiters.push({ resolve, reject }));
  if (pendingTimer !== null) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(flushPending, 350);
  return promise;
}

export async function loadEmergencyBackup() {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(RECORD_ID);
      request.onsuccess = () => {
        const record = request.result;
        resolve(record && Number.isFinite(record.savedAt) && record.state && typeof record.state === 'object' ? record : null);
      };
      request.onerror = () => reject(request.error || new Error('Не удалось прочитать резервную копию'));
      tx.onerror = () => reject(tx.error || new Error('Ошибка чтения резервной копии'));
    });
  } finally {
    db.close();
  }
}

export async function clearEmergencyBackup() {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(RECORD_ID);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Не удалось удалить резервную копию'));
    });
  } finally {
    db.close();
  }
}
