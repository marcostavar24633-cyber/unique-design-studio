// Единый реестр пользовательских инструкций для AI-модулей студии.
// Данные хранятся в браузере; экспорт JSON позволяет переносить их между устройствами.
export const PROMPT_MANAGER_KEY = 'uds:prompt-manager:v1';
export const PROMPT_MODULES = [
  { id: 'landing-copy', name: 'Тексты сайта', category: 'Контент', description: 'Основной промт buildPrompt: тексты, оффер, аудитория, SEO и JSON-контракт.' },
  { id: 'image-generation', name: 'Генерация изображений', category: 'Графика', description: 'Дополнительные указания для FLUX: сюжет, стиль съёмки и визуальная точность.' },
  { id: 'content-director', name: 'Content Director', category: 'Контент', description: 'Правила подготовки структуры, смыслов и контента проекта.' },
  { id: 'design-director', name: 'Design Director', category: 'Дизайн', description: 'Критерии анализа и улучшения визуальной концепции.' },
  { id: 'market-research', name: 'Исследование рынка', category: 'Аналитика', description: 'Требования к источникам, конкурентам и проверке рыночных гипотез.' },
];
export const PROMPT_LIMITS = Object.freeze({ 'landing-copy': 1500, 'image-generation': 1000, 'content-director': 1500, 'design-director': 1800, 'market-research': 1500 });
const clone = value => JSON.parse(JSON.stringify(value));
const cleanText = value => String(value ?? '').replace(/\r\n/g, '\n').trim();
export function emptyPromptRegistry() {
  return { schemaVersion: 1, updatedAt: null, modules: Object.fromEntries(PROMPT_MODULES.map(m => [m.id, { activeVersion: 0, versions: [] }])) };
}
export function normalizePromptRegistry(value) {
  const out = emptyPromptRegistry();
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1 || !value.modules || typeof value.modules !== 'object') return out;
  for (const meta of PROMPT_MODULES) {
    const source = value.modules[meta.id];
    if (!source || !Array.isArray(source.versions)) continue;
    const versions = source.versions.filter(v => v && Number.isInteger(v.version) && v.version > 0 && typeof v.content === 'string')
      .slice(-30).map(v => ({ version: v.version, content: cleanText(v.content), createdAt: String(v.createdAt || ''), note: String(v.note || '') }))
      .filter(v => v.content.length <= (PROMPT_LIMITS[meta.id] || 12000) && (meta.id !== 'image-generation' || !/[а-яё]/i.test(v.content)));
    const available = new Set(versions.map(v => v.version));
    const activeVersion = available.has(source.activeVersion) ? source.activeVersion : (versions.at(-1)?.version || 0);
    out.modules[meta.id] = { activeVersion, versions };
  }
  out.updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : null;
  return out;
}
function browserStorage() {
  try { return globalThis.localStorage || null; }
  catch { return null; }
}
export function loadPromptRegistry(storage) {
  try {
    const target = arguments.length ? storage : browserStorage();
    return normalizePromptRegistry(JSON.parse(target?.getItem(PROMPT_MANAGER_KEY) || 'null'));
  } catch { return emptyPromptRegistry(); }
}
export function savePromptRegistry(registry, storage) {
  const normalized = normalizePromptRegistry(registry);
  normalized.updatedAt = new Date().toISOString();
  try {
    const target = arguments.length > 1 ? storage : browserStorage();
    if (!target) throw new Error('Хранилище браузера недоступно');
    target.setItem(PROMPT_MANAGER_KEY, JSON.stringify(normalized));
    return { ok: true, registry: normalized };
  } catch (error) { return { ok: false, error: error?.message || 'storage-unavailable', registry: normalized }; }
}
export function activePrompt(registry, moduleId) {
  const item = normalizePromptRegistry(registry).modules[moduleId];
  return item?.versions.find(v => v.version === item.activeVersion)?.content || '';
}
export function savePromptVersion(registry, moduleId, content, note = '') {
  if (!PROMPT_MODULES.some(m => m.id === moduleId)) throw new Error('Unknown prompt module: ' + moduleId);
  const normalized = normalizePromptRegistry(registry);
  const item = normalized.modules[moduleId];
  const text = cleanText(content);
  if (text.length > 12000) throw new Error('Промт не должен превышать 12 000 символов');
  if (!text) throw new Error('Промт не может быть пустым');
  const limit = PROMPT_LIMITS[moduleId] || 12000;
  if (text.length > limit) throw new Error('Лимит для этого AI-модуля — ' + limit.toLocaleString('ru-RU') + ' символов.');
  if (moduleId === 'image-generation' && /[а-яё]/i.test(text)) throw new Error('Инструкции для генерации изображений вводите на английском: FLUX не понимает русскую транслитерацию как перевод.');
  const version = Math.max(0, ...item.versions.map(v => v.version)) + 1;
  item.versions.push({ version, content: text, createdAt: new Date().toISOString(), note: cleanText(note).slice(0, 240) });
  item.versions = item.versions.slice(-30);
  item.activeVersion = version;
  normalized.updatedAt = new Date().toISOString();
  return normalized;
}
export function activatePromptVersion(registry, moduleId, version) {
  const normalized = normalizePromptRegistry(registry);
  const item = normalized.modules[moduleId];
  if (!item || !item.versions.some(v => v.version === Number(version))) throw new Error('Версия промта не найдена');
  item.activeVersion = Number(version);
  normalized.updatedAt = new Date().toISOString();
  return normalized;
}
export function applyManagedPrompt(basePrompt, moduleId, registry = loadPromptRegistry()) {
  const addition = activePrompt(registry, moduleId);
  if (!addition) return basePrompt;
  return String(basePrompt || '') + '\n\n# Дополнительные инструкции Prompt Manager (версия ' +
    registry.modules[moduleId].activeVersion + ')\n' + addition +
    '\n\nСоблюдай исходный формат ответа и ограничения безопасности основного задания. Если инструкции конфликтуют с форматом данных, не меняй формат.';
}
export function exportPromptRegistry(registry) {
  return JSON.stringify(normalizePromptRegistry(registry), null, 2);
}
export function importPromptRegistry(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (!parsed || parsed.schemaVersion !== 1) throw new Error('Неподдерживаемый формат реестра промтов');
  return normalizePromptRegistry(parsed);
}
