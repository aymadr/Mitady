// Using Mitady from a phone on the same Wi-Fi.
//
// By default the app only listens on this computer (127.0.0.1): nothing else can reach it. In Réglages the user can
// open it to the local network. From then on:
//  - the server listens on every interface of the computer,
//  - any request that does not come from this computer needs a 6-digit code (cookie after the first success),
//  - the code can be changed at any time, which signs every phone out.
// The choice is kept in data/mobile.json. `HOST=0.0.0.0 npm start` does the same without the settings page.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const store = require('./store');

let QRCode = null;
try { QRCode = require('qrcode'); } catch { /* optional: the page then shows the address without a QR code */ }

const FILE = path.join(store.DATA_DIR, 'mobile.json');
const COOKIE = 'mitady_s';
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const st = { enabled: false, pin: '', secret: '' };
try { Object.assign(st, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch { /* first run */ }
const save = () => fs.writeFileSync(FILE, JSON.stringify({ enabled: st.enabled, pin: st.pin, secret: st.secret }, null, 2));
function ensureCredentials() {
  if (!/^\d{6}$/.test(st.pin)) st.pin = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  if (!/^[a-f0-9]{48}$/.test(st.secret)) st.secret = crypto.randomBytes(24).toString('hex');
  save();
}
const sessionToken = () => crypto.createHmac('sha256', st.secret).update(`mitady-session-v1:${st.pin}`).digest('hex');
const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ---------- who is asking ----------

const own = () => {
  const out = new Set();
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) out.add(i.address);
  return out;
};
function isLocal(req) {
  if (req.headers['x-forwarded-for'] || req.headers.forwarded) return false; // came through a proxy: not "this computer"
  const a = req.socket.remoteAddress || '';
  return LOOPBACK.has(a) || own().has(a.replace(/^::ffff:/, ''));
}
function cookieOf(req) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`).exec(req.headers.cookie || '');
  return m ? m[1] : '';
}
const authed = (req) => Boolean(st.secret) && same(cookieOf(req), sessionToken());
function giveCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=${sessionToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 180}`);
}

// A few wrong codes lock the address out for a while.
const tries = new Map();
function locked(ip) {
  const t = tries.get(ip);
  return t && t.until > Date.now();
}
function miss(ip) {
  const t = tries.get(ip) || { n: 0, until: 0 };
  t.n += 1;
  if (t.n >= 5) { t.until = Date.now() + 5 * 60 * 1000; t.n = 0; }
  tries.set(ip, t);
}

// ---------- the sign-in page (nothing else is served before the code is entered) ----------

function loginPage(wrong) {
  let logo = '';
  try { logo = fs.readFileSync(path.resolve(__dirname, '..', '..', 'public', 'favicon.svg'), 'utf8').replace('<svg ', '<svg width="84" height="84" '); } catch { /* no logo */ }
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Mitady · code</title><meta name="theme-color" content="#f4f1e8">
<style>
  :root { color-scheme: light dark; --bg: #f4f1e8; --card: #fff; --text: #14281f; --sub: #5d6f65; --green: #2f7d5b; --line: #d9ddd1; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b1511; --card: #14281f; --text: #f4f1e8; --sub: #9fc1af; --line: #2a4337; } }
  * { box-sizing: border-box; } body { margin: 0; min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 20px; background: var(--bg); color: var(--text); font: 16px/1.5 -apple-system, system-ui, 'Segoe UI', sans-serif; }
  main { width: min(380px, 100%); text-align: center; } h1 { font-size: 28px; letter-spacing: -0.03em; margin: 14px 0 6px; } p { color: var(--sub); margin: 0 0 22px; }
  .card { background: var(--card); border-radius: 24px; padding: 24px; box-shadow: 0 20px 50px -20px rgba(10, 40, 25, .35), 0 0 0 1px var(--line); }
  input { width: 100%; height: 64px; font-size: 32px; letter-spacing: .5em; text-align: center; border-radius: 16px; border: 2px solid var(--line); background: transparent; color: var(--text); padding-left: .5em; }
  input:focus { outline: none; border-color: var(--green); } .err { color: #c9604a; min-height: 24px; margin: 12px 0 0; font-size: 14px; }
</style></head><body><main>${logo}<h1>Mitady</h1><p>Entre le code à 6 chiffres affiché dans les Réglages, sur l'ordinateur.</p>
<div class="card"><input id="pin" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" placeholder="······" autofocus><p class="err" id="err">${wrong ? 'Code incorrect.' : ''}</p></div></main>
<script>
  const input = document.getElementById('pin'), err = document.getElementById('err');
  input.addEventListener('input', async () => {
    input.value = input.value.replace(/\\D/g, '');
    if (input.value.length < 6) return;
    err.textContent = '';
    const r = await fetch('/api/mobile/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: input.value }) });
    if (r.ok) return location.reload();
    err.textContent = r.status === 429 ? 'Trop d’essais : réessaie dans quelques minutes.' : 'Code incorrect.';
    input.value = '';
  });
</script></body></html>`;
}

// ---------- addresses to show ----------

function addresses(port) {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family !== 'IPv4' || i.internal) continue;
      const [a, b] = i.address.split('.').map(Number);
      const tailscale = a === 100 && b >= 64 && b <= 127;
      const home = a === 192 && b === 168 || a === 10 || (a === 172 && b >= 16 && b <= 31);
      if (!home && !tailscale) continue;
      out.push({ label: tailscale ? 'Tailscale (hors de chez toi)' : 'Wi-Fi / réseau local', interface: name, url: `http://${i.address}:${port}`, rank: tailscale ? 1 : 0 });
    }
  }
  return out.sort((x, y) => x.rank - y.rank);
}

// ---------- wiring ----------

let app = null, server = null, port = 3000, envHost = '', listeningOn = '127.0.0.1';
const envExposed = () => Boolean(envHost) && !['127.0.0.1', 'localhost', '::1'].includes(envHost);
const exposed = () => st.enabled || envExposed();

function bind(host) {
  if (server) { server.close(); server.closeIdleConnections?.(); }
  listeningOn = host;
  server = app.listen(port, host, () => announce());
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `Le port ${port} est déjà utilisé.` : e.message);
    if (!listeningOn.startsWith('127.')) bind('127.0.0.1');
  });
  return server;
}
function announce() {
  console.log(`Mitady prêt sur http://localhost:${port}`);
  if (listeningOn.startsWith('127.')) return;
  console.log('Accès téléphone ouvert. Code :', st.pin);
  for (const a of addresses(port)) console.log(`  ${a.label} : ${a.url}`);
}

async function status(req) {
  const urls = addresses(port);
  const info = { available: true, enabled: exposed(), fromSettings: st.enabled, port, urls: urls.map(({ label, url }) => ({ label, url })), pin: exposed() ? st.pin : '', qr: '', hasQr: Boolean(QRCode) };
  if (info.enabled && QRCode && urls[0]) {
    info.qr = await QRCode.toString(`${urls[0].url}/?pin=${st.pin}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14281f', light: '#ffffff' } });
  }
  return info;
}

function mount(expressApp, opts) {
  app = expressApp;
  port = opts.port;
  envHost = opts.host || '';
  if (exposed()) ensureCredentials();

  // 1. the gate: before everything else
  app.use((req, res, next) => {
    if (!exposed() || isLocal(req)) return next();
    if (req.method === 'POST' && req.path === '/api/mobile/login') return next();
    if (/^\/(favicon\.svg|manifest\.webmanifest|icons\/)/.test(req.path)) return next();
    if (authed(req)) return next();
    // one scan of the QR code signs in: /?pin=123456
    if (req.method === 'GET' && typeof req.query.pin === 'string' && /^\d{6}$/.test(req.query.pin) && !locked(req.ip)) {
      if (same(req.query.pin, st.pin)) { giveCookie(res); return res.redirect(req.path); }
      miss(req.ip);
    }
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Code requis.' });
    res.status(401).type('html').send(loginPage(false));
  });

  app.post('/api/mobile/login', express.json({ limit: '1kb' }), (req, res) => {
    const ip = req.ip;
    if (!exposed() || isLocal(req)) return res.json({ ok: true });
    if (locked(ip)) return res.status(429).json({ error: 'Trop d’essais.' });
    if (!same(String(req.body?.pin || ''), st.pin)) { miss(ip); return res.status(403).json({ error: 'Code incorrect.' }); }
    tries.delete(ip);
    giveCookie(res);
    res.json({ ok: true });
  });

  // 2. the settings behind the "Sur ton téléphone" card: only from this computer
  const onlyHere = (req, res, next) => (isLocal(req) ? next() : res.status(403).json({ error: 'Ce réglage se change depuis l’ordinateur où Mitady est lancé.' }));
  const run = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(500).json({ error: e.message }));

  app.get('/api/mobile', onlyHere, run(async (req, res) => res.json(await status(req))));
  app.post('/api/mobile/enable', onlyHere, run(async (req, res) => {
    st.enabled = true;
    ensureCredentials();
    const body = await status(req);
    res.json(body);
    if (listeningOn !== '0.0.0.0') setTimeout(() => bind('0.0.0.0'), 150);
  }));
  app.post('/api/mobile/disable', onlyHere, run(async (req, res) => {
    st.enabled = false;
    save();
    res.json({ available: true, enabled: envExposed(), fromSettings: false, port, urls: [], pin: '', qr: '', hasQr: Boolean(QRCode) });
    if (!envExposed() && listeningOn !== '127.0.0.1') setTimeout(() => bind('127.0.0.1'), 150);
  }));
  app.post('/api/mobile/regenerate', onlyHere, run(async (req, res) => {
    st.pin = '';
    st.secret = '';
    ensureCredentials();
    res.json(await status(req));
  }));
}

function listen() {
  const host = envHost || (st.enabled ? '0.0.0.0' : '127.0.0.1');
  bind(host);
}

module.exports = { mount, listen };
