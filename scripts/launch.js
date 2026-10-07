// One-step launcher: prepares everything on first run, starts the app, opens the browser.
// Used by Lancer.bat / Lancer.command / lancer.sh, so nothing has to be typed by hand.
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WIN = process.platform === 'win32';
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: WIN, ...opts });
const say = (msg) => console.log(`\n▸ ${msg}`);

if (Number(process.versions.node.split('.')[0]) < 18) {
  console.error('Node.js 18 ou plus récent est requis : https://nodejs.org');
  process.exit(1);
}

const marker = path.join(ROOT, 'node_modules', '.setup-done');
if (!fs.existsSync(path.join(ROOT, 'node_modules', 'express'))) {
  say('Première utilisation : installation (quelques minutes, une seule fois)…');
  if (run('npm', ['install', '--no-audit', '--no-fund']).status !== 0) process.exit(1);
}
if (!fs.existsSync(marker)) {
  say('Installation du navigateur utilisé pour collecter les offres et créer les PDF…');
  if (run('npx', ['playwright', 'install', 'chromium']).status !== 0) process.exit(1);
  // Optional: reading a Word CV needs python-docx. Not fatal if Python is missing.
  say('Module Word (facultatif)…');
  for (const py of WIN ? ['python'] : ['python3', 'python']) {
    const args = ['-m', 'pip', 'install', '--quiet', 'python-docx', 'pypdf', ...(WIN ? ['pywin32'] : [])];
    if (spawnSync(py, args, { stdio: 'ignore', shell: WIN }).status === 0) break;
  }
  fs.writeFileSync(marker, new Date().toISOString());
}

const port = Number(process.env.PORT) || 3000;
const url = `http://localhost:${port}`;
say(`Démarrage : ${url}  (ferme cette fenêtre pour arrêter)`);
const server = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], { cwd: ROOT, stdio: 'inherit' });
server.on('exit', (code) => process.exit(code ?? 0));

setTimeout(() => {
  const [cmd, args] = WIN ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}, 2000);
