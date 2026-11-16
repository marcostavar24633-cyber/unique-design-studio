const SAFE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
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
  return ['pages', 'deploy', directory, '--project-name', target.projectName, '--branch', target.branch];
}
