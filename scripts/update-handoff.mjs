import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'PROJECT_HANDOFF.md';
const run = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const branch = process.env.GITHUB_REF_NAME || run(['branch', '--show-current']);
const sha = run(['rev-parse', 'HEAD']);
const date = run(['show', '-s', '--format=%cI', 'HEAD']);
const subject = run(['show', '-s', '--format=%s', 'HEAD']);
const history = run(['log', '-8', '--date=short', '--pretty=format:- %h · %ad · %s']);
const nl = String.fromCharCode(10);
const block = [
  'Время обновления: ' + new Date().toISOString(),
  'Ветка: ' + branch,
  'Последний commit: ' + sha,
  'Дата коммита: ' + date,
  'Сообщение: ' + subject,
  '',
  'Последние коммиты:',
  history || '- История пока пуста',
].join(nl);
const source = readFileSync(path, 'utf8');
const start = '<!-- HANDOFF:AUTO:START -->';
const end = '<!-- HANDOFF:AUTO:END -->';
const a = source.indexOf(start);
const b = source.indexOf(end);
if (a < 0 || b < a) throw new Error('Handoff auto markers not found');
const updated = source.slice(0, a + start.length) + nl + block + nl + source.slice(b);
writeFileSync(path, updated);
