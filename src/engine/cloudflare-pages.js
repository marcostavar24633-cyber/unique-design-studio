// Публикация готового сайта в существующий Cloudflare Pages project через Wrangler (перенесено из PR #39).
// Имя проекта и ветку не угадываем: только явные и проверенные значения.
const SAFE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const UNSAFE_PATH = /[&|<>^"%!`$;\r\n]/;
const SAFE_BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;

export function validateCloudflarePagesTarget(projectName, branch = 'production') {
  if (typeof projectName !== 'string' || !SAFE_SLUG.test(projectName)) {
    throw new Error('Укажите корректное имя Cloudflare Pages project: латиница в нижнем регистре, цифры и дефисы.');
  }
  if (typeof branch !== 'string' || !SAFE_BRANCH.test(branch) || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) {
    throw new Error('Некорректное имя ветки Cloudflare Pages.');
  }
  return { projectName, branch };
}

export function buildCloudflarePagesDeployArgs(directory, projectName, branch = 'production') {
  const target = validateCloudflarePagesTarget(projectName, branch);
  if (typeof directory !== 'string' || !directory.trim()) throw new Error('Не указана папка готового сайта.');
  // На Windows Wrangler запускается через оболочку (npx.cmd): символы оболочки в пути выполнились бы как команды.
  if (UNSAFE_PATH.test(directory)) throw new Error('Путь к папке сайта содержит недопустимые символы оболочки.');
  return ['pages', 'deploy', directory, '--project-name', target.projectName, '--branch', target.branch];
}

/**
 * Аргументы для запуска через оболочку Windows (npx.cmd требует shell): аргументы с пробелами берутся в кавычки,
 * иначе путь вроде «C:\для сайта\out» распадается на части. Кавычки внутри аргументов уже запрещены проверкой выше.
 */
export function shellQuoteArgs(args, windows) {
  return windows ? args.map(a => (/\s/.test(a) ? `"${a}"` : a)) : args;
}
