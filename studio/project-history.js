// История версий проектов хранится отдельно от текущего localStorage в IndexedDB.
// Снимки создаются только по явному действию пользователя; последние 10 версий каждого проекта сохраняются.
const DB_NAME = 'uds-project-history';
const DB_VERSION = 1;
const STORE_NAME = 'versions';
export const MAX_PROJECT_VERSIONS = 10;

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB недоступен в этом браузере'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
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
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).index('projectId').getAll(String(projectId));
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
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.add(snapshot);
      const request = store.index('projectId').getAll(String(projectId));
      request.onsuccess = () => {
        const versions = request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        for (const old of versions.slice(MAX_PROJECT_VERSIONS)) store.delete(old.id);
      };
      request.onerror = () => { try { tx.abort(); } catch {} };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Не удалось сохранить версию проекта'));
      tx.onabort = () => reject(tx.error || new Error('Сохранение версии отменено'));
    });
    return snapshot;
  } finally { db.close(); }
}

export async function getProjectVersion(versionId) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(String(versionId));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Не удалось открыть версию проекта'));
    });
  } finally { db.close(); }
}

export async function deleteProjectVersion(versionId) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(String(versionId));
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
