import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const hits = [];
const patterns = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];
for (const path of new Set(files)) {
  if (
    !existsSync(path) ||
    path.startsWith('docs/cloudflare-rebuild/platform-kit/') ||
    path.endsWith('.png')
  )
    continue;
  if (/(^|\/)\.env(?:\.|$)|\.pyc$/.test(path))
    hits.push(`${path}: environment/bytecode file`);
  const text = readFileSync(path, 'utf8');
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text))
      hits.push(`${path}: potential credential (value suppressed)`);
  }
}
if (hits.length) {
  console.error(hits.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Secret/file scan passed (${new Set(files).size} paths; historical platform references excluded).`,
  );
