// История версий проектов хранится отдельно от текущего localStorage в IndexedDB.
// Список содержит только метаданные; большие снимки (включая фотографии) читаются лишь при сравнении/восстановлении.
const DB_NAME = 'uds-project-history';
const DB_VERSION = 2;
const META_STORE = 'versions';
const SNAPSHOT_STORE = 'snapshots';
export const MAX_PROJECT_VERSIONS = 10;

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB недоступен в этом браузере'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Не удалось открыть историю версий'));
    request.onblocked = () => reject(new Error('История версий заблокирована другой вкладкой'));
  });
}

function makeId() {
  return globalThis.crypto?.randomUUID?.()
    || 'version-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export async function listProjectVersions(projectId) {
  if (!projectId) return [];
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const request = tx.objectStore(META_STORE).index('projectId').getAll(String(projectId));
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      request.onerror = () => reject(request.error || new Error('Не удалось прочитать историю версий'));
      tx.onerror = () => reject(tx.error || new Error('Ошибка чтения истории версий'));
    });
  } finally { db.close(); }
}

export async function saveProjectVersion({ projectId, raw, analysis = null, label = '' }) {
  if (!projectId || !raw || typeof raw !== 'object') throw new Error('Не удалось определить проект для сохранения версии');
  const snapshot = {
    id: makeId(),
    projectId: String(projectId),
    createdAt: new Date().toISOString(),
    label: String(label || '').trim().slice(0, 80),
    raw,
    analysis: analysis && typeof analysis === 'object' ? analysis : null,
  };
  const metadata = { id: snapshot.id, projectId: snapshot.projectId, createdAt: snapshot.createdAt, label: snapshot.label };
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction([META_STORE, SNAPSHOT_STORE], 'readwrite');
      const metaStore = tx.objectStore(META_STORE);
      const snapshotStore = tx.objectStore(SNAPSHOT_STORE);
      metaStore.add(metadata);
      snapshotStore.add({ id: snapshot.id, raw: snapshot.raw, analysis: snapshot.analysis });
      const request = metaStore.index('projectId').getAll(String(projectId));
      request.onsuccess = () => {
        const versions = request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        for (const old of versions.slice(MAX_PROJECT_VERSIONS)) {
          metaStore.delete(old.id);
          snapshotStore.delete(old.id);
        }
      };
      request.onerror = () => { try { tx.abort(); } catch {} };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Не удалось сохранить версию проекта'));
      tx.onabort = () => reject(tx.error || new Error('Сохранение версии отменено'));
    });
    return metadata;
  } finally { db.close(); }
}

export async function getProjectVersion(versionId) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([META_STORE, SNAPSHOT_STORE], 'readonly');
      const metadataRequest = tx.objectStore(META_STORE).get(String(versionId));
      const snapshotRequest = tx.objectStore(SNAPSHOT_STORE).get(String(versionId));
      let metadata, snapshot;
      const finish = () => {
        if (metadata === undefined || snapshot === undefined) return;
        resolve(metadata && snapshot ? { ...metadata, ...snapshot } : null);
      };
      metadataRequest.onsuccess = () => { metadata = metadataRequest.result || null; finish(); };
      snapshotRequest.onsuccess = () => { snapshot = snapshotRequest.result || null; finish(); };
      metadataRequest.onerror = () => reject(metadataRequest.error || new Error('Не удалось открыть версию проекта'));
      snapshotRequest.onerror = () => reject(snapshotRequest.error || new Error('Не удалось открыть снимок проекта'));
      tx.onerror = () => reject(tx.error || new Error('Ошибка чтения снимка проекта'));
    });
  } finally { db.close(); }
}

export async function deleteProjectVersion(versionId) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction([META_STORE, SNAPSHOT_STORE], 'readwrite');
      tx.objectStore(META_STORE).delete(String(versionId));
      tx.objectStore(SNAPSHOT_STORE).delete(String(versionId));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Не удалось удалить версию проекта'));
      tx.onabort = () => reject(tx.error || new Error('Удаление версии отменено'));
    });
  } finally { db.close(); }
}

function valueLabel(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) return String(value.length);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function compareProjectSnapshots(before = {}, after = {}) {
  const fields = [
    ['Бренд', 'brand'], ['Ниша', 'niche'], ['Заголовок', 'title'],
    ['Описание', 'description'], ['Текст кнопки', 'cta'],
    ['Архитектура', 'architecture'], ['Класс проекта', 'tier'],
    ['Город', 'city'],
  ];
  const changes = [];
  for (const [label, key] of fields) {
    const a = before[key] ?? null, b = after[key] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ field: label, before: valueLabel(a), after: valueLabel(b) });
  }
  for (const [label, key] of [['Услуги / товары', 'services'], ['Галерея', 'gallery'], ['Категории', 'categories']]) {
    const a = Array.isArray(before[key]) ? before[key].length : 0;
    const b = Array.isArray(after[key]) ? after[key].length : 0;
    if (a !== b) changes.push({ field: label, before: String(a), after: String(b) });
  }
  const images = raw => [raw.images?.hero, raw.images?.heroMobile, ...(raw.gallery || []).map(x => x?.src), ...(raw.services || []).map(x => Array.isArray(x) ? x[3] : x?.image)].filter(Boolean).length;
  const a = images(before), b = images(after);
  if (a !== b) changes.push({ field: 'Изображения', before: String(a), after: String(b) });
  return changes;
}
